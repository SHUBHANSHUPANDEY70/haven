import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import POS from './pages/POS'
import Dashboard from './pages/Dashboard'

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
