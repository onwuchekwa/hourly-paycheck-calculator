import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { FirebaseSetupRequired } from './components/FirebaseSetupRequired'
import { isFirebaseReady } from './lib/firebase-config'

registerSW({ immediate: true })

const root = createRoot(document.getElementById('root')!)

if (!isFirebaseReady()) {
  root.render(<FirebaseSetupRequired />)
} else {
  const { default: App } = await import('./App.tsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
