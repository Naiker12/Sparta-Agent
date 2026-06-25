import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppShell } from './components/layout/AppShell'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
)
