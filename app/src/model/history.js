/**
 * Undo/redo over immutable document snapshots.
 *
 * `commit(prevDoc, key)` is called with the document *before* a change. Consecutive commits with the
 * same non-null `key` inside COALESCE_MS (e.g. every frame of a drag, every keystroke) are merged into
 * one undo step: only the first "before" snapshot is kept.
 */
const COALESCE_MS = 900

export function createHistory(limit = 100) {
  let past = []
  let future = []
  let lastKey = null
  let lastTime = 0

  return {
    commit(prevDoc, key = null) {
      const now = Date.now()
      const coalesce = key && key === lastKey && now - lastTime < COALESCE_MS
      lastKey = key
      lastTime = now
      future = []
      if (coalesce) return
      past.push(prevDoc)
      if (past.length > limit) past.shift()
    },
    /** Break coalescing so the next change starts a fresh undo step. */
    breakCoalescing() { lastKey = null },
    undo(currentDoc) {
      if (!past.length) return null
      const doc = past.pop()
      future.push(currentDoc)
      lastKey = null
      return doc
    },
    redo(currentDoc) {
      if (!future.length) return null
      const doc = future.pop()
      past.push(currentDoc)
      lastKey = null
      return doc
    },
    get canUndo() { return past.length > 0 },
    get canRedo() { return future.length > 0 },
    clear() { past = []; future = []; lastKey = null },
  }
}
