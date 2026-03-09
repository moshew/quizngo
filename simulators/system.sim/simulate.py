#!/usr/bin/env python3
"""
system.sim – QuizNGO System Load Simulator

Simulates 4000 full game sessions running concurrently at a realistic pace.
The script acts as both the game controller (add-in role) and all players,
using REST API calls plus Socket.IO clients to mirror production lifecycle.

Each game:
  - 5–200 players  (weighted towards smaller numbers)
  - 5–18 questions (17–18 are now possible and somewhat more frequent)
  - 50–90 % correct-answer rate per game
  - ~24 % of (player, question) pairs result in no answer (wait for timeout)

Usage:
    pip install -r requirements.txt
    python simulate.py [--lb-url URL] [--games N] [--log-file PATH]
"""

import asyncio
import contextlib
import logging
import sys
import time
import random
import argparse
import os
import traceback
from contextlib import contextmanager
from pathlib import Path
import aiohttp
import socketio as sio_module

# engine.io logs "packet queue is empty, aborting" at ERROR level whenever a
# socket's write-loop times out while idle (normal during question/results
# pauses).  Silence it — the simulation handles disconnects cleanly already.
logging.getLogger("engineio.client").setLevel(logging.CRITICAL)

# ── Windows asyncio policy ───────────────────────────────────────────────────
# Selector loop on Windows uses select(), which has a low descriptor limit.
# Load simulation opens many sockets, so prefer Proactor unless explicitly
# forced for compatibility.
if sys.platform == "win32":
    if os.getenv("SYSTEM_SIM_FORCE_SELECTOR_LOOP", "0") == "1":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    else:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


# ── Defaults / tunables ──────────────────────────────────────────────────────

DEFAULT_LB_URL      = "http://localhost:5000"
DEFAULT_GAMES       = 4000
DEFAULT_LOG_FILE    = Path(__file__).with_name("system.sim.log")
MIN_PLAYERS         = 5
MAX_PLAYERS         = 200
PIN_START           = 100000
PIN_END_EXCLUSIVE   = 1000000
MAX_UNIQUE_PINS     = PIN_END_EXCLUSIVE - PIN_START

QUESTION_DUR_MIN    = 30          # Seconds
QUESTION_DUR_MAX    = 30          # Seconds
RESULTS_PAUSE       = 7           # Seconds between end-of-question and next question
LOBBY_WAIT          = 8           # Seconds between start_game and first question

INTER_ARRIVAL_ZERO_PROB = 0.45    # Must stay <= 45% as requested
INTER_ARRIVAL_MEAN      = 2.8     # Shorter delays on average
INTER_ARRIVAL_CAP       = 24.0    # Keep a finite upper bound

NON_ANSWER_RATE     = 0.24        # Slightly higher fraction of no-answer outcomes
ANSWER_ELAPSED_MIN  = 0.40        # Minimum simulated answer latency
ANSWER_ELAPSED_MAX_RATIO = 0.93   # Players answer in the first ~93 % of the question window
ANSWER_ELAPSED_SHAPE_ALPHA = 1.70 # Beta distribution, gently biased to later answers
ANSWER_ELAPSED_SHAPE_BETA  = 1.35

# Retry transient connector/server errors under heavy concurrency.
HTTP_REQUEST_RETRIES = 3          # total attempts = retries + 1
HTTP_RETRY_BASE_DELAY = 0.35      # seconds; exponential backoff + jitter
HTTP_RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}

PLAYER_ICONS        = ["⭐", "🔥", "🚀", "💎", "🌟", "🎯", "🦄", "🐉"]


# ── Player-count distribution ────────────────────────────────────────────────

def random_player_count() -> int:
    """Weighted distribution: mostly small games, large ones are rare."""
    r = random.random()
    if   r < 0.55: return random.randint(MIN_PLAYERS, 25)    # 55 %
    elif r < 0.80: return random.randint(26,  70)            # 25 %
    elif r < 0.95: return random.randint(71, 130)            # 15 %
    else:          return random.randint(131, MAX_PLAYERS)   # 5 %


