/**
 * Plain-text question import (FR-10).
 * Format: a question line followed by up to 4 answer lines; `*` marks the correct answer;
 * a blank line separates questions. Leading numbering ("1.", "א)", "b)") is stripped.
 */
export function parseQuestionsText(text) {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length >= 3)

  const items = []
  for (const lines of blocks) {
    const [question, ...rest] = lines
    const answers = rest.slice(0, 4)
    let correct = 1
    const clean = answers.map((a, i) => {
      if (/^\*\s*/.test(a)) { correct = i + 1; return a.replace(/^\*\s*/, '') }
      return a.replace(/^[א-ד1-4a-dA-D][.)]\s*/, '')
    })
    while (clean.length < 4) clean.push('')
    items.push({ text: question.replace(/^\d+[.)]\s*/, ''), answers: clean, correctAnswer: correct })
  }
  return items
}
