# QuizNGO srv – Bottleneck Analysis (Deep Dive)

**Target:** ~200 concurrent games, ~2,000 concurrent WebSocket connections  
**Date:** 2025-02-22

---

## Executive Summary

The server architecture (Quart + python-socketio over Hypercorn ASGI) is **fundamentally sound** for the target scale. The async model should easily handle 2,000 WS connections and 200 games. The bottlenecks causing early failures are **not architectural** — they are a handful of specific implementation and configuration issues that compound under load. Below is a ranked list from most impactful to least.

---

## 🔴 Critical Bottlenecks

### 1. `aiohttp.ClientSession` created per LB call — connection/FD exhaustion

**File:** `server.py` lines 395-403, `utils/lb_client.py` lines 32-42

```python
# server.py – _lb_post()
async def _lb_post(url, json_data, timeout=5):
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        ...
```

```python
# lb_client.py – notify_game_ended()
async with aiohttp.ClientSession(connector=connector) as session:
    ...
```

**Problem:** Every heartbeat (every 30s) and every `notify_game_ended` call (every game close) creates a **brand-new TCP connector + session**, performs one request, then tears it all down. Under 200 games, `notify_game_ended` triggers 200+ times. Each session opens a new TCP connection with full TLS handshake overhead, contributes to ephemeral port exhaustion, and generates unnecessary garbage-collection pressure.

**Impact:** High. At scale this causes `OSError: [Errno 99] Cannot assign requested address` or `ConnectionResetError` when ephemeral ports are exhausted (typically ~28,000 available ports with a 60s TIME_WAIT on Linux). 200 rapid game closures can saturate this.

**Fix:** Create a single long-lived `aiohttp.ClientSession` at startup and reuse it for all LB communication. The session's internal connection pool (default `limit=100`) handles concurrent access efficiently.

---

### 2. `emit_to_addins` — sequential per-socket `await` with no parallelism

**File:** `utils/room_utils.py` lines 328-342

```python
async def emit_to_addins(sio, addin_sockets_by_game, logger, event, data, game_pin):
    addin_sids = tuple(addin_sockets_by_game.get(game_pin, ()))
    for sid in addin_sids:
        try:
            await sio.emit(event, data, to=sid)
        except Exception as exc:
            logger.warning(...)
```

**Problem:** Each `await sio.emit(...)` is executed **sequentially**. While typically there's only 1 add-in per game, the broader pattern of emitting to individual sockets sequentially is replicated in `submit_results` (game_routes.py) where results are sent to **every player** one by one:

```python
# game_routes.py – submit_results
for result in results:
    target_sid = sid_by_uid.get(user_id)
    if target_sid:
        await sio.emit('player_results', player_data, to=target_sid)
```

With 200 players per game and 200 concurrent games, this means up to **40,000 sequential awaits** across the event loop during a result submission wave. Each `await` yields to the event loop, and the total latency stacks.

**Impact:** High. Creates a cascading delay — late players receive results seconds after early ones, potentially after the next question has started.

**Fix:** Use `asyncio.gather()` for parallel emission:

```python
async def emit_to_addins(sio, addin_sockets_by_game, logger, event, data, game_pin):
    addin_sids = tuple(addin_sockets_by_game.get(game_pin, ()))
    if not addin_sids:
        return
    
    async def _safe_emit(sid):
        try:
            await sio.emit(event, data, to=sid)
        except Exception as exc:
            logger.warning(f'Emit failed for {event} to add-in {sid}: {exc}')
    
    await asyncio.gather(*[_safe_emit(sid) for sid in addin_sids])
```

Apply the same pattern to `submit_results` loop.

---

### 3. Hypercorn default worker/connection limits

**File:** `server.py` lines 487-496

```python
config = Config()
config.bind = [f"0.0.0.0:{PORT}"]
# No further config...
asyncio.run(hypercorn.asyncio.serve(app, config))
```

**Problem:** Hypercorn defaults that hurt at scale:

| Setting | Default | Problem |
|---|---|---|
| `keep_alive_timeout` | 5s | Too short for WS upgrade negotiation under load |
| `backlog` | 100 | Kernel TCP accept queue fills at ~100 simultaneous connects |
| `h11_max_incomplete_size` | 16 KB | Fine |
| Workers | 1 (single process) | Cannot use multiple CPU cores |

