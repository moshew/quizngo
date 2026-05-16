/* global React, Phone, StatusBar, Dots, Triangle, Diamond, Circle, Square, LangPill, ANS_COLORS */

// ─── QuizNGO · MAGENTA PARTY ────────────────────────────────────────
// 11 player-facing screens. Hardcoded magenta palette — when porting
// to your codebase, lift these values to design tokens / theme vars.
//
// Layout language: "chunky 3D" — every interactive surface has
//   • 3px solid INK border
//   • flat color fill
//   • hard 6px-down ink-colored shadow (no blur) → reads as a 3D button
//   • 18-22px corner radius
//   • Bricolage Grotesque 800 for display text, Plus Jakarta Sans for UI

// ─── Design tokens ──────────────────────────────────────────────────
const TOKENS = {
  // Background gradients (one per game state)
  bgIdle:      "linear-gradient(160deg, #6B2BFF 0%, #B620C9 60%, #FF2E93 110%)",
  bgWaiting:   "linear-gradient(160deg, #2B1A6B 0%, #4A23B8 60%, #6B2BFF 110%)",
  bgWin:       "linear-gradient(160deg, #00B36B 0%, #2BD68A 60%, #B6FF3C 110%)",
  bgLose:      "linear-gradient(160deg, #1A0F2E 0%, #3A1659 60%, #FF2E93 110%)",
  bgTimeout:   "linear-gradient(160deg, #2A1F4A 0%, #5A3F8A 60%, #FFD400 130%)",
  bgDisconnect:"linear-gradient(160deg, #1a0a2e 0%, #2a1444 100%)",

  // Brand colors
  primary:    "#FFD400",   // yellow — CTAs, highlights, score
  secondary:  "#B6FF3C",   // lime — secondary CTAs, success accents
  danger:     "#FF2E93",   // pink — wrong answers, disconnect
  warn:       "#FFD400",   // same as primary (timeout state)
  ink:        "#1a0a2e",   // near-black purple — borders, shadows, text-on-light
  text:       "#fff",      // text on dark background
  chipBg:     "rgba(0,0,0,0.25)",
  correctIco: "#00B36B",   // green checkmark stroke

  // Type
  fontDisplay: "'Bricolage Grotesque', system-ui, sans-serif",
  fontUi:      "'Plus Jakarta Sans', system-ui, sans-serif",

  // Border / shadow
  borderInk:   "3px solid #1a0a2e",
  // hard 3D shadow + soft drop, generated as a function so colors stay clean
  shadow3d:    "0 6px 0 #1a0a2e, 0 8px 14px rgba(0,0,0,0.18)",
  shadow3dSm:  "0 4px 0 #1a0a2e",
  shadow3dLg:  "0 10px 0 #1a0a2e, 0 18px 30px rgba(0,0,0,0.3)",
};

