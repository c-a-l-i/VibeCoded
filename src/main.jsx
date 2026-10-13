import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import './display.js'
import { initLang } from './i18n/index.js'
import App from './App.jsx'

// Load the player's language first so the page never flashes in English.
initLang().finally(() =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
