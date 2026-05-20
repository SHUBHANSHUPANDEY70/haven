import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import BillsHome from './pages/BillsHome'
import POS from './pages/POS'
import Dashboard from './pages/Dashboard'
import { wakeBackend } from './utils/api'

// Ping the backend so Render wakes up before the first order
wakeBackend()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<BillsHome />} />
        <Route path="/pos/:billId" element={<POS />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  </StrictMode>
)
