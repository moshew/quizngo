import React, { useEffect } from 'react'
import { useRoute, navigate } from './router.jsx'
import { authStore, bootstrapAuth } from './state/authStore.js'
import { useI18n } from './i18n/index.js'
import { ToastHost } from './components/Toast.jsx'
import LoginScreen from './screens/LoginScreen.jsx'
import HomeScreen from './screens/HomeScreen.jsx'
import EditorScreen from './screens/EditorScreen.jsx'
import PreviewScreen from './screens/PreviewScreen.jsx'

function FullscreenLoader() {
  const { t } = useI18n()
  return (
    <div className="brand-bg center" style={{ height: '100%' }}>
      <div className="col center gap-16 fade-in">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="QuizNGO" style={{ width: 200, filter: 'drop-shadow(0 8px 0 rgba(0,0,0,.22))' }} />
        <div className="row gap-12" style={{ color: '#fff', fontWeight: 600 }}>
          <span className="spinner" style={{ borderTopColor: '#FFD400' }} />
          {t('common.loading')}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const status = authStore.useStore((s) => s.status)
  useI18n() // re-render on language change

  useEffect(() => { bootstrapAuth() }, [])

  useEffect(() => {
    if (status === 'anon' && route.name !== 'login') navigate('/login', { replace: true })
    if (status === 'authed' && route.name === 'login') navigate('/', { replace: true })
  }, [status, route.name])

  let screen = null
  if (status === 'loading') {
    screen = <FullscreenLoader />
  } else if (status === 'anon') {
    screen = <LoginScreen />
  } else {
    switch (route.name) {
      case 'editor': screen = <EditorScreen key={route.params.id} quizId={route.params.id} />; break
      case 'preview': screen = <PreviewScreen key={route.params.id} quizId={route.params.id} />; break
      case 'home': screen = <HomeScreen />; break
      default: screen = <HomeScreen />
    }
  }

  return (
    <>
      {screen}
      <ToastHost />
    </>
  )
}
