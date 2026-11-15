import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/styles/globals.css'
import 'highlight.js/styles/atom-one-dark.css'
import './i18n'
import { applyFontScale } from './lib/ui-prefs'

applyFontScale()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
