# Handoff: QuizNGO · Magenta Party (player screens)

## Overview

This is the player-facing player app for **QuizNGO** — a multiplayer quiz game (Kahoot-style) that runs in the **mobile browser** (not a native app). The user joins a game with a PIN, picks a name + sidekick, then plays through a sequence of timed multiple-choice questions and lands on a final standings screen.

This bundle covers **11 screens** in the **Magenta Party** visual direction (one of four palette options that were explored). The system is "chunky 3D" — bold flat colors, hard ink-down shadows, big rounded shapes, Bricolage Grotesque display type.

## About the design files

The files in this bundle are **design references created in HTML/JSX** — prototypes that show the intended look and behavior. They are **not production code to copy verbatim**. The job is to recreate these designs in your existing codebase (React, Vue, Svelte, native, whatever you ship in) using your established patterns, component library, and styling system. If the project doesn't yet have a frontend, pick a stack that fits and implement against `tokens.css` as your starting point.

The inline-styled JSX is intentionally verbose so every value is visible. Your real components should:
- pull colors / radii / shadows / fonts from `tokens.css` (or a tokens object), not from inline literals
- replace the `<Phone>` browser-frame wrapper entirely — it's a preview-only chrome; in production these screens are fullscreen mobile-browser pages
- swap fixed-position decorative confetti dots for a reusable `<Confetti />` component, or drop them
- wire up real state (`useState` / your store / your form library) where the demo just hardcodes selected values

## Fidelity

**High-fidelity.** Pixel-perfect mockups with final colors, typography, spacing, shadows, and interactions. The dev should hit these visuals exactly. Behavior copy/text is also final unless noted.

The phone-frame chrome (URL bar, rounded outer ring) is **preview-only** — it represents the mobile browser viewport for handoff visualization. Drop it in production.

## Layout & viewport

- **Viewport target:** mobile browser, ~320–414px wide. Designs lock to a 320×640 art frame for handoff but should fluid-scale up to fill the device. Text scales relative to the screen content area, not the device.
- **Aspect:** content-area is ~320 × 610 inside the preview's browser frame. In production, content fills the full mobile browser viewport.
- **Direction:** LTR by default. Components accept a `dir` prop (`"ltr"` / `"rtl"`); RTL was tested for layout flow only.

## Screens / Views

All eleven screens live in `src/screens-magenta.jsx`, each as a standalone React component. Order below matches the in-game flow, with the three result variants between question and game-over.

### 01 · PIN entry — `MagentaPin`
- **Purpose:** Player enters the host's 6-digit Game PIN to join.
- **Layout:** Centered column. Big logo (240px wide, drop shadow) → "GAME PIN" eyebrow label → 6-digit input field rendered as a single styled card → "JOIN GAME →" CTA → footer hint.
- **Components:**
  - **Logo:** `assets/logo.png`, width 240px, max-width 92%. Two stacked drop-shadow filters: hard `0 8px 0 rgba(0,0,0,0.22)` plus blurred ambient `0 14px 28px rgba(0,0,0,0.32)`.
  - **PIN field:** white background, 3px ink border, radius 20, padding 16/12, ink text, 32px Bricolage 800, letter-spacing 6, hard 3D shadow. Demo state shows `"321 · · ·"` (3 typed of 6).
  - **CTA:** filled with `--qng-primary` (yellow), ink text, 3px ink border, radius 20, hard 3D shadow. **Disabled until 6 digits are entered** (opacity 0.55 in the demo).
  - **Footer hint:** `Need a PIN? Ask your host 👀` — 12px white/70%.
- **Behavior:** numeric input, 6 digits required; CTA disabled below 6. On valid PIN, advance to **02 · Name**. On invalid PIN, show inline error (text style: pink, 12px, below input — design not in this pass; mirror the field-level error pattern from your codebase).

### 02 · Name + sidekick — `MagentaName`
- **Purpose:** Player picks a display name and an emoji "sidekick" (avatar).
- **Layout:** Title row (top) → name input row → "Pick a Sidekick" label → 4×3 emoji grid → bottom CTA.
- **Components:**
  - **Title:** `Who are YOU?` — 28px Bricolage 800, "YOU" colored `--qng-primary`.
  - **Name input:** white card with selected sidekick chip on the left (44px lime square with 2px ink border) and a text input on the right (Bricolage 800, 19px, ink). The chip updates live as the user picks.
  - **Sidekick grid:** 12 emojis in 4 cols × 3 rows, gap 7px. Default tiles are translucent white (`rgba(255,255,255,0.15)`). Selected tile fills with `--qng-primary`, gets a 3px ink border + 4px-down ink shadow.
  - **CTA:** `LET'S GO! 🚀` — filled with `--qng-secondary` (lime), otherwise identical button shape.
