/* global React */

// ─── Shared helpers used by every screen ────────────────────────────
//
// IMPORTANT: this is a DESIGN reference. In your real app, port these to
// your component library / styling system — don't ship the inline styles.

// Mobile-BROWSER viewport. The game runs in a regular mobile browser
// (not as a native app), so the chrome here is a slim browser URL bar —
// NOT an iOS notch or status bar. Strip this entirely when porting:
// inside the app it's just a fullscreen page, the browser draws the bar.
window.Phone = function Phone({
  children, bg, ring = "#0a0a0a", screenBg, padded = true, dir = "ltr", url = "quizngo.com"
}) {
  return (
    <div dir={dir} style={{
      width: 320, height: 640,
      background: ring,
      borderRadius: 22,
      padding: 4,
      boxShadow: "0 28px 60px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.10)",
      position: "relative",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        height: 30, flexShrink: 0,
        background: "#e9e8e6",
        borderRadius: "18px 18px 0 0",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "0 14px",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#cfcdc8", flexShrink: 0 }} />
        <div style={{
          flex: 1, maxWidth: 200, height: 18,
          background: "#fff", borderRadius: 9,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          fontSize: 10, fontWeight: 500, color: "#666",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="#888"><path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9z"/></svg>
          {url}
        </div>
        <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>⋯</span>
      </div>
      <div style={{
        flex: 1, width: "100%",
        background: screenBg || bg,
        borderRadius: "0 0 18px 18px",
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
        padding: padded ? 22 : 0,
      }}>{children}</div>
    </div>
  );
};

// Top spacer (was a native status bar; now just preserves vertical rhythm).
window.StatusBar = function StatusBar() {
  return <div style={{ height: 6, flexShrink: 0 }} />;
};

// Animated "..." loading dots.
window.Dots = function Dots({ color = "currentColor", size = 6 }) {
  const dot = (delay) => ({
    width: size, height: size, borderRadius: "50%", background: color,
    animation: `qng-dot 1.2s ${delay}s ease-in-out infinite`,
    display: "inline-block",
  });
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <style>{`@keyframes qng-dot{0%,80%,100%{opacity:0.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
      <span style={dot(0)} /><span style={dot(0.15)} /><span style={dot(0.3)} />
    </span>
  );
};

// ─── Answer shapes — canonical Kahoot-style ─────────────────────────
window.Triangle = ({ size = 36, color = "#fff" }) =>
  <svg width={size} height={size * 0.86} viewBox="0 0 100 86"><polygon points="50,4 96,82 4,82" fill={color} /></svg>;
window.Diamond  = ({ size = 32, color = "#fff" }) =>
  <svg width={size} height={size} viewBox="0 0 100 100"><polygon points="50,4 96,50 50,96 4,50" fill={color} /></svg>;
window.Circle   = ({ size = 34, color = "#fff" }) =>
  <svg width={size} height={size} viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill={color} /></svg>;
window.Square   = ({ size = 30, color = "#fff" }) =>
  <svg width={size} height={size} viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" rx="6" fill={color} /></svg>;

// CANONICAL answer-button colors. Frozen by the brief — must match across
// the player app, host display, and everywhere else the four answers appear.
window.ANS_COLORS = {
  red:    "#e74c3c",  // ▲ Triangle
  blue:   "#3498db",  // ◆ Diamond
  yellow: "#f1c40f",  // ● Circle
  green:  "#2ecc71",  // ■ Square
};

// Language switcher pill (placeholder — wire to your i18n).
window.LangPill = function LangPill({
  color = "rgba(255,255,255,0.7)", bg = "rgba(255,255,255,0.08)", border = "rgba(255,255,255,0.15)"
}) {
  return (
    <div style={{
      position: "absolute", top: 14, right: 14, zIndex: 5,
      display: "inline-flex", alignItems: "center", gap: 6,
      background: bg, border: `1px solid ${border}`,
      color, fontSize: 11, fontWeight: 600,
      padding: "4px 10px", borderRadius: 20,
      backdropFilter: "blur(6px)",
    }}>
      <span>EN</span>
      <span style={{ opacity: 0.6 }}>▾</span>
    </div>
  );
};