def random_question_count() -> int:
    """Weighted distribution with max 18 questions; high counts are more common."""
    r = random.random()
    if r < 0.35:
        return random.randint(5, 8)    # 35 %
    if r < 0.65:
        return random.randint(9, 12)   # 30 %
    if r < 0.88:
        return random.randint(13, 16)  # 23 %
    return random.choice([17, 18, 18]) # 12 % (max count is more likely)


def random_correct_rate() -> float:
    return random.uniform(0.50, 0.90)


def inter_arrival_delay() -> float:
    """Random wait between starting consecutive games.

    Distribution:
      45 % -> 0 s  (immediate start, unchanged upper bound requested)
      55 % -> exponential(mean ~= 2.8 s), capped at 24 s
              (~0.01 % of all games land on the 24 s cap)
    """
    if random.random() < INTER_ARRIVAL_ZERO_PROB:
        return 0.0
    return min(INTER_ARRIVAL_CAP, random.expovariate(1 / INTER_ARRIVAL_MEAN))


# ── Scoring ──────────────────────────────────────────────────────────────────

def question_score(elapsed: float, duration: float) -> int:
    """Kahoot-style: faster correct answer → more points (500–1 000)."""
    ratio = min(elapsed, duration) / max(duration, 1)
    return int(1000 * (1.0 - 0.5 * ratio))


# ── Shared stats ─────────────────────────────────────────────────────────────

class SimStats:
    def __init__(self):
        self.started   = 0
        self.completed = 0
        self.failed    = 0
        self.players   = 0
        self.questions = 0
        self.answers   = 0
        self._lock     = asyncio.Lock()

    async def game_started(self, n_players: int):
        async with self._lock:
            self.started  += 1
            self.players  += n_players

    async def game_done(self, n_questions: int, n_answers: int):
        async with self._lock:
            self.completed += 1
            self.questions += n_questions
            self.answers   += n_answers

    async def game_failed(self):
        async with self._lock:
            self.failed += 1


_stats  = SimStats()
_active = [0]   # mutable counter: currently-running games


class _TeeStream:
    """Mirror writes to terminal and log file."""

    def __init__(self, terminal, log_file):
        self._terminal = terminal
        self._log_file = log_file
        self.encoding = getattr(terminal, "encoding", "utf-8")

    def write(self, data):
        if not isinstance(data, str):
            data = str(data)
        self._terminal.write(data)
        # Progress monitor uses carriage return; store it as newline in the file.
        self._log_file.write(data.replace("\r", "\n"))
        return len(data)

    def flush(self):
        self._terminal.flush()
        self._log_file.flush()

    def isatty(self):
        return bool(getattr(self._terminal, "isatty", lambda: False)())

    def fileno(self):
        return self._terminal.fileno()

    def __getattr__(self, name):
        return getattr(self._terminal, name)


@contextmanager
def mirror_stdio_to_log(log_file_path: str):
    """Mirror stdout/stderr to a single log file, overwriting it per run."""
    log_path = Path(log_file_path).expanduser()
    log_path.parent.mkdir(parents=True, exist_ok=True)

    original_stdout = sys.stdout
    original_stderr = sys.stderr

    with log_path.open("w", encoding="utf-8", errors="replace") as log_file:
        sys.stdout = _TeeStream(original_stdout, log_file)
        sys.stderr = _TeeStream(original_stderr, log_file)
        print(f"Log file: {log_path.resolve()}")
        try:
            yield
        finally:
            sys.stdout.flush()
            sys.stderr.flush()
            sys.stdout = original_stdout
            sys.stderr = original_stderr


# ── Single game simulation ────────────────────────────────────────────────────