- **Demo emoji set:** `🦊 🐯 🐼 🦁 🐸 🐔 🦝 🐰 🐱 🐻 🦄 🐙` — feel free to replace, but keep 12 across 4×3.
- **Behavior:** Name required (1–16 chars). Sidekick tap selects the tile and updates the input chip. On CTA, advance to **03 · Lobby**.

### 03 · Lobby — `MagentaLobby`
- **Purpose:** "You're in" — waiting for the host to start the game.
- **Layout:** Single centered column. Big rounded sidekick tile (bouncing) → username display → "you're in" pill → loading line → player count chip.
- **Background:** `--qng-bg-waiting` (cooler purple gradient, lower energy than idle).
- **Components:**
  - **Sidekick tile:** 120×120, radius 28, filled with `--qng-primary`, 4px ink border, large 3D shadow (`shadow-3d-lg`). 64px emoji centered. Bounces vertically (`qng-bounce`, 1.4s ease-in-out infinite, ±10px).
  - **Username:** Bricolage 800, 34px, white.
  - **You're in pill:** white card, 3px ink border, ink text, dot indicator in `--qng-secondary`, 9/18 padding.
  - **Loading line:** white/85% body text + animated `<Dots>` in primary yellow.
  - **Players-ready chip:** `--qng-chip-bg`, 11px, copy: `👥 24 players ready` (live count).
- **Behavior:** Subscribes to host events. On "game started" → **04 · Question**. On host kick / network drop → **07 · Disconnected**.

### 04 · Question — `MagentaAnswer`
- **Purpose:** The actual answer-picking screen during a question.
- **Props:** `time` (number, seconds remaining) · `urgent` (bool — when ≤ 3s, flips the timer chip).
- **Layout:** Solid ink background (no gradient — the question screen is the only solid-bg screen, to maximize answer-tile contrast). Top row: question number chip (left) + timer chip (right). Below: 2×2 grid of answer tiles filling the remaining height.
- **Components:**
  - **Question chip:** `Q 3 / 12` — translucent white pill.
  - **Timer chip:** filled with `--qng-primary` normally; when `urgent`, fills with `--qng-danger` and runs `qng-pop-pulse` (0.7s, scales 1→1.08, rotates ±2°).
  - **Answer tiles** (canonical brief colors — never theme):
    | # | Color    | Hex     | Shape        |
    |---|----------|---------|--------------|
    | 1 | red      | `#e74c3c` | ▲ Triangle  |
    | 2 | blue     | `#3498db` | ◆ Diamond   |
    | 3 | yellow   | `#f1c40f` | ● Circle (ink-filled — yellow needs ink shape for AA contrast) |
    | 4 | green    | `#2ecc71` | ■ Square    |
    Each tile: 18 radius, 3px ink border, hard 6px-down ink shadow + 24px colored glow at 45% opacity. Tile shows the shape glyph centered + a small `1`/`2`/`3`/`4` in the top-left corner.
- **Behavior:** Tap a tile → transition to **04c · Locked-in** (or, if you choose, fade non-selected tiles to ~30% opacity for ~250ms before transitioning). Timer ticks once per second. Reaching `0` → **05c · Timeout**.

### 04c · Locked-in — `MagentaAnswered`
- **Purpose:** The user has answered; waiting for the rest of the players (or for the timer to hit 0).
- **Background:** `--qng-bg-waiting`.
- **Components:**
  - **Pick echo tile:** 130×130, radius 28, filled with the **answer color the user chose** (demo: `ANS_COLORS.blue`), 4px ink border, ink shadow. Houses a 64px shape glyph that matches the choice. Animates `qng-bounce-slow` (1.6s, ±8px + ±2° rotation).
  - **Headline:** `Locked in!` — Bricolage 800, 30px, white.
  - **Status line:** `Waiting for results` + animated dots in primary.
  - **Mini timer:** seconds remaining as a giant number — Bricolage 800, 50px, primary yellow with hard ink text shadow.
- **Behavior:** when results arrive, advance to **05a / 05b**.

