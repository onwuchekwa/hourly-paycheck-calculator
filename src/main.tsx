import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { FirebaseSetupRequired } from './components/FirebaseSetupRequired'
import { isFirebaseReady } from './lib/firebase-config'

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