async def _make_socket(server_url: str) -> sio_module.AsyncClient:
    """Connect a new socket.io client and return it.

    Uses WebSocket-only transport (skips polling handshake) to minimise
    ephemeral port usage under high concurrency.
    """
    sio = sio_module.AsyncClient(
        logger=False,
        engineio_logger=False,
        reconnection=False,   # Don't auto-reconnect; simplifies cleanup
    )
    try:
        await sio.connect(server_url, transports=['websocket'], wait_timeout=15)
    except Exception:
        with contextlib.suppress(Exception):
            await sio.disconnect()  # close the internal aiohttp session
        raise
    return sio


async def _disconnect_all(socks: list) -> None:
    """Disconnect a list of socket.io clients, ignoring errors."""
    if not socks:
        return
    # If coroutine finalization happens after loop teardown, there is no running
    # loop and we cannot await disconnects.
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return
    # Grab references to engine.io's internal read/write tasks BEFORE calling
    # disconnect().  When state != 'connected' (e.g. server dropped the link),
    # disconnect() skips its internal `await read_loop_task` and returns
    # immediately, leaving those tasks mid-cleanup.  Holding references here
    # prevents them from being garbage-collected as "pending", and the explicit
    # gather below ensures they finish before we return.
    # Attribute names come from engineio/async_client.py:
    #   self.read_loop_task  – _read_loop_websocket / _read_loop_polling
    #   self.write_loop_task – _write_loop
    eio_tasks = []
    for s in socks:
        eio = getattr(s, 'eio', None)
        if eio is None:
            continue
        for attr in ('read_loop_task', 'write_loop_task'):
            t = getattr(eio, attr, None)
            if t is not None and not t.done():
                eio_tasks.append(t)

    await asyncio.gather(*[s.disconnect() for s in socks], return_exceptions=True)

    # If disconnect() already awaited the tasks they will be done and this
    # returns immediately.  If it skipped them (non-connected state) we wait
    # for them to complete their own cleanup now.
    if eio_tasks:
        await asyncio.gather(*eio_tasks, return_exceptions=True)


async def _response_payload(response: aiohttp.ClientResponse):
    """Best-effort JSON parsing. Returns Python object or None."""
    try:
        return await response.json(content_type=None)
    except Exception:
        return None


def _payload_has_error_status(payload) -> bool:
    """True when payload has explicit non-success status."""
    if not isinstance(payload, dict):
        return False
    status = str(payload.get("status", "")).strip().lower()
    return bool(status) and status != "success"


async def _body_preview(response: aiohttp.ClientResponse, payload=None) -> str:
    """Compact response preview for logs/errors."""
    if payload is not None:
        return str(payload)[:200]
    try:
        return (await response.text())[:200]
    except Exception:
        return "<unreadable>"


def _is_retryable_network_error(exc: Exception) -> bool:
    """True for transient client/network errors that should be retried."""
    return isinstance(exc, (aiohttp.ClientError, asyncio.TimeoutError, OSError))


async def _sleep_retry_backoff(attempt_index: int) -> None:
    """Sleep with exponential backoff and a small random jitter."""
    delay = HTTP_RETRY_BASE_DELAY * (2 ** attempt_index) + random.uniform(0.0, 0.15)
    await asyncio.sleep(delay)


async def _post_with_retries(
    session: aiohttp.ClientSession,
    url: str,
    op: str,
    *,
    json_body=None,
    timeout_seconds: float = 15,
    retries: int = HTTP_REQUEST_RETRIES,
):
    """POST helper with retries for transient network/server failures."""
    max_attempts = max(1, retries + 1)
    timeout = aiohttp.ClientTimeout(total=timeout_seconds)

    for attempt_index in range(max_attempts):
        try:
            async with session.post(url, json=json_body, timeout=timeout) as response:
                payload = await _response_payload(response)

                if response.status == 200 and not _payload_has_error_status(payload):
                    return payload

                body = await _body_preview(response, payload)
                if (
                    response.status in HTTP_RETRYABLE_STATUS
                    and attempt_index < max_attempts - 1
                ):
                    await _sleep_retry_backoff(attempt_index)
                    continue

                if response.status != 200:
                    raise RuntimeError(f"{op} -> HTTP {response.status}: {body}")
                raise RuntimeError(f"{op} -> {body}")

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if attempt_index < max_attempts - 1 and _is_retryable_network_error(exc):
                await _sleep_retry_backoff(attempt_index)
                continue
            if isinstance(exc, RuntimeError):
                raise
            raise RuntimeError(f"{op} -> {type(exc).__name__}: {exc}") from exc

    raise RuntimeError(f"{op} -> exhausted retries")


