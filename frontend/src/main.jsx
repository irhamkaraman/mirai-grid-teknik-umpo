import { initSecurityGuard } from './utils/securityGuard.js'
initSecurityGuard()

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import Alpine from 'alpinejs'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

// Initialize Alpine.js globally
window.Alpine = Alpine
Alpine.start()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary onReset={() => { window.location.href = '/dashboard' }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
