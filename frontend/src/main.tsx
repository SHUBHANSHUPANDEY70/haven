import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import POS from './pages/POS'
import Dashboard from './pages/Dashboard'
import { wakeBackend } from './utils/api'

// Ping the backend immediately so Render's free tier wakes up
// before the user tries to place their first order.
wakeBackend()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<POS />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  </StrictMode>
)
