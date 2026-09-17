import { api } from './client.js'

export async function listQuizzes() {
  const res = await api('/api/quizzes')
  return res.quizzes || []
}

export async function createQuiz({ title, data }) {
  const res = await api('/api/quizzes', { method: 'POST', body: { title, data } })
  return res.quiz
}

export async function getQuiz(id) {
  const res = await api(`/api/quizzes/${encodeURIComponent(id)}`)
  return res.quiz
}

export async function updateQuiz(id, { title, data, revision, force = false }) {
  const res = await api(`/api/quizzes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { title, data, revision, force },
  })
  return res.quiz
}

export async function deleteQuiz(id) {
  await api(`/api/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function duplicateQuiz(id) {
  const res = await api(`/api/quizzes/${encodeURIComponent(id)}/duplicate`, { method: 'POST' })
  return res.quiz
}