async def simulate_game(
    session:    aiohttp.ClientSession,
    lb_url:     str,
    pin:        str,
    game_index: int,
) -> None:
    """Run one complete simulated game (plays add-in role + all players via WS)."""

    server_url  = None
    _active[0] += 1
    all_socks: list[sio_module.AsyncClient] = []   # every socket created in this game

    try:
        target_players = random_player_count()
        n_questions  = random_question_count()
        correct_rate = random_correct_rate()

        # ── 1. Resolve server via load balancer ───────────────────────────
        payload = await _post_with_retries(
            session,
            f"{lb_url}/api/resolve",
            "LB resolve",
            json_body={"game_pin": pin},
            timeout_seconds=15,
        )
        if not isinstance(payload, dict):
            raise RuntimeError(f"LB resolve -> invalid response payload: {payload!r}")
        server_url = payload.get("server_url")
        if not server_url:
            raise RuntimeError("LB returned no server_url")


        # ── 2. Create room (add-in role) ──────────────────────────────────
        await _post_with_retries(
            session,
            f"{server_url}/?create_room&game_pin={pin}",
            "create_room",
            timeout_seconds=15,
        )

        # ── 3. Add-in mock WebSocket ──────────────────────────────────────
        # Must stay alive until close_game clears client_rooms; otherwise
        # the server's disconnect handler auto-closes the game.
        # Reconnection is enabled so brief transport drops don't abort the game;
        # on each reconnect the socket re-registers its new SID with the server.
        # Non-fatal: if the WS connection fails the game still runs.
        addin_registered = [False]   # True after first successful register_room

        async def _register_addin(addin_client):
            """POST register_room with the addin's current socket id."""
            sid = addin_client.get_sid('/') or addin_client.sid
            if not sid:
                return
            await _post_with_retries(
                session,
                f"{server_url}/register_room",
                "register_room",
                json_body={"socketId": sid, "gamePin": pin},
                timeout_seconds=15,
            )
            addin_registered[0] = True

        try:
            addin_sio = sio_module.AsyncClient(
                logger=False,
                engineio_logger=False,
                reconnection=True,
                reconnection_attempts=5,
                reconnection_delay=1,
                reconnection_delay_max=5,
            )

            @addin_sio.event
            async def connect():
                # On reconnect (not the initial connect), re-register with server.
                if addin_registered[0]:
                    try:
                        await _register_addin(addin_sio)
                    except Exception as e:
                        print(f"\n  [{pin}] add-in re-register failed: {e}", file=sys.stderr)

            await addin_sio.connect(server_url, transports=['websocket'], wait_timeout=15)
            all_socks.append(addin_sio)

            addin_socket_id = addin_sio.get_sid('/') or addin_sio.sid
            if not addin_socket_id:
                raise RuntimeError("addin WS connected but no socket id is available")
            await _register_addin(addin_sio)
        except Exception as e:
            print(f"\n  [{pin}] add-in WS failed: {type(e).__name__}: {e}", file=sys.stderr)

        # ── 4. Start game ─────────────────────────────────────────────────
        await _post_with_retries(
            session,
            f"{server_url}/?start_game&game_pin={pin}",
            "start_game",
            timeout_seconds=15,
        )

        # ── 5. Players join (each with their own WS, staggered) ───────────
        cumulative: dict[str, int] = {}   # uid → cumulative score

        async def join_one(idx: int) -> tuple[sio_module.AsyncClient | None, str | None]:
            """Connect a player socket, join the game, return (sio, uid).

            WS connection is established first for load simulation, but the
            socketId is NOT sent in join_player (avoids calling enter_room
            from inside an HTTP handler which can raise ValueError).
            Instead, we emit 'register_player_socket' after a successful join
            so the server links the socket to the player via a proper
            Socket.IO event handler.
            """
            await asyncio.sleep(random.uniform(0.0, LOBBY_WAIT * 0.8))
            name = f"Bot{game_index}_{idx}"
            icon = random.choice(PLAYER_ICONS)
            sio = None

            # ── Connect WS (non-fatal) ──────────────────────────────────────
            try:
                sio = await _make_socket(server_url)
            except Exception as e:
                if idx == 0:
                    print(
                        f"\n  [{pin}] player WS connect failed (player {idx}):"
                        f" {type(e).__name__}: {e}",
                        file=sys.stderr,
                    )
                # Proceed without WS — join_player still works with empty socketId

            # ── HTTP join ───────────────────────────────────────────────────
            try:
                payload = await _post_with_retries(
                    session,
                    f"{server_url}/?join_player",
                    "join_player",
                    json_body={"game_pin": pin, "name": name, "icon": icon, "socketId": ""},
                    timeout_seconds=15,
                )
                uid = payload.get("uid") if isinstance(payload, dict) else None
                if uid:
                    cumulative[uid] = 0
                    # Register WS socket to room via Socket.IO event
                    # (avoids the HTTP-context race condition with enter_room)
                    if sio is not None:
                        try:
                            await sio.emit(
                                "register_player_socket",
                                {"uid": uid, "gamePin": pin},
                            )
                        except Exception:
                            pass  # Non-fatal: socket still open for load simulation
                    return sio, uid

                if idx == 0:
                    print(
                        f"\n  [{pin}] join payload missing uid: {payload!r}",
                        file=sys.stderr,
                    )
            except Exception as e:
                if idx == 0:
                    print(
                        f"\n  [{pin}] join exc {type(e).__name__}: {e}",
                        file=sys.stderr,
                    )
            await _disconnect_all([sio] if sio is not None else [])
            return None, None

        join_results = await asyncio.gather(*[join_one(i) for i in range(target_players)])

        joined = [(sio, uid) for sio, uid in join_results if uid]
        for sio, _ in joined:
            if sio is not None:
                all_socks.append(sio)
        uids = [uid for _, uid in joined]

        joined_count = len(uids)
        if joined_count < MIN_PLAYERS:
            raise RuntimeError(f"Only {joined_count} players joined successfully (<{MIN_PLAYERS})")
        await _stats.game_started(joined_count)

        # Remaining lobby time
        await asyncio.sleep(max(0.5, LOBBY_WAIT * 0.2))

        # ── 6. Questions ──────────────────────────────────────────────────
        total_answers = 0

        for q_idx in range(n_questions):
            dur = random.randint(QUESTION_DUR_MIN, QUESTION_DUR_MAX)

            # Notify all players: question started (add-in role)
            await _post_with_retries(
                session,
                f"{server_url}/answer_time_started",
                "answer_time_started",
                json_body={
                    "gamePin":          pin,
                    "timestamp":        int(time.time() * 1000),
                    "questionIndex":    q_idx,
                    "duration":         dur,
                    "questionWaitTime": dur,
                },
                timeout_seconds=15,
            )

            # Each player independently decides when (and whether) to answer
            q_result: dict[str, dict | None] = {}

            async def player_answers(uid: str, duration: int, rate: float) -> None:
                """Simulate one player's behaviour for this question."""
                if random.random() < NON_ANSWER_RATE:
                    q_result[uid] = None
                    return

                upper_bound = min(duration - 0.25, duration * ANSWER_ELAPSED_MAX_RATIO)
                lower_bound = ANSWER_ELAPSED_MIN
                upper_bound = max(lower_bound, upper_bound)
                if upper_bound == lower_bound:
                    elapsed = lower_bound
                else:
                    # Slightly bias answer times later than a uniform draw.
                    ratio = random.betavariate(
                        ANSWER_ELAPSED_SHAPE_ALPHA,
                        ANSWER_ELAPSED_SHAPE_BETA,
                    )
                    elapsed = lower_bound + (upper_bound - lower_bound) * ratio
                await asyncio.sleep(elapsed)

                is_correct = random.random() < rate
                answer_idx = 0 if is_correct else random.randint(1, 3)
                try:
                    async with session.post(
                        f"{server_url}/submit_answer",
                        json={
                            "userId":      uid,
                            "answerIndex": answer_idx,
                            "timestamp":   int(time.time() * 1000),
                        },
                        timeout=aiohttp.ClientTimeout(total=10),
                    ):
                        pass
                except Exception:
                    pass

                q_result[uid] = {"elapsed": elapsed, "is_correct": is_correct}

            # Full-duration timer runs alongside all player coroutines.
            # Every player's sleep is < dur, so the timer is always last.
            await asyncio.gather(
                asyncio.sleep(dur),
                *[player_answers(uid, dur, correct_rate) for uid in uids],
            )

            # Calculate results
            results = []
            for uid in uids:
                ans = q_result.get(uid)
                if ans:
                    is_correct = ans["is_correct"]
                    q_score    = question_score(ans["elapsed"], dur) if is_correct else 0
                    answered   = True
                    total_answers += 1
                else:
                    q_score    = 0
                    is_correct = False
                    answered   = False

                cumulative[uid] = cumulative.get(uid, 0) + q_score
                results.append({
                    "userId":          uid,
                    "questionScore":   q_score,
                    "cumulativeScore": cumulative[uid],
                    "isCorrect":       is_correct,
                    "answered":        answered,
                })

            # Rank by cumulative score (highest = rank 1)
            results.sort(key=lambda x: x["cumulativeScore"], reverse=True)
            for rank, res in enumerate(results, 1):
                res["rank"] = rank

            # Submit results (add-in role)
            await _post_with_retries(
                session,
                f"{server_url}/submit_results",
                "submit_results",
                json_body={
                    "gamePin":   pin,
                    "results":   results,
                    "timestamp": int(time.time() * 1000),
                },
                timeout_seconds=15,
            )

            await asyncio.sleep(RESULTS_PAUSE)

        # ── 7. Close game ─────────────────────────────────────────────────
        # close_game_and_cleanup clears client_rooms and socket_to_player on
        # the server, so the subsequent socket disconnects (in finally) will
        # be treated as plain disconnects rather than triggering auto-close.
        await _post_with_retries(
            session,
            f"{server_url}/?close_game&game_pin={pin}",
            "close_game",
            timeout_seconds=15,
        )

        await _stats.game_done(n_questions, total_answers)

    except asyncio.CancelledError:
        raise

    except Exception as exc:
        await _stats.game_failed()
        print(f"\n  [{pin}] FAIL {type(exc).__name__}: {exc}", file=sys.stderr)
        # Best-effort cleanup: close the session on the server before
        # disconnecting sockets (same ordering as the happy path).
        if server_url:
            try:
                await _post_with_retries(
                    session,
                    f"{server_url}/?close_game&game_pin={pin}",
                    "close_game (error cleanup)",
                    timeout_seconds=15,
                    retries=2,
                )
            except Exception:
                pass

    finally:
        _active[0] -= 1
        # Disconnect all sockets AFTER close_game has cleared server-side
        # mappings, so the disconnect handler does nothing harmful.
        await _disconnect_all(all_socks)


