#!/usr/bin/env python3
"""
system.sim – QuizNGO System Load Simulator

Simulates 200 full game sessions running concurrently at a realistic pace.
The script acts as both the game controller (add-in role) and all players,
making REST API calls directly without WebSocket connections.

Each game:
  - 5–200 players  (weighted towards smaller numbers)
  - 8–25 questions
  - 50–90 % correct-answer rate per game
  - ~12 % of (player, question) pairs result in no answer (wait for timeout)

Usage:
    pip install aiohttp
    python simulate.py [--lb-url URL] [--games N] [--concurrency N]
"""

import asyncio
import sys
import time
import random
import argparse
import aiohttp

# ── Windows asyncio fix ──────────────────────────────────────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# ── Defaults / tunables ──────────────────────────────────────────────────────

DEFAULT_LB_URL      = "http://localhost:5000"
DEFAULT_GAMES       = 200
DEFAULT_CONCURRENCY = 20          # Max simultaneous games

WAVE_SIZE           = 10          # Games per wave
WAVE_INTERVAL       = 30.0        # Seconds between waves
GAME_STAGGER        = 1.5         # Seconds between individual starts within a wave

QUESTION_DUR_MIN    = 20          # Seconds
QUESTION_DUR_MAX    = 30          # Seconds
RESULTS_PAUSE       = 7           # Seconds between end-of-question and next question
LOBBY_WAIT          = 8           # Seconds between start_game and first question

NON_ANSWER_RATE     = 0.12        # Fraction of (player, question) pairs with no answer

PLAYER_ICONS        = ["⭐", "🔥", "🚀", "💎", "🌟", "🎯", "🦄", "🐉"]


# ── Player-count distribution ────────────────────────────────────────────────

def random_player_count() -> int:
    """Weighted distribution: mostly small games, large ones are rare."""
    r = random.random()
    if   r < 0.50: return random.randint(5,   20)   # 50 %
    elif r < 0.75: return random.randint(21,  50)   # 25 %
    elif r < 0.90: return random.randint(51, 100)   # 15 %
    else:          return random.randint(101, 200)  # 10 %


def random_question_count() -> int:
    return random.randint(8, 25)


def random_correct_rate() -> float:
    return random.uniform(0.50, 0.90)


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


# ── Single game simulation ────────────────────────────────────────────────────