### 05a · Result · Correct — `MagentaResultCorrect`
- **Background:** `--qng-bg-win` (green→lime).
- **Components:**
  - **Hero icon tile:** 120×120, white, 4px ink border, ink shadow, rotated `-4°`. Houses a 68px green checkmark stroke (`--qng-correct`).
  - **Headline:** `NICE!` — Bricolage 800, 40px, white.
  - **Points capsule:** filled with `--qng-primary`, ink text, 3D shadow. Eyebrow `+ POINTS` (10/uppercase) over a giant `850` (Bricolage 800, 36).
  - **Stat chips:** rank (`📈 Rank #3`) and streak (`🔥 Streak ×3`), `--qng-chip-bg`.
  - **Total line:** `Total: 2,350 pts` — 12px white/85%.

### 05b · Result · Incorrect — `MagentaResultWrong`
- **Background:** `--qng-bg-lose` (purple→pink).
- **Components:**
  - **Hero icon tile:** white, rotated `+3°`, with a 62px **pink "X"** (`--qng-danger` stroke).
  - **Headline:** `Oof!` — 34px.
  - **Correct-answer pointer:** `Right answer was [◆ Diamond]` — the colored chip uses the actual canonical blue (`--qng-answer-blue`) on a white pill so users see exactly which tile was right.
  - **Points capsule:** dashed white border (no fill) — visually communicates "no points awarded". Shows `0`.
  - **Rank chip:** `📉 Rank #7` on a 25%-alpha danger background.
  - **Total line.**

### 05c · Result · Timeout — `MagentaResultTimeout`
- **Background:** `--qng-bg-timeout`.
- **Components:**
  - **Hero icon tile:** filled with `--qng-warn` (yellow), rotated `-3°`, 64px ⏰ emoji.
  - **Headline:** `TIME'S UP!` — Bricolage 800, 32px.
  - **Subtext:** `You didn't answer in time` — 12px white/80%.
  - **Points capsule:** dashed white border, `0` pts.
  - **Rank chip:** `Rank #10 · 900 pts` on chip-bg.

### 06 · Game over — `MagentaGameOver`
- **Background:** `--qng-bg-win` (always celebratory regardless of rank — keep it positive).
- **Layout:** Tiny eyebrow `🎉 Game Over 🎉` → giant rank tile (the hero) → total points capsule → meta line → "Play Again" CTA.
- **Components:**
  - **Rank tile:** **170×170**, radius 46, filled with `--qng-primary`, 4px ink border, 10px hard ink shadow, rotated `-3°`. Inside: `RANK` eyebrow (13px, ink, uppercase) over giant `#2` (Bricolage 800, **90px**, line-height 0.85).
  - **Points capsule:** dark translucent (`rgba(0,0,0,0.3)`), white Bricolage 800 20px, e.g. `3,200 pts`.
  - **Meta line:** `9 of 12 correct · 5 streak best`.
  - **CTA:** `PLAY AGAIN ↻` — white fill, ink text, ink border, 3D shadow.
- **Behavior:** CTA returns to **01 · PIN entry** (or to a stored "rejoin same game" flow if your backend supports it).

### 07 · Disconnected — `MagentaDisconnected`
- **Background:** `--qng-bg-disconnect` (deep ink → near-black).
- **Components:**
  - **Hero icon tile:** 110×110, filled with `--qng-danger`, 4px ink border, rotated `-3°`, 52px 📡 emoji.
  - **Headline:** `You got dropped` — 28px Bricolage 800, **danger pink** (the only screen where the headline uses the danger color).
  - **Body copy:** `The game server vanished. Hop back home to try again.` — 13px, white/70%, max-width ~220px, line-height 1.5.
  - **CTA:** `BACK TO HOME` — primary yellow.
- **Trigger:** WebSocket close, host kick, or 5s ping timeout.

## Interactions & Behavior

### Navigation map
```
01 PIN ──valid──▶ 02 Name ──confirm──▶ 03 Lobby ──host_start──▶ 04 Question
                                                                  │
                              ┌────── tap answer ─────────────────┤
                              ▼                                   ▼
                       04c Locked-in ◀──────────  timer hits 0 ──▶ 05c Timeout
                              │                                   │
                              ▼                                   │
                  result event from server                        │
                              │                                   │
              ┌───────────────┴───────────────┐                   │
              ▼                               ▼                   │
        05a Correct                     05b Incorrect             │
              │                               │                   │
              └─────► next question ◀─────────┘◀──────────────────┘
                              │
                       (after Q12)
                              ▼
                       06 Game Over ──tap "PLAY AGAIN"──▶ 01 PIN

   At ANY point: WebSocket close / host kick → 07 Disconnected
```

