import React, { useEffect, useMemo, useState } from 'react'
import { useI18n, LANGUAGES } from '../i18n/index.js'
import { authStore, logout } from '../state/authStore.js'
import { navigate } from '../router.jsx'
import * as quizApi from '../api/quizzes.js'
import { createQuizFromTemplate } from '../model/templates/index.js'
import { coverQuiz } from '../model/migrate.js'
import Button, { IconButton } from '../components/Button.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import Menu, { useMenu } from '../components/Menu.jsx'
import SlideThumb from '../components/SlideThumb.jsx'
import TemplatePicker from '../components/TemplatePicker.jsx'
import { toast } from '../components/Toast.jsx'

function relativeTime(iso, t) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.round(diff / 60000)
  if (m < 1) return t('home.justNow')
  if (m < 60) return t('home.minutesAgo', { n: m })
  const h = Math.round(m / 60)
  if (h < 24) return t('home.hoursAgo', { n: h })
  return t('home.daysAgo', { n: Math.round(h / 24) })
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}

export default function HomeScreen() {
  const { t, lang, setLang } = useI18n()
  const user = authStore.useStore((s) => s.user)
  const [quizzes, setQuizzes] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('updated')
  const [picker, setPicker] = useState(false)
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(null) // quiz
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState(null) // quiz
  const [busyId, setBusyId] = useState(null)
  const cardMenu = useMenu()
  const userMenu = useMenu()

  const load = async () => {
    setError(null)
    try { setQuizzes(await quizApi.listQuizzes()) } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])

  // Covers render through the quiz's template (and get upgraded on the fly if they predate skins).
  const covers = useMemo(() => new Map((quizzes || []).map((q) => [q.id, coverQuiz(q)])), [quizzes])

  const visible = useMemo(() => {
    if (!quizzes) return []
    const q = query.trim().toLowerCase()
    const list = q ? quizzes.filter((x) => x.title.toLowerCase().includes(q)) : quizzes.slice()
    list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, lang)
      if (sort === 'created') return b.createdAt.localeCompare(a.createdAt)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return list
  }, [quizzes, query, sort, lang])

  const create = async ({ title, templateId, language }) => {
    setCreating(true)
    try {
      const data = createQuizFromTemplate({ title, templateId, language })
      const quiz = await quizApi.createQuiz({ title, data })
      toast.success(t('home.created'))
      navigate(`/edit/${quiz.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const duplicate = async (quiz) => {
    setBusyId(quiz.id)
    try { await quizApi.duplicateQuiz(quiz.id); toast.success(t('home.duplicated')); await load() } catch (err) { toast.error(err.message) } finally { setBusyId(null) }
  }

  const confirmDelete = async () => {
    const quiz = deleting
    setDeleting(null)
    setBusyId(quiz.id)
    try { await quizApi.deleteQuiz(quiz.id); toast.success(t('home.deleted')); setQuizzes((qs) => qs.filter((q) => q.id !== quiz.id)) } catch (err) { toast.error(err.message) } finally { setBusyId(null) }
  }

  const confirmRename = async () => {
    const quiz = renaming
    const title = renameValue.trim()
    setRenaming(null)
    if (!title || title === quiz.title) return
    try {
      const full = await quizApi.getQuiz(quiz.id)
      await quizApi.updateQuiz(quiz.id, { title, data: { ...full.data, title }, revision: full.revision })
      setQuizzes((qs) => qs.map((q) => (q.id === quiz.id ? { ...q, title } : q)))
    } catch (err) { toast.error(err.message) }
  }

  const cardItems = (quiz) => [
    { label: t('common.edit'), icon: 'edit', onClick: () => navigate(`/edit/${quiz.id}`) },
    { label: t('common.preview'), icon: 'monitor', onClick: () => navigate(`/preview/${quiz.id}`) },
    { label: t('home.play'), icon: 'play', disabled: true, badge: t('common.comingSoon') },
    { sep: true },
    { label: t('common.duplicate'), icon: 'copy', onClick: () => duplicate(quiz) },
    { label: t('common.rename'), icon: 'type', onClick: () => { setRenaming(quiz); setRenameValue(quiz.title) } },
    { sep: true },
    { label: t('common.delete'), icon: 'trash', danger: true, onClick: () => setDeleting(quiz) },
  ]

  return (
    <div className="home">
      <header className="home-hero brand-bg">
        <div className="home-hero-inner">
          <img className="logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="QuizNGO" />
          <div>
            <h1>{t('home.title')}</h1>
            <p>{t('home.subtitle')}</p>
          </div>
          <div className="home-hero-actions">
            <button type="button" className="btn-brand white" disabled data-tip={t('common.comingSoon')} style={{ height: 44, fontSize: 15 }}>
              <Icon name="wand" /> {t('home.aiQuiz')}
            </button>
            <button type="button" className="btn-brand" onClick={() => setPicker(true)} style={{ height: 44, fontSize: 15 }}>
              <Icon name="plus" /> {t('home.newQuiz')}
            </button>
            <button type="button" className="home-user" onClick={(e) => userMenu.open(e)}>
              <span className="avatar">{initials(user?.name)}</span>
              <span className="truncate" style={{ maxWidth: 140 }}>{user?.name}</span>
              <Icon name="chevronDown" size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="home-body">
        <div className="home-toolbar">
          <div className="input-wrap">
            <Icon name="search" />
            <input className="input" value={query} placeholder={t('home.searchPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" style={{ width: 200 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('common.sort')}>
            <option value="updated">{t('home.sortUpdated')}</option>
            <option value="created">{t('home.sortCreated')}</option>
            <option value="title">{t('home.sortTitle')}</option>
          </select>
          {quizzes && <span className="home-count">{t('home.count', { count: quizzes.length })}</span>}
        </div>

        {error && (
          <div className="empty">
            <div className="emoji">😵</div>
            <h3>{t('home.loadError')}</h3>
            <p>{error === 'networkError' ? t('common.networkError') : error}</p>
            <Button icon="refresh" onClick={load}>{t('common.retry')}</Button>
          </div>
        )}

        {!error && !quizzes && (
          <div className="quiz-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton skeleton-card" />)}</div>
        )}

        {quizzes && quizzes.length === 0 && (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="emoji">🎉</div>
            <h3>{t('home.emptyTitle')}</h3>
            <p>{t('home.emptyBody')}</p>
            <Button variant="primary" size="lg" icon="plus" onClick={() => setPicker(true)}>{t('home.emptyCta')}</Button>
          </div>
        )}

        {quizzes && quizzes.length > 0 && (
          <div className="quiz-grid">
            <button type="button" className="quiz-card-new" onClick={() => setPicker(true)}>
              <span className="plus"><Icon name="plus" size={28} /></span>
              <strong>{t('home.newQuiz')}</strong>
            </button>
            {visible.map((quiz, i) => (
              <article key={quiz.id} className="quiz-card" style={{ animationDelay: `${Math.min(i, 12) * 30}ms`, opacity: busyId === quiz.id ? 0.6 : 1 }}>
                <div className="quiz-card-thumb" onClick={() => navigate(`/edit/${quiz.id}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/edit/${quiz.id}`) }}>
                  <SlideThumb slide={covers.get(quiz.id)?.slides[0]} quiz={covers.get(quiz.id)} lazy />
                  <div className="quiz-card-overlay">
                    <Button variant="primary" icon="edit" onClick={(e) => { e.stopPropagation(); navigate(`/edit/${quiz.id}`) }}>{t('common.edit')}</Button>
                    <Button icon="monitor" onClick={(e) => { e.stopPropagation(); navigate(`/preview/${quiz.id}`) }}>{t('common.preview')}</Button>
                  </div>
                </div>
                <div className="quiz-card-body">
                  <div className="quiz-card-title">
                    <span className="truncate" title={quiz.title}>{quiz.title || t('editor.untitled')}</span>
                    <IconButton icon="moreV" label={t('common.more')} size="sm" onClick={(e) => cardMenu.open(e, quiz)} />
                  </div>
                  <div className="quiz-card-meta">
                    <span className="chip"><Icon name="film" />{t('home.slides', { count: quiz.slideCount })}</span>
                    <span className="chip"><Icon name="help" />{t('home.questions', { count: quiz.questionCount })}</span>
                    <span>·</span>
                    <span>{relativeTime(quiz.updatedAt, t)}</span>
                  </div>
                  <div className="quiz-card-footer">
                    <span className="owner"><span className="avatar">{initials(quiz.owner?.name)}</span><span className="truncate">{t('home.by', { name: quiz.owner?.name || '' })}</span></span>
                    <Button size="sm" icon="play" disabled data-tip={t('common.comingSoon')}>{t('home.play')}</Button>
                  </div>
                </div>
              </article>
            ))}
            {visible.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}><div className="emoji">🔍</div><p>{t('home.noResults')}</p></div>}
          </div>
        )}
      </div>

      {cardMenu.menu && <Menu anchor={cardMenu.menu.anchor} items={cardItems(cardMenu.menu.data)} onClose={cardMenu.close} align="end" />}
      {userMenu.menu && (
        <Menu
          anchor={userMenu.menu.anchor}
          align="end"
          onClose={userMenu.close}
          items={[
            { title: user?.email },
            ...Object.entries(LANGUAGES).map(([code, meta]) => ({ label: `${meta.flag} ${meta.nativeName}`, checked: lang === code, onClick: () => setLang(code) })),
            { sep: true },
            { label: t('common.logout'), icon: 'logout', onClick: () => logout() },
          ]}
        />
      )}

      {picker && <TemplatePicker open onClose={() => setPicker(false)} mode="create" onCreate={create} busy={creating} />}

      <Modal open={!!renaming} onClose={() => setRenaming(null)} size="sm" title={t('home.renameTitle')}
        footer={<><Button variant="ghost" onClick={() => setRenaming(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={confirmRename}>{t('common.save')}</Button></>}>
        <input className="input" autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename() }} />
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} size="sm" title={t('home.deleteTitle')}
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button><Button variant="danger" icon="trash" onClick={confirmDelete}>{t('common.delete')}</Button></>}>
        <p className="muted">{t('home.deleteBody', { title: deleting?.title })}</p>
      </Modal>
    </div>
  )
}
