function GameOverScreen({ results, onPlayAgain }) {
  return (
    <div className="screen">
      <div className="gameover-title">Game Over!</div>

      {results && (
        <>
          <div className="gameover-rank">#{results.rank || '?'}</div>
          <div className="subtitle">Your final rank</div>
          <div className="gameover-score">{results.cumulativeScore || 0} points</div>
        </>
      )}

      <button className="btn-primary" onClick={onPlayAgain} style={{ marginTop: '24px' }}>
        Play Again
      </button>
    </div>
  )
}

export default GameOverScreen