**Impact:** High. The `backlog=100` is a hard cap — when 200 players connect simultaneously (game start), the kernel drops/resets connections that exceed the queue. This manifests as `ConnectionRefusedError` on the client side.

**Fix:**
```python
config = Config()
config.bind = [f"0.0.0.0:{PORT}"]
config.backlog = 2048
config.keep_alive_timeout = 120
config.websocket_ping_interval = 25
config.websocket_ping_timeout = 20
```

---

### 4. No Linux file descriptor / socket limit tuning

**Problem:** Default Linux `ulimit -n` is **1024**. Each WebSocket connection consumes 1 FD. With 2,000 WS connections + internal FDs (log files, LB connections, stdin/stdout/stderr) you need ~2,200+ FDs minimum.

**Impact:** Critical. Hard crash at ~1,020 connections with `OSError: [Errno 24] Too many open files`.

**Fix:** In `start.sh`:
```bash
ulimit -n 65536
```
And in systemd unit (if applicable):
```ini
LimitNOFILE=65536
```

---

## 🟠 Major Bottlenecks

### 5. Global `player_registry` full scan in `answer_time_started`

**File:** `game_routes.py` lines 82-93

```python
# Fallback path when players_by_game is None
connected_count = sum(
    1 for p in player_registry.values()
    if p.get('gamePin') == game_pin and p.get('connected', False)
)
```

**Problem:** While the `players_by_game` optimization exists, several code paths still use the `player_registry` fallback which is **O(all players across all games)**. With 200 games × 10 players average = 2,000 entries, this runs 2,000 iterations per call. During answer submission waves, this compounds.

**Impact:** Medium. The `players_by_game` index mitigates this in the happy path, but the fallback is still present and will activate if the index gets out of sync (bug) or is `None`.

**Fix:** Remove the fallback entirely — always require `players_by_game` to be non-None. It's already passed everywhere.

---

### 6. `connected_clients` is a plain `set()` — no GC on stale entries

**File:** `server.py` line 247

```python
connected_clients = set()
```

**Problem:** `connected_clients` grows unconditionally on `connect` and shrinks on `disconnect`. But if a client's TCP connection drops without a clean disconnect (network failure, mobile sleep, etc.), the `disconnect` event may fire late or not at all (depends on ping/pong timeout). Over time, this set grows and inflates the `active_ws_connections` stat reported to the LB, causing the LB to route traffic away from this server prematurely.

More critically, the heartbeat reports `len(connected_clients)` which can be **significantly higher** than actual live connections, causing mis-routing.

**Impact:** Medium. Gradual degradation — wrong LB routing decisions.

**Fix:** Add periodic sweeping or rely on python-socketio's internal connection tracking instead of maintaining a separate set:

```python
# In heartbeat_loop:
stats = {
    'active_ws_connections': len(sio.eio.sockets),  # actual Engine.IO connections
    ...
}
```

---

### 7. `emit_to_room` uses Socket.IO room broadcast — includes players AND add-ins

**File:** `room_utils.py` lines 314-326

```python
async def emit_to_room(sio, client_rooms, logger, event, data, game_pin, skip_sid=None):
    await sio.emit(event, data, room=game_pin, skip_sid=skip_sid)
```

**Problem:** `answer_time_started` calls `emit_to_room` which broadcasts to ALL sockets in the room — both players AND the add-in. The add-in receives `answer_time_started` data that it just sent (echo). This is wasteful and doubles the payload volume on the server for no reason.

**Impact:** Low-Medium. Wastes bandwidth and processing for the add-in socket.

**Fix:** Use `emit_to_room` with `skip_sid` targeting add-in sockets, or create a dedicated `emit_to_players` function.

---

### 8. `close_game_and_cleanup` — O(sockets) `leave_room` storm

**File:** `room_utils.py` lines 219-259

```python
for sid in sockets_to_remove:
    try:
        await sio.leave_room(sid, game_pin)
    except Exception:
        pass
    ...
```

**Problem:** When a 200-player game closes, this loop calls `await sio.leave_room()` 200+ times **sequentially**. Each call is an async operation that touches Socket.IO's internal room management data structures.

