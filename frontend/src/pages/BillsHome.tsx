import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Bill } from '../types'
import { connectPrinter, isPrinterConnected } from '../utils/printer'

const BILLS_KEY = 'haven_bills'

export function loadBills(): Bill[] {
  return JSON.parse(localStorage.getItem(BILLS_KEY) || '[]')
}

export function saveBills(bills: Bill[]) {
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills))
}

export function getBill(id: string): Bill | null {
  return loadBills().find(b => b.id === id) || null
}

export function updateBill(updated: Bill) {
  saveBills(loadBills().map(b => b.id === updated.id ? updated : b))
}

export function deleteBill(id: string) {
  saveBills(loadBills().filter(b => b.id !== id))
}

const ADMIN_PASSWORD = 'haven@chirag'

export default function BillsHome() {
  const navigate = useNavigate()
  const [bills, setBills] = useState<Bill[]>(loadBills)
  const [printerStatus, setPrinterStatus] = useState(isPrinterConnected())
  const [printerConnecting, setPrinterConnecting] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string; leaving: boolean }[]>([])

  // Refresh bills list when returning to this screen
  useEffect(() => {
    const sync = () => setBills(loadBills())
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  const addToast = (msg: string) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, leaving: false }])
    setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t)), 1800)
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2050)
  }

  const handleNewBill = () => {
    const existing = loadBills()
    // Find next available number
    const nums = existing.map(b => parseInt(b.label.replace('Bill ', '')) || 0)
    const next = nums.length === 0 ? 1 : Math.max(...nums) + 1
    const newBill: Bill = {
      id: 'bill_' + Date.now(),
      label: 'Bill ' + next,
      items: [],
      paymentMethod: 'cash',
      applyGST: false,
      createdAt: new Date().toISOString(),
    }
    const updated = [...existing, newBill]
    saveBills(updated)
    setBills(updated)
    navigate('/pos/' + newBill.id)
  }

  const handleDeleteBill = (id: string) => {
    deleteBill(id)
    setBills(loadBills())
    setDeleteConfirm(null)
    addToast('Bill deleted')
  }

  const handleConnect = async () => {
    if (printerConnecting) return
    setPrinterConnecting(true)
    const ok = await connectPrinter()
    setPrinterStatus(ok)
    setPrinterConnecting(false)
    addToast(ok ? 'Printer connected!' : 'Connection failed')
  }

  const handleDashboardClick = () => {
    setPassword('')
    setPasswordError(false)
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = () => {
    if (password === ADMIN_PASSWORD) {
      setShowPasswordModal(false)
      navigate('/admin/dashboard')
    } else {
      setPasswordError(true)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-amber-400">☕ Haven Cafe</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleConnect} disabled={printerConnecting}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              printerConnecting ? 'bg-yellow-600 cursor-wait' :
              printerStatus || isPrinterConnected() ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}>
            🖨️ {printerConnecting ? 'Scanning...' : printerStatus || isPrinterConnected() ? 'Connected' : 'Printer'}
          </button>
          <button onClick={handleDashboardClick}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium">
            📊 Dashboard
          </button>
        </div>
      </header>

      {/* Bills Grid */}
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-200">Active Bills
            {bills.length > 0 && <span className="ml-2 text-sm text-gray-500 font-normal">({bills.length} open)</span>}
          </h2>
          <button onClick={handleNewBill}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm active:scale-95 transition-all">
            + New Bill
          </button>
        </div>

        {bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <p className="text-5xl mb-4">🧾</p>
            <p className="text-lg font-medium mb-1">No active bills</p>
            <p className="text-sm">Tap "New Bill" to start taking an order</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {bills.map(bill => {
              const itemCount = bill.items.reduce((s, i) => s + i.quantity, 0)
              const subtotal = bill.items.reduce((s, i) => s + i.total, 0)
              const gst = bill.applyGST ? Math.round(subtotal * 0.05 * 100) / 100 : 0
              const total = subtotal + gst
              const age = Math.floor((Date.now() - new Date(bill.createdAt).getTime()) / 60000)

              return (
                <div key={bill.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                  {/* Card header — tap to open */}
                  <button onClick={() => navigate('/pos/' + bill.id)}
                    className="w-full p-4 text-left hover:bg-gray-700 transition-colors active:scale-[0.98]">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-base font-bold text-amber-400">{bill.label}</span>
                      <span className="text-[10px] text-gray-500">{age < 1 ? 'just now' : age + 'm ago'}</span>
                    </div>
                    {bill.items.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Empty — tap to add items</p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400 truncate mb-1">
                          {bill.items.slice(0, 3).map(i => i.name).join(', ')}
                          {bill.items.length > 3 ? ` +${bill.items.length - 3} more` : ''}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-gray-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                          <span className="text-sm font-bold text-white">₹{total.toFixed(0)}</span>
                        </div>
                        <div className="mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            bill.paymentMethod === 'cash' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
                          }`}>
                            {bill.paymentMethod === 'cash' ? '💵 Cash' : '📱 Digital'}
                          </span>
                        </div>
                      </>
                    )}
                  </button>

                  {/* Delete button */}
                  <div className="border-t border-gray-700 px-3 py-2 flex justify-end">
                    {deleteConfirm === bill.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Delete?</span>
                        <button onClick={() => handleDeleteBill(bill.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-bold">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs font-bold">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(bill.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors">
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">Admin Dashboard</h3>
            <p className="text-sm text-gray-400 mb-4">Enter password to continue</p>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Password"
              autoFocus
              className={`w-full px-4 py-3 bg-gray-700 border rounded-xl text-sm focus:outline-none mb-3 ${
                passwordError ? 'border-red-500 text-red-300' : 'border-gray-600 focus:border-amber-500'
              }`}
            />
            {passwordError && <p className="text-red-400 text-xs mb-3">Wrong password</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium">
                Cancel
              </button>
              <button onClick={handlePasswordSubmit}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-sm font-bold">
                Enter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`px-4 py-2 rounded-xl shadow-2xl text-sm font-semibold bg-gray-800 text-white border border-gray-600 ${
              t.leaving ? 'toast-leave' : 'toast-enter'
            }`}>
            ℹ {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
