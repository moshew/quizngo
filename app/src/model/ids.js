const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Short, URL-safe, collision-resistant id (10 chars) with an optional prefix. */
export function uid(prefix = '') {
  let id = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(10)
    crypto.getRandomValues(bytes)
    for (const b of bytes) id += ALPHABET[b % ALPHABET.length]
  } else {
    for (let i = 0; i < 10; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return prefix ? `${prefix}_${id}` : id
}
