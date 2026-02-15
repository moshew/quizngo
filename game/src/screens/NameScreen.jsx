import { useState } from 'react'
import { USER_ICONS } from '../icons'

function NameScreen({ onJoin, error, loading }) {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState(USER_ICONS[0])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      onJoin(name.trim(), selectedIcon)
    }
  }

  return (
    <form className="screen" onSubmit={handleSubmit}>
      <div className="title">Choose a name</div>

      <div style={{ fontSize: '64px', marginBottom: '8px' }}>{selectedIcon}</div>

      <input
        className="name-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your nickname"
        maxLength={20}
        autoFocus
      />

      <div className="subtitle">Choose an icon</div>

      <div className="icon-grid">
        {USER_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            className={`icon-btn ${selectedIcon === icon ? 'selected' : ''}`}
            onClick={() => setSelectedIcon(icon)}
          >
            {icon}
          </button>
        ))}
      </div>

      {error && <div className="error-msg">{error}</div>}

      <button
        className="btn-primary"
        type="submit"
        disabled={!name.trim() || loading}
      >
        {loading ? 'Joining...' : "OK, let's go!"}
      </button>
    </form>
  )
}

export default NameScreen
