function PinScreen({ gamePin, setGamePin, onSubmit, error, loading }) {
  const isValid = gamePin.replace(/-/g, '').length === 6

  const handleChange = (e) => {
    let value = e.target.value.replace(/[^0-9-]/g, '')
    const digitsOnly = value.replace(/-/g, '')
    if (digitsOnly.length > 3) {
      value = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3, 6)
    } else {
      value = digitsOnly
    }
    setGamePin(value)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isValid) onSubmit()
  }

  return (
    <form className="qng-screen qng-screen--idle qng-pin-screen" onSubmit={handleSubmit} lang="en" dir="ltr">

      <div className="qng-screen-center">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="QuizNGO"
          className="qng-logo"
          width="845"
          height="448"
        />

        <div style={{ width: '88%', textAlign: 'center' }}>
          <div className="qng-eyebrow">Game PIN</div>
          <input
            className="qng-pin-field"
            type="text"
            inputMode="numeric"
            value={gamePin}
            onChange={handleChange}
            placeholder="· · ·  · · ·"
            maxLength="7"
            autoFocus
          />
        </div>

        <button
          className="qng-btn qng-btn--yellow"
          type="submit"
          disabled={!isValid || loading}
          style={{ width: '90%', fontSize: '32px' }}
        >
          {loading ? 'Checking...' : 'Enter'}
        </button>
      </div>

      <div className="qng-footer-hint">Need a PIN? Ask your host 👀</div>

      <div className={`qng-error-drawer${error ? ' qng-error-drawer--open' : ''}`}>
        {error}
      </div>
    </form>
  )
}

export default PinScreen
