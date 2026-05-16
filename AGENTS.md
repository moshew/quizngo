# AGENTS.md

Repository guidance for AI coding agents working in this workspace.

## 1) What to Read First

Read these in order before making non-trivial changes:

1. [README.md](README.md)
2. [srv/README.md](srv/README.md)
3. [srv-lb/README.md](srv-lb/README.md)
4. [instructions/GAME_START_FLOW.md](instructions/GAME_START_FLOW.md)
5. [add-in/modules/README.md](add-in/modules/README.md)

For specific behavior, prefer focused docs instead of guessing:

- Slide flow: [instructions/SLIDE_NAVIGATION_LOGIC.md](instructions/SLIDE_NAVIGATION_LOGIC.md)
- Question timer: [instructions/QUESTION_TIMER_LOGIC.md](instructions/QUESTION_TIMER_LOGIC.md)
- Dynamic tags/buttons: [instructions/DYNAMIC_BUTTONS_TAGS_GUIDE.md](instructions/DYNAMIC_BUTTONS_TAGS_GUIDE.md)
- Dashboard target behavior: [dashboard/SYSTEM_SPEC.md](dashboard/SYSTEM_SPEC.md)
- Known backend bottlenecks: [srv/BOTTLENECK_ANALYSIS.md](srv/BOTTLENECK_ANALYSIS.md)

## 2) Reliable Dev Commands

Use existing workspace tasks when available:

- Install all dependencies: `install: ALL`
- Start main stack: `start: ALL`
- Optional simulator start: `start: simulator (port 3001)`

Script-level commands (from each folder):

- Python services: `./install.sh` then `./start.sh`
- React apps (`game`, `admin`, `dashboard`, `simulators/game.sim`): `./install.sh` (or `npm ci` in simulator) then `./start.sh`

Default local ports:

- `srv-lb`: 5000
- `srv`: 5001
- `game`: 3003
- `admin`: 3002
- `dashboard`: 5010
- `simulators/game.sim`: 3001

## 3) System Boundaries (Do Not Blur)

- `srv-lb` resolves Game PIN -> target `srv` and tracks server health/state.
- `srv` hosts game sessions and WebSocket events.
- `game` and `admin` resolve via LB and then communicate with assigned `srv`.
- `dashboard` is ops-facing and calls LB admin endpoints directly.
- `add-in` orchestrates PowerPoint-side game flow and content updates.

## 4) Repo Conventions That Matter

- Game PIN is the primary live-session identifier across services.
- Keep backend endpoints compatible with the normalized response contract (`status`, `message`, payload).
- In `srv` (Quart + asyncio), avoid blocking calls on hot paths.
- Keep Vite `strictPort` behavior intact unless explicitly required otherwise.
- Preserve existing multilingual/RTL behavior where already implemented.

## 5) Change Guidelines for Agents

- Make minimal, targeted edits; avoid broad refactors unless requested.
- Update docs when behavior changes, linking the most relevant instruction file.
- Validate changes in the smallest affected surface first (service/app you touched).
- If you modify LB or session lifecycle behavior, verify end-to-end flow against:
  - [instructions/GAME_START_FLOW.md](instructions/GAME_START_FLOW.md)
  - [instructions/INITIAL_GAME_LOAD_FLOW.md](instructions/INITIAL_GAME_LOAD_FLOW.md)

## 6) Known Pitfalls

- Top-level README contains legacy descriptions in places; defer to service-level READMEs and `instructions/*.md` for current behavior.
- `dashboard` uses direct LB admin APIs (not the same proxy pattern as `game`/`admin`).
- Performance-sensitive backend areas are already documented in [srv/BOTTLENECK_ANALYSIS.md](srv/BOTTLENECK_ANALYSIS.md); consult before touching connection/session fan-out logic.