### Animations (already defined in `tokens.css`)
| Name              | Used by                         | Duration | Easing            | Detail                                                      |
|-------------------|---------------------------------|----------|-------------------|-------------------------------------------------------------|
| `qng-bounce`      | Lobby sidekick tile             | 1.4s     | ease-in-out, ∞    | Translate Y 0 → -10px → 0                                   |
| `qng-bounce-slow` | Locked-in pick tile             | 1.6s     | ease-in-out, ∞    | Translate Y ±8px + rotate ±2°                               |
| `qng-pop-pulse`   | Question timer when `urgent`    | 0.7s     | ease-in-out, ∞    | Scale 1 → 1.08 + rotate ±2°. **Trigger when `time ≤ 3`**    |
| `qng-dot`         | Loading dots                    | 1.2s     | ease-in-out, ∞    | 3 dots, staggered 0 / 0.15s / 0.3s                          |

Don't add page transition animations beyond a 200ms cross-fade between screens. The screens are loud enough — over-animating gets noisy fast.

### Press states
The 3D button look IS the affordance. On press:
- shift the element down 4px (`transform: translateY(4px)`)
- collapse the hard shadow from `--qng-shadow-3d` to `--qng-shadow-3d-sm`
- transition over 80ms

Apply this to every element with the chunky 3D shadow: PIN input, both CTAs on every screen, sidekick tiles when selecting, answer tiles when picking.

### Disabled state
PIN's "JOIN GAME" CTA is disabled until 6 digits are entered. Style: `opacity: 0.55`, `cursor: not-allowed`, no press effect. Do not change the colors.

### Form validation
- **PIN:** 6 numeric digits exactly. Strip non-digits on input. Show field-level error on invalid PIN response (use your existing field-error pattern; copy: `Couldn't find that game. Check your PIN?`).
- **Name:** 1–16 chars, trim whitespace. Reject empty.

## State / Data

Each screen is essentially stateless once mounted; transitions are driven by:
1. **Local form state** — PIN digits, name string, selected sidekick index.
2. **Game socket state** — `connected | lobby | answering | results | gameOver | disconnected` plus per-question payload (`{questionNum, totalQuestions, secondsLeft, options}`) and per-result payload (`{correct: bool, pointsAwarded, totalPoints, rank, streakCount, correctAnswerIdx}`).

The result screens (`05a` / `05b` / `05c`) all consume the same result payload — choose which screen to render based on `(timedOut, correct)`.

## Design Tokens

All values live in `src/tokens.css` as CSS custom properties. The full set:

### Backgrounds (per state)
| Token                 | Value                                                                                  | Used on                   |
|-----------------------|----------------------------------------------------------------------------------------|---------------------------|
| `--qng-bg-idle`       | `linear-gradient(160deg, #6B2BFF 0%, #B620C9 60%, #FF2E93 110%)`                       | PIN, Name                 |
| `--qng-bg-waiting`    | `linear-gradient(160deg, #2B1A6B 0%, #4A23B8 60%, #6B2BFF 110%)`                       | Lobby, Locked-in          |
| `--qng-bg-win`        | `linear-gradient(160deg, #00B36B 0%, #2BD68A 60%, #B6FF3C 110%)`                       | Correct, Game Over        |
| `--qng-bg-lose`       | `linear-gradient(160deg, #1A0F2E 0%, #3A1659 60%, #FF2E93 110%)`                       | Incorrect                 |
| `--qng-bg-timeout`    | `linear-gradient(160deg, #2A1F4A 0%, #5A3F8A 60%, #FFD400 130%)`                       | Timeout                   |
| `--qng-bg-disconnect` | `linear-gradient(160deg, #1a0a2e 0%, #2a1444 100%)`                                    | Disconnected              |
| `--qng-bg-question`   | `#1a0a2e` (solid)                                                                       | Question (only solid bg)  |

### Brand
| Token              | Value     | Use                                            |
|--------------------|-----------|------------------------------------------------|
| `--qng-primary`    | `#FFD400` | Yellow — primary CTA, highlights, score        |
| `--qng-secondary`  | `#B6FF3C` | Lime — secondary CTA, "you're in" dot          |
| `--qng-danger`     | `#FF2E93` | Pink — wrong-answer X, disconnect headline     |
| `--qng-warn`       | `#FFD400` | Timeout (alias of primary)                     |
| `--qng-ink`        | `#1a0a2e` | Borders, shadows, dark text                    |
| `--qng-text`       | `#ffffff` | Text on dark gradients                         |
| `--qng-correct`    | `#00B36B` | Green checkmark stroke                         |