// Reusable shell — the phone-frame container plus confetti dots.
function Shell({ children, bg }) {
  return (
    <Phone bg={bg || TOKENS.bgIdle} ring={TOKENS.ink} padded={false}>
      <div style={{ fontFamily: TOKENS.fontUi, color: TOKENS.text, height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
        <StatusBar />
        {/* Decorative confetti — purely cosmetic, fixed positions */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 60,  left: 30,  width: 8,  height: 8,  borderRadius: "50%", background: TOKENS.primary,   opacity: 0.9 }} />
          <div style={{ position: "absolute", top: 140, right: 25, width: 12, height: 12, borderRadius: 3,    background: TOKENS.secondary, transform: "rotate(15deg)" }} />
          <div style={{ position: "absolute", bottom: 100, left: 18, width: 10, height: 10,                    background: TOKENS.primary,   transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", top: 210, left: 50, width: 6,  height: 6,  borderRadius: "50%", background: "#fff",            opacity: 0.5 }} />
          <div style={{ position: "absolute", bottom: 180, right: 40, width: 14, height: 14, borderRadius: "50%", background: TOKENS.secondary, opacity: 0.7 }} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 22px 22px", position: "relative", zIndex: 2 }}>
          {children}
        </div>
      </div>
    </Phone>
  );
}

// ─── 01 · PIN entry ─────────────────────────────────────────────────
function MagentaPin() {
  return (
    <Shell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
        <img src="assets/logo.png" alt="QuizNGO" style={{
          width: 240, maxWidth: "92%", height: "auto",
          filter: "drop-shadow(0 8px 0 rgba(0,0,0,0.22)) drop-shadow(0 14px 28px rgba(0,0,0,0.32))",
        }} />
        <div style={{ width: "100%", textAlign: "center" }}>
          <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 13, fontWeight: 700, color: TOKENS.primary, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Game PIN</div>
          <div style={{
            width: "100%", padding: "16px 12px",
            background: "#fff", borderRadius: 20, color: TOKENS.ink,
            fontFamily: TOKENS.fontDisplay, fontWeight: 800,
            fontSize: 32, letterSpacing: 6, textAlign: "center",
            boxShadow: TOKENS.shadow3d, border: TOKENS.borderInk,
          }}>
            321&nbsp;<span style={{ color: "rgba(26,10,46,0.25)" }}>·&nbsp;·&nbsp;·</span>
          </div>
        </div>
        <button style={{
          width: "100%", padding: 14,
          background: TOKENS.primary, color: TOKENS.ink,
          border: TOKENS.borderInk, borderRadius: 20,
          fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 18, letterSpacing: 0.5,
          boxShadow: TOKENS.shadow3d, cursor: "pointer",
          opacity: 0.55,   // disabled until 6 digits entered
        }}>JOIN GAME →</button>
      </div>
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 12, paddingTop: 6 }}>
        Need a PIN? Ask your host 👀
      </div>
    </Shell>
  );
}

// ─── 02 · Name + sidekick ───────────────────────────────────────────
function MagentaName() {
  const emojis = ["🦊","🐯","🐼","🦁","🐸","🐔","🦝","🐰","🐱","🐻","🦄","🐙"];
  const sel = 5;   // demo state: row 2, col 2 selected
  return (
    <Shell>
      <LangPill bg="rgba(255,255,255,0.18)" border="rgba(255,255,255,0.3)" color="#fff" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 14 }}>
        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>
          Who are <span style={{ color: TOKENS.primary }}>YOU</span>?
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: -8 }}>Pick a name and a sidekick.</div>

        <div style={{
          background: "#fff", border: TOKENS.borderInk, borderRadius: 16,
          padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: TOKENS.shadow3d,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: TOKENS.secondary,
            border: `2px solid ${TOKENS.ink}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0,
          }}>{emojis[sel]}</div>
          <input defaultValue="Frogster" style={{
            flex: 1, border: 0, outline: 0, background: "transparent",
            color: TOKENS.ink, fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 19,
          }} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: TOKENS.primary, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>Pick a Sidekick</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
          {emojis.map((e, i) => (
            <div key={i} style={{
              aspectRatio: "1",
              background: i === sel ? TOKENS.primary : "rgba(255,255,255,0.15)",
              border: i === sel ? TOKENS.borderInk : "2px solid rgba(255,255,255,0.25)",
              borderRadius: 12, fontSize: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: i === sel ? TOKENS.shadow3dSm : "none",
              cursor: "pointer",
            }}>{e}</div>
          ))}
        </div>

        <button style={{
          width: "100%", marginTop: "auto", padding: 13,
          background: TOKENS.secondary, color: TOKENS.ink,
          border: TOKENS.borderInk, borderRadius: 20,
          fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 17,
          boxShadow: TOKENS.shadow3d, cursor: "pointer",
        }}>LET'S GO! 🚀</button>
      </div>
    </Shell>
  );
}

// ─── 03 · Lobby (waiting for game to start) ─────────────────────────
function MagentaLobby() {
  return (
    <Shell bg={TOKENS.bgWaiting}>
      <LangPill bg="rgba(255,255,255,0.18)" border="rgba(255,255,255,0.3)" color="#fff" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
        <div style={{
          width: 120, height: 120, borderRadius: 28,
          background: TOKENS.primary, border: `4px solid ${TOKENS.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 64,
          boxShadow: TOKENS.shadow3dLg,
          animation: "qng-bounce 1.4s ease-in-out infinite",
        }}>🐸</div>
        <style>{`@keyframes qng-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>

        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 34, fontWeight: 800, color: "#fff", marginTop: 4 }}>Frogster</div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "#fff", color: TOKENS.ink,
          padding: "9px 18px", borderRadius: 28, border: TOKENS.borderInk,
          fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: 14,
          boxShadow: TOKENS.shadow3d, marginTop: 4,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: TOKENS.secondary }} />
          You're in!
        </div>

        <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: 8 }}>
          Waiting for the game <Dots color={TOKENS.primary} />
        </div>

        <div style={{
          marginTop: 10, padding: "5px 12px", borderRadius: 18,
          background: TOKENS.chipBg, fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600,
        }}>👥 24 players ready</div>
      </div>
    </Shell>
  );
}

// ─── 04 · Question / Answer-picking ─────────────────────────────────
// Props: time (number, seconds left), urgent (bool — flips timer red+pulse).
function MagentaAnswer({ urgent = false, time = 24 }) {
  const A = ANS_COLORS;
  const tile = (color, glow, shape, label) => (
    <div style={{
      borderRadius: 18, background: color,
      border: TOKENS.borderInk,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 6, position: "relative",
      boxShadow: `0 6px 0 ${TOKENS.ink}, 0 0 24px ${glow}`,
      cursor: "pointer",
    }}>
      {shape}
      <div style={{ position: "absolute", top: 6, left: 8, fontFamily: TOKENS.fontDisplay, fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>{label}</div>
    </div>
  );
  return (
    <Phone bg={TOKENS.ink} ring={TOKENS.ink} padded={false}>
      <div style={{ fontFamily: TOKENS.fontUi, height: "100%", display: "flex", flexDirection: "column", padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px", color: "#fff" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px",
            background: "rgba(255,255,255,0.15)", borderRadius: 28,
            fontSize: 11, fontWeight: 700,
          }}>
            <span>Q</span>
            <span style={{ fontFamily: TOKENS.fontDisplay, fontWeight: 800 }}>3 / 12</span>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 16px", borderRadius: 28,
            background: urgent ? TOKENS.danger : TOKENS.primary,
            color: TOKENS.ink, border: TOKENS.borderInk,
            fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 20,
            boxShadow: TOKENS.shadow3dSm,
            animation: urgent ? "qng-pop-pulse 0.7s ease-in-out infinite" : "none",
          }}>
            <span style={{ fontSize: 13 }}>⏱</span>{time}
          </div>
        </div>
        <style>{`@keyframes qng-pop-pulse{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.08) rotate(-2deg)}}`}</style>

        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 8 }}>
          {tile(A.red,    "rgba(231,76,60,0.45)",  <Triangle size={52} />,                "1")}
          {tile(A.blue,   "rgba(52,152,219,0.45)", <Diamond  size={48} />,                "2")}
          {tile(A.yellow, "rgba(241,196,15,0.45)", <Circle   size={50} color={TOKENS.ink} />, "3")}
          {tile(A.green,  "rgba(46,204,113,0.45)", <Square   size={46} color="#fff" />,    "4")}
        </div>
      </div>
    </Phone>
  );
}

// ─── 04c · Locked-in (waiting for other players to answer) ──────────
function MagentaAnswered() {
  return (
    <Shell bg={TOKENS.bgWaiting}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
        <div style={{
          width: 130, height: 130, borderRadius: 28,
          background: ANS_COLORS.blue,    // shows the user's pick
          border: `4px solid ${TOKENS.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 0 ${TOKENS.ink}`,
          animation: "qng-bounce-slow 1.6s ease-in-out infinite",
        }}><Diamond size={64} /></div>
        <style>{`@keyframes qng-bounce-slow{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}`}</style>

        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 30, fontWeight: 800, color: "#fff" }}>Locked in!</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: 8 }}>
          Waiting for results <Dots color={TOKENS.primary} />
        </div>
        <div style={{
          marginTop: 10, fontFamily: TOKENS.fontDisplay, fontSize: 50, fontWeight: 800,
          color: TOKENS.primary, lineHeight: 1, textShadow: `0 4px 0 rgba(0,0,0,0.25)`,
        }}>17s</div>
      </div>
    </Shell>
  );
}

// ─── 05a · Result — CORRECT ─────────────────────────────────────────
function MagentaResultCorrect() {
  return (
    <Shell bg={TOKENS.bgWin}>
      <LangPill bg="rgba(0,0,0,0.2)" border="rgba(255,255,255,0.3)" color="#fff" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
        <div style={{
          width: 120, height: 120, borderRadius: 28,
          background: "#fff", border: `4px solid ${TOKENS.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 0 ${TOKENS.ink}`, transform: "rotate(-4deg)",
        }}>
          <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke={TOKENS.correctIco} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 40, fontWeight: 800, color: "#fff", lineHeight: 0.95, marginTop: 4 }}>NICE!</div>

        <div style={{
          padding: "12px 22px", borderRadius: 20,
          background: TOKENS.primary, color: TOKENS.ink,
          border: TOKENS.borderInk, boxShadow: TOKENS.shadow3d,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>+ Points</div>
          <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>850</div>
        </div>

        <div style={{ display: "flex", gap: 7, marginTop: 4 }}>
          <div style={{ padding: "6px 12px", borderRadius: 16, background: TOKENS.chipBg, color: "#fff", fontWeight: 700, fontSize: 12 }}>📈 Rank #3</div>
          <div style={{ padding: "6px 12px", borderRadius: 16, background: TOKENS.chipBg, color: "#fff", fontWeight: 700, fontSize: 12 }}>🔥 Streak ×3</div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4, fontWeight: 600 }}>Total: 2,350 pts</div>
      </div>
    </Shell>
  );
}

// ─── 05b · Result — INCORRECT ───────────────────────────────────────
function MagentaResultWrong() {
  return (
    <Shell bg={TOKENS.bgLose}>
      <LangPill bg="rgba(255,255,255,0.15)" border="rgba(255,255,255,0.25)" color="#fff" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
        <div style={{
          width: 120, height: 120, borderRadius: 28,
          background: "#fff", border: `4px solid ${TOKENS.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 0 ${TOKENS.ink}`, transform: "rotate(3deg)",
        }}>
          <svg width="62" height="62" viewBox="0 0 24 24" fill="none" stroke={TOKENS.danger} strokeWidth="4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </div>
        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1, marginTop: 4 }}>Oof!</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
          Right answer was <span style={{ color: ANS_COLORS.blue, fontWeight: 800, background: "#fff", padding: "1px 6px", borderRadius: 6 }}>◆ Diamond</span>
        </div>

        <div style={{
          padding: "12px 22px", borderRadius: 20,
          background: "rgba(255,255,255,0.1)", color: "#fff",
          border: "2px dashed rgba(255,255,255,0.3)", marginTop: 4,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.7 }}>+ Points</div>
          <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>0</div>
        </div>

        <div style={{ display: "flex", gap: 7, marginTop: 4 }}>
          <div style={{ padding: "6px 12px", borderRadius: 16, background: `${TOKENS.danger}40`, color: "#fff", fontWeight: 700, fontSize: 12 }}>📉 Rank #7</div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, fontWeight: 600 }}>Total: 1,500 pts</div>
      </div>
    </Shell>
  );
}

// ─── 05c · Result — TIMEOUT ─────────────────────────────────────────
function MagentaResultTimeout() {
  return (
    <Shell bg={TOKENS.bgTimeout}>
      <LangPill bg="rgba(255,255,255,0.15)" border="rgba(255,255,255,0.25)" color="#fff" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
        <div style={{
          width: 120, height: 120, borderRadius: 28,
          background: TOKENS.warn, border: `4px solid ${TOKENS.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 0 ${TOKENS.ink}`, fontSize: 64,
          transform: "rotate(-3deg)",
        }}>⏰</div>
        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 32, fontWeight: 800, color: "#fff", marginTop: 4 }}>TIME'S UP!</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>You didn't answer in time</div>
        <div style={{
          padding: "12px 22px", borderRadius: 20,
          background: "rgba(255,255,255,0.1)", color: "#fff",
          border: "2px dashed rgba(255,255,255,0.3)", marginTop: 4,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.7 }}>+ Points</div>
          <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>0</div>
        </div>
        <div style={{ marginTop: 6, padding: "6px 12px", borderRadius: 16, background: TOKENS.chipBg, color: "#fff", fontWeight: 700, fontSize: 12 }}>Rank #10 · 900 pts</div>
      </div>
    </Shell>
  );
}

// ─── 06 · Game over (final standing) ────────────────────────────────
function MagentaGameOver() {
  return (
    <Shell bg={TOKENS.bgWin}>
      <LangPill bg="rgba(0,0,0,0.2)" border="rgba(255,255,255,0.3)" color="#fff" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center" }}>
        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: -4 }}>🎉 Game Over 🎉</div>

        <div style={{
          width: 170, height: 170, borderRadius: 46,
          background: TOKENS.primary, border: `4px solid ${TOKENS.ink}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: `0 10px 0 ${TOKENS.ink}`, margin: "6px 0 4px",
          transform: "rotate(-3deg)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.ink, letterSpacing: 1, textTransform: "uppercase" }}>Rank</div>
          <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 90, fontWeight: 800, color: TOKENS.ink, lineHeight: 0.85 }}>#2</div>
        </div>

        <div style={{
          padding: "9px 20px", borderRadius: 18,
          background: "rgba(0,0,0,0.3)", color: "#fff",
          fontFamily: TOKENS.fontDisplay, fontSize: 20, fontWeight: 800,
        }}>3,200 pts</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>9 of 12 correct · 5 streak best</div>

        <button style={{
          width: "100%", marginTop: 12, padding: 13,
          background: "#fff", color: TOKENS.ink,
          border: TOKENS.borderInk, borderRadius: 20,
          fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 17,
          boxShadow: TOKENS.shadow3d, cursor: "pointer",
        }}>PLAY AGAIN ↻</button>
      </div>
    </Shell>
  );
}

