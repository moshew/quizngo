import { t } from '../i18n'

function PinScreen({ gamePin, setGamePin, onSubmit, error, loading, language }) {
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
    <form className="screen" onSubmit={handleSubmit}>
      <div className="title">Kahoot!</div>
      <input
        className="pin-input"
        type="text"
        inputMode="numeric"
        value={gamePin}
        onChange={handleChange}
        placeholder={t(language, 'gamePin')}
        maxLength="7"
        autoFocus
      />
      <button
        className="btn-primary"
        type="submit"
        disabled={!isValid || loading}
      >
        {loading ? t(language, 'checking') : t(language, 'enter')}
      </button>
      {error && <div className="pin-error-strip">{error}</div>}
    </form>
  )
}

export default PinScreen
