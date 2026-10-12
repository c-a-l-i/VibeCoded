import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import './display.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