// ─── 08 · Game ended by server (session timeout) ────────────────────
// Distinct from 05c (single-question timeout) and 07 (network drop):
// the *whole game session* was force-closed by the server because no
// activity arrived in time (host AFK, round never advanced, etc.)
function MagentaGameTimeout() {
  return (
    <Shell bg={TOKENS.bgDisconnect}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
        <div style={{
          width: 110, height: 110, borderRadius: 28,
          background: TOKENS.warn, border: `4px solid ${TOKENS.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 0 ${TOKENS.ink}`, fontSize: 52,
          transform: "rotate(-3deg)",
        }}>⌛</div>
        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 28, fontWeight: 800, color: TOKENS.warn, marginTop: 4 }}>Game Stopped!</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", maxWidth: 240, lineHeight: 1.5 }}>
          The session timed out — no one was answering.
        </div>
        <button style={{
          width: "100%", marginTop: 14, padding: 13,
          background: TOKENS.primary, color: TOKENS.ink,
          border: TOKENS.borderInk, borderRadius: 20,
          fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 17,
          boxShadow: TOKENS.shadow3d, cursor: "pointer",
        }}>BACK TO HOME</button>
      </div>
    </Shell>
  );
}

// ─── 07 · Disconnected ──────────────────────────────────────────────
function MagentaDisconnected() {
  return (
    <Shell bg={TOKENS.bgDisconnect}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
        <div style={{
          width: 110, height: 110, borderRadius: 28,
          background: TOKENS.danger, border: `4px solid ${TOKENS.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 0 ${TOKENS.ink}`, fontSize: 52,
          transform: "rotate(-3deg)",
        }}>📡</div>
        <div style={{ fontFamily: TOKENS.fontDisplay, fontSize: 28, fontWeight: 800, color: TOKENS.danger, marginTop: 4 }}>You got dropped</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", maxWidth: 220, lineHeight: 1.5 }}>
          The game server vanished. Hop back home to try again.
        </div>
        <button style={{
          width: "100%", marginTop: 14, padding: 13,
          background: TOKENS.primary, color: TOKENS.ink,
          border: TOKENS.borderInk, borderRadius: 20,
          fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: 17,
          boxShadow: TOKENS.shadow3d, cursor: "pointer",
        }}>BACK TO HOME</button>
      </div>
    </Shell>
  );
}

window.MagentaScreens = {
  MagentaPin, MagentaName, MagentaLobby,
  MagentaAnswer, MagentaAnswered,
  MagentaResultCorrect, MagentaResultWrong, MagentaResultTimeout,
  MagentaGameOver, MagentaGameTimeout, MagentaDisconnected,
  TOKENS,
};