### Answer-button colors — **CANONICAL, DO NOT THEME**
| Token                  | Value     | Shape       |
|------------------------|-----------|-------------|
| `--qng-answer-red`     | `#e74c3c` | ▲ Triangle  |
| `--qng-answer-blue`    | `#3498db` | ◆ Diamond   |
| `--qng-answer-yellow`  | `#f1c40f` | ● Circle    |
| `--qng-answer-green`   | `#2ecc71` | ■ Square    |

These four hex values are part of the brief and must match the host display + every other surface where the four answers appear. Don't substitute them with your design-system reds/greens.

### Type
- `--qng-font-display` — `Bricolage Grotesque`. Weights used: 700, 800.
- `--qng-font-ui` — `Plus Jakarta Sans`. Weights used: 500, 600, 700, 800.
- Both load from Google Fonts — see the `<link>` tag in `preview.html`.

Sizes (used most): 90 / 40 / 36 / 34 / 32 / 30 / 28 / 19 / 17 / 14 / 13 / 12 / 11 / 10.

### Shape
| Token                    | Value | Use                                |
|--------------------------|-------|------------------------------------|
| `--qng-radius-card`      | 20    | CTAs, score capsules, PIN input    |
| `--qng-radius-tile`      | 18    | Answer tiles                       |
| `--qng-radius-input`     | 16    | Name input wrapper                 |
| `--qng-radius-emoji`     | 12    | Sidekick tiles                     |
| `--qng-radius-pill`      | 28    | Chips, timer pill, "you're in"     |
| `--qng-radius-icon-tile` | 28    | Big icon hero tiles                |

### Borders
- `--qng-border-ink` — `3px solid #1a0a2e`. Default for buttons, chips, inputs.
- `--qng-border-ink-4` — `4px solid #1a0a2e`. Used on the big hero icon tiles.

### Shadows
- `--qng-shadow-3d-sm`: `0 4px 0 #1a0a2e`
- `--qng-shadow-3d`:    `0 6px 0 #1a0a2e, 0 8px 14px rgba(0,0,0,0.18)`
- `--qng-shadow-3d-lg`: `0 10px 0 #1a0a2e, 0 18px 30px rgba(0,0,0,0.30)`

The point of the hard, no-blur ink shadow is to read as a stamped 3D button. Don't soften it.

## Assets

- **`assets/logo.png`** — QuizNGO logomark used on the PIN screen. Source asset, transparent PNG.
- **Emoji** — system emoji (no custom asset needed). The 12-emoji sidekick set is `🦊 🐯 🐼 🦁 🐸 🐔 🦝 🐰 🐱 🐻 🦄 🐙`. Replace freely.
- **No icon set** — the few icons used (📡, ⏰, 🎉, 🔥, 📈, 📉, 👥, 👀, 🚀, ↻, →) are emoji. If you swap to an icon set, keep them at the displayed sizes.

## Files

```
design_handoff_quizngo_magenta/
├─ README.md                        ← this file
├─ preview.html                     ← open in a browser to see all 11 screens
├─ assets/
│  └─ logo.png
└─ src/
   ├─ tokens.css                    ← all design tokens as CSS custom properties
   ├─ screens-shared.jsx            ← Phone shell + Dots + answer shapes + ANS_COLORS
   └─ screens-magenta.jsx           ← all 11 screen components
```

To preview locally: open `preview.html` in any modern browser (no build step). Live-reloading is fine — Babel-standalone transpiles the JSX in the page.

## Things the dev should ask before starting

1. **Real backend contract** — what does the WebSocket payload for "question" / "result" / "game_over" actually look like? The screens assume specific fields (`questionNum`, `secondsLeft`, `correct`, `pointsAwarded`, `rank`, `streakCount`, `correctAnswerIdx`).
2. **i18n** — the language pill is a placeholder. Wire it to your existing i18n switcher and confirm RTL flow.
3. **Identity** — does name/sidekick persist across games on the same device? The demo just hardcodes `Frogster` + 🐔.
4. **Sound** — none specified. The chunky-3D + bouncing UI invites sound; ask product whether to add a small SFX kit (tap, correct, incorrect, timeout, game-over fanfare).
5. **Accessibility** — large hit targets are good (every answer tile is ≥ 100px tall). Confirm contrast for text-on-yellow capsules in your accessibility audit; the ink-on-yellow combo passes AA but is right at the edge for small captions.