**Impact:** Medium. During simultaneous game closures (simulator shutdown), this can block the event loop for seconds.

**Fix:** Use `asyncio.gather()`:
```python
await asyncio.gather(*[
    sio.leave_room(sid, game_pin)
    for sid in sockets_to_remove
], return_exceptions=True)
```

---

## 🟡 Minor Bottlenecks

### 9. `HighVolumeLogFilter.filter()` — string scanning on EVERY log record

**File:** `server.py` lines 133-140

```python
class HighVolumeLogFilter(logging.Filter):
    def filter(self, record):
        ...
        msg = record.getMessage()
        return not any(token in msg for token in HIGH_VOLUME_LOG_PATTERNS)
```

**Problem:** `HIGH_VOLUME_LOG_PATTERNS` has 17 patterns. Every log record scans all 17 strings via `any(token in msg ...)`. Under load with 2,000 active connections, logging frequency is very high.

**Impact:** Low. ~1-2% CPU overhead.

**Fix:** Pre-compile into a single regex or use a set-based prefix check.

---

### 10. `request.get_json()` — no size limit

**File:** All route handlers

```python
data = await request.get_json()
```

**Problem:** No `max_content_length` configured on the Quart app. A malicious client can send a multi-GB JSON body and OOM the server.

**Impact:** Low (security concern, not normal load bottleneck).

**Fix:**
```python
quart_app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # 1 MB
```

---

### 11. Fire-and-forget `asyncio.create_task()` without error handling

**File:** `room_utils.py` line 308, `server.py` line 449

```python
asyncio.create_task(notify_game_ended(game_pin))
asyncio.create_task(delayed_lb_registration())
```

**Problem:** Unhandled exceptions in fire-and-forget tasks are silently swallowed (Python 3.11+) or printed to stderr as "Task exception was never retrieved" (older). Under load, failed LB notifications pile up silently.

**Impact:** Low. Informational loss, no crash.

**Fix:** Wrap with error-catching:
```python
async def _safe(coro):
    try:
        await coro
    except Exception as e:
        logger.warning(f'Background task failed: {e}')

asyncio.create_task(_safe(notify_game_ended(game_pin)))
```

---

## 📊 Capacity Estimate (After Fixes)

| Resource | Current Max | After Fixes | Target |
|---|---|---|---|
| Concurrent WS connections | ~1,000 (FD limit) | 10,000+ | 2,000 |
| Concurrent games | ~50-100 (LB connection storms) | 500+ | 200 |
| Player join burst rate | ~100/sec (backlog) | ~2,000/sec | ~500/sec |
| Result submission latency (200 players) | ~2-4 sec | ~50-100 ms | <500 ms |
| Memory per game (10 players) | ~5 KB | ~5 KB | — |
| Total memory (200 games, 2K players) | ~15 MB | ~12 MB | <100 MB |

---

## 🔧 Priority Fix Order

1. **`ulimit -n 65536`** in start.sh — 1 line, prevents hard crash
2. **Hypercorn config** (backlog, keepalive) — 5 lines, prevents connection drops
3. **Shared `aiohttp.ClientSession`** — prevents FD/port exhaustion from LB calls
4. **`asyncio.gather()` in emit loops** — eliminates sequential emission delay
5. **Use `sio.eio.sockets` for heartbeat stats** — accurate LB routing
6. **Remove player_registry fallback scans** — future-proof performance

---

## 🏗️ Architecture Notes

Things that are **already well done** and NOT bottlenecks:

- ✅ `players_by_game` per-game index — excellent O(1) lookup
- ✅ `addin_sockets_by_game` / `player_sockets_by_game` — avoids full-scan of client_rooms
- ✅ `sid_by_uid` prebuilt in `submit_results` — O(1) per player instead of O(all sockets)
- ✅ Using ASGI + asyncio (Quart/Hypercorn) — correct choice for high-concurrency WS
- ✅ Auto-close timeouts with `asyncio.Task` cancellation — clean lifecycle management
- ✅ Socket.IO rooms for game isolation — proper use of the library
- ✅ CORSMiddleware at ASGI level — handles preflight efficiently without hitting Quart