async def simulate_game(
    session:    aiohttp.ClientSession,
    lb_url:     str,
    pin:        str,
    game_index: int,
) -> None:
    """Run one complete simulated game (plays the add-in role + all players)."""

    server_url   = None
    _active[0]  += 1

    try:
        n_players    = random_player_count()
        n_questions  = random_question_count()
        correct_rate = random_correct_rate()

        # ── 1. Resolve server via load balancer ───────────────────────────
        async with session.post(
            f"{lb_url}/api/resolve",
            json={"game_pin": pin},
            timeout=aiohttp.ClientTimeout(total=15),
        ) as r:
            if r.status != 200:
                raise RuntimeError(f"LB resolve → HTTP {r.status}")
            server_url = (await r.json()).get("server_url")
        if not server_url:
            raise RuntimeError("LB returned no server_url")

        await _stats.game_started(n_players)

        # ── 2. Create room (add-in role) ──────────────────────────────────
        async with session.post(
            f"{server_url}/?create_room&game_pin={pin}",
            timeout=aiohttp.ClientTimeout(total=15),
        ) as r:
            if r.status != 200:
                raise RuntimeError(f"create_room → HTTP {r.status}")

        # ── 3. Start game immediately (no human admin needed) ─────────────
        async with session.post(
            f"{server_url}/?start_game&game_pin={pin}",
            timeout=aiohttp.ClientTimeout(total=15),
        ) as r:
            if r.status != 200:
                raise RuntimeError(f"start_game → HTTP {r.status}")

        # ── 4. Players join (staggered over the lobby window) ────────────
        cumulative: dict[str, int] = {}   # uid → cumulative score

        async def join_one(idx: int) -> str | None:
            name = f"Bot{game_index}_{idx}"
            icon = random.choice(PLAYER_ICONS)
            # Spread joins across the first 80 % of the lobby wait
            await asyncio.sleep(random.uniform(0.0, LOBBY_WAIT * 0.8))
            try:
                async with session.post(
                    f"{server_url}/?join_player",
                    json={"game_pin": pin, "name": name, "icon": icon, "socketId": ""},
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as r:
                    if r.status == 200:
                        uid = (await r.json()).get("uid")
                        if uid:
                            cumulative[uid] = 0
                            return uid
            except Exception:
                pass
            return None

        join_results = await asyncio.gather(*[join_one(i) for i in range(n_players)])
        uids = [u for u in join_results if u]
        if not uids:
            raise RuntimeError("No players joined successfully")

        # Remaining lobby time
        await asyncio.sleep(max(0.5, LOBBY_WAIT * 0.2))

        # ── 5. Questions ──────────────────────────────────────────────────
        total_answers = 0

        for q_idx in range(n_questions):
            dur = random.randint(QUESTION_DUR_MIN, QUESTION_DUR_MAX)

            # Notify all players: question started (add-in role)
            async with session.post(
                f"{server_url}/answer_time_started",
                json={
                    "gamePin":          pin,
                    "timestamp":        int(time.time() * 1000),
                    "questionIndex":    q_idx,
                    "duration":         dur,
                    "questionWaitTime": dur,
                },
                timeout=aiohttp.ClientTimeout(total=15),
            ) as r:
                pass  # broadcast only; response not needed

            # Each player independently decides when (and whether) to answer
            q_result: dict[str, dict | None] = {}

            async def player_answers(uid: str, duration: int, rate: float) -> None:
                """Simulate one player's behaviour for this question."""
                if random.random() < NON_ANSWER_RATE:
                    # Player waits the whole duration without answering
                    q_result[uid] = None
                    return

                elapsed = random.uniform(0.5, duration - 0.5)
                await asyncio.sleep(elapsed)

                is_correct  = random.random() < rate
                answer_idx  = 0 if is_correct else random.randint(1, 3)
                try:
                    async with session.post(
                        f"{server_url}/submit_answer",
                        json={
                            "userId":      uid,
                            "answerIndex": answer_idx,
                            "timestamp":   int(time.time() * 1000),
                        },
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as r:
                        pass
                except Exception:
                    pass

                q_result[uid] = {"elapsed": elapsed, "is_correct": is_correct}

            # Run full question timer + all player coroutines concurrently.
            # asyncio.sleep(dur) is always the last to finish because every
            # player's sleep is strictly less than dur.
            await asyncio.gather(
                asyncio.sleep(dur),
                *[player_answers(uid, dur, correct_rate) for uid in uids],
            )

            # Calculate results
            results = []
            for uid in uids:
                ans = q_result.get(uid)
                if ans:
                    q_score    = question_score(ans["elapsed"], dur)
                    is_correct = ans["is_correct"]
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
            async with session.post(
                f"{server_url}/submit_results",
                json={
                    "gamePin":   pin,
                    "results":   results,
                    "timestamp": int(time.time() * 1000),
                },
                timeout=aiohttp.ClientTimeout(total=15),
            ) as r:
                pass

            # Brief pause while players view results
            await asyncio.sleep(RESULTS_PAUSE)

        # ── 6. Close game ─────────────────────────────────────────────────
        async with session.post(
            f"{server_url}/?close_game&game_pin={pin}",
            timeout=aiohttp.ClientTimeout(total=15),
        ) as r:
            pass

        await _stats.game_done(n_questions, total_answers)

    except asyncio.CancelledError:
        raise

    except Exception as exc:
        await _stats.game_failed()
        # Best-effort cleanup so we don't leave orphan sessions on the server
        if server_url:
            try:
                async with session.post(
                    f"{server_url}/?close_game&game_pin={pin}",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as r:
                    pass
            except Exception:
                pass

    finally:
        _active[0] -= 1


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

async def run(lb_url: str, total_games: int, max_concurrent: int) -> None:
    print("QuizNGO System Simulator")
    print(f"  LB URL:      {lb_url}")
    print(f"  Games:       {total_games}")
    print(f"  Concurrency: {max_concurrent}")
    print(f"  Wave size:   {WAVE_SIZE}  (every {WAVE_INTERVAL:.0f}s)")
    print()

    # Generate unique 6-digit PINs for all games (no collisions)
    pins = [str(p) for p in random.sample(range(100000, 1000000), total_games)]

    sem = asyncio.Semaphore(max_concurrent)

    async def guarded(pin: str, idx: int) -> None:
        async with sem:
            await simulate_game(session, lb_url, pin, idx)

    connector = aiohttp.TCPConnector(limit=0)  # unlimited; semaphore controls concurrency
    async with aiohttp.ClientSession(connector=connector) as session:
        monitor_task = asyncio.create_task(progress_monitor(total_games))
        tasks        = []

        for i, pin in enumerate(pins):
            # Wave-based staggering: avoid thundering-herd at startup
            if i > 0:
                if i % WAVE_SIZE == 0:
                    await asyncio.sleep(WAVE_INTERVAL)
                else:
                    await asyncio.sleep(GAME_STAGGER + random.uniform(-0.5, 0.5))

            tasks.append(asyncio.create_task(guarded(pin, i)))

        await asyncio.gather(*tasks, return_exceptions=True)
        monitor_task.cancel()

    # Final report
    print()
    print()
    print("=" * 55)
    print("Simulation complete!")
    print(f"  Games:     {_stats.completed} completed, {_stats.failed} failed / {total_games} total")
    print(f"  Players:   {_stats.players:,} joined")
    print(f"  Questions: {_stats.questions:,} answered")
    print(f"  Answers:   {_stats.answers:,} submitted")
    print("=" * 55)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
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
        default=DEFAULT_CONCURRENCY,
        help=f"Max games running simultaneously (default: {DEFAULT_CONCURRENCY})",
    )
    args = ap.parse_args()

    asyncio.run(run(args.lb_url, args.games, args.concurrency))


if __name__ == "__main__":
    main()
