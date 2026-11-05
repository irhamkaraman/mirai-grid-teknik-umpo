import React from 'react'
import ReactDOM from 'react-dom/client'
import Alpine from 'alpinejs'
import App from './App.jsx'
import './index.css'

// Initialize Alpine.js globally
window.Alpine = Alpine
Alpine.start()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