# ── Progress monitor ──────────────────────────────────────────────────────────

async def progress_monitor(total: int, interval: float = 5.0) -> None:
    start = time.time()
    while _stats.completed + _stats.failed < total:
        await asyncio.sleep(interval)
        elapsed = int(time.time() - start)
        sys.stdout.write(
            f"\r  {elapsed // 60:02d}:{elapsed % 60:02d}  |  "
            f"started {_stats.started:3d}/{total}  |  "
            f"active {_active[0]:3d}  |  "
            f"done {_stats.completed:3d}  |  "
            f"failed {_stats.failed:3d}    "
        )
        sys.stdout.flush()


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def run(lb_url: str, total_games: int) -> None:
    if total_games < 1 or total_games > MAX_UNIQUE_PINS:
        raise ValueError(f"total_games must be between 1 and {MAX_UNIQUE_PINS}")

    print("QuizNGO System Simulator")
    print(f"  LB URL:      {lb_url}")
    print(f"  Games:       {total_games}")
    print("  Concurrency: unlimited")
    print(
        "  Start delay: "
        f"0 s ({INTER_ARRIVAL_ZERO_PROB * 100:.0f} %) … {INTER_ARRIVAL_CAP:.0f} s "
        f"(mean non-zero {INTER_ARRIVAL_MEAN:.1f} s), exponential"
    )
    print()

    # Generate unique 6-digit PINs for all games (no collisions)
    pins = [str(p) for p in random.sample(range(PIN_START, PIN_END_EXCLUSIVE), total_games)]

    connector = aiohttp.TCPConnector(limit=0)  # unlimited
    async with aiohttp.ClientSession(connector=connector) as session:
        monitor_task = asyncio.create_task(progress_monitor(total_games))
        tasks        = []

        for i, pin in enumerate(pins):
            if i > 0:
                await asyncio.sleep(inter_arrival_delay())

            tasks.append(asyncio.create_task(simulate_game(session, lb_url, pin, i)))

        await asyncio.gather(*tasks, return_exceptions=True)
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    # Cancel and await any orphaned tasks (e.g. stray engine.io loops that
    # weren't awaited inside _disconnect_all) so they don't produce
    # "Task was destroyed but it is pending!" / "Unclosed client session"
    # / "RuntimeError: Event loop is closed" noise at shutdown.
    current = asyncio.current_task()
    orphans = [t for t in asyncio.all_tasks() if t is not current]
    for t in orphans:
        t.cancel()
    if orphans:
        await asyncio.gather(*orphans, return_exceptions=True)

    # Final report
    print()
    print()
    print("=" * 55)
    print("Simulation complete!")
    print(f"  Games:     {_stats.completed} completed, {_stats.failed} failed / {total_games} total")
    print(f"  Players:   {_stats.players:,} joined")
    print(f"  Questions: {_stats.questions:,} played")
    print(f"  Answers:   {_stats.answers:,} submitted")
    print("=" * 55)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(
        description="QuizNGO system load simulator – runs many full games in parallel at normal pace"
    )
    ap.add_argument(
        "--lb-url",
        default=DEFAULT_LB_URL,
        help=f"Load balancer URL (default: {DEFAULT_LB_URL})",
    )
    ap.add_argument(
        "--games",
        type=int,
        default=DEFAULT_GAMES,
        help=f"Total number of games to simulate (default: {DEFAULT_GAMES})",
    )
    ap.add_argument(
        "--concurrency",
        type=int,
        default=None,
        help="Deprecated and ignored. Concurrency is always unlimited.",
    )
    ap.add_argument(
        "--log-file",
        default=str(DEFAULT_LOG_FILE),
        help=f"Log file path (overwritten each run; default: {DEFAULT_LOG_FILE})",
    )
    args = ap.parse_args()

    if args.games < 1 or args.games > MAX_UNIQUE_PINS:
        ap.error(f"--games must be between 1 and {MAX_UNIQUE_PINS}")
    with mirror_stdio_to_log(args.log_file):
        try:
            asyncio.run(run(args.lb_url, args.games))
        except KeyboardInterrupt:
            print("\nInterrupted by user", file=sys.stderr)
            return 130
        except BaseException:
            # Keep the traceback in the simulator log before stdout/stderr restore.
            traceback.print_exc()
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
