function LobbyScreen({ playerName, playerIcon }) {
  return (
    <div className="screen">
      <div className="lobby-avatar">{playerIcon}</div>
      <div className="lobby-name">{playerName}</div>
      <div className="waiting-text">
        Waiting for game to start<span className="dots"></span>
      </div>
      <div className="subtitle" style={{ fontSize: '14px', opacity: 0.5, marginTop: '20px' }}>
        You're in! Look at the screen.
      </div>
    </div>
  )
}

export default LobbyScreen
