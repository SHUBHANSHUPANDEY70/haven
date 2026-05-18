import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { MenuItem, CartItem } from '../types'
import { menuData } from '../data/menu'
import { printReceipt, connectPrinter, isPrinterConnected } from '../utils/printer'

function getNextInvoice(): number {
  const n = parseInt(localStorage.getItem('haven_invoice') || '0') + 1
  localStorage.setItem('haven_invoice', n.toString())
  return n
}

function saveOrder(items: CartItem[], paymentMethod: string, invoiceNo: number) {
  const orders = JSON.parse(localStorage.getItem('haven_orders') || '[]')
  orders.unshift({ invoiceNo, items, subtotal: items.reduce((s, i) => s + i.total, 0), total: items.reduce((s, i) => s + i.total, 0), paymentMethod, createdAt: new Date().toISOString() })
  localStorage.setItem('haven_orders', JSON.stringify(orders))
}

export default function POS() {
  const [menu] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('haven_menu')
    return saved ? JSON.parse(saved) : menuData
  })
  const [categories] = useState<string[]>(() => [...new Set((JSON.parse(localStorage.getItem('haven_menu') || 'null') || menuData).map((i: MenuItem) => i.category))])
  const [activeCategory, setActiveCategory] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash')
  const [loading, setLoading] = useState(false)
  const [printerStatus, setPrinterStatus] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { setActiveCategory(categories[0] || '') }, [categories])

  const filteredItems = menu.filter(i => i.category === activeCategory)

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === item.name)
      if (existing) {
        return prev.map(c => c.name === item.name
          ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
          : c)
      }
      return [...prev, { name: item.name, price: item.price, quantity: 1, total: item.price }]
    })
  }

  const updateQty = (name: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.name !== name) return c
      const qty = c.quantity + delta
      return qty <= 0 ? null! : { ...c, quantity: qty, total: qty * c.price }
    }).filter(Boolean))
  }

  const subtotal = cart.reduce((s, i) => s + i.total, 0)

  const handlePrint = async () => {
    if (cart.length === 0) return
    setLoading(true)
    const invoiceNo = getNextInvoice()
    saveOrder(cart, paymentMethod, invoiceNo)
    try {
      await printReceipt(cart, invoiceNo, paymentMethod)
      showToast(`Bill #${invoiceNo} printed & saved!`)
    } catch {
      showToast(`Bill #${invoiceNo} saved! (Print failed - check printer)`)
    }
    setCart([])
    setLoading(false)
  }

  const handleConnect = async () => {
    const ok = await connectPrinter()
    setPrinterStatus(ok)
    showToast(ok ? 'Printer connected!' : 'Connection failed')
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-amber-400">☕ Haven Cafe POS</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleConnect}
            className={`px-3 py-1 rounded text-xs font-medium ${printerStatus || isPrinterConnected() ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
            🖨️ {printerStatus || isPrinterConnected() ? 'Connected' : 'Connect Printer'}
          </button>
          <Link to="/admin/dashboard" className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium">
            📊 Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left - Menu (65%) */}
        <div className="w-[65%] flex flex-col border-r border-gray-700">
          {/* Category Tabs */}
          <div className="flex overflow-x-auto gap-1 p-2 bg-gray-800 border-b border-gray-700">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat ? 'bg-amber-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 auto-rows-min">
            {filteredItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500 rounded-xl p-3 text-left transition-all active:scale-95">
                <p className="font-medium text-sm leading-tight">{item.name}</p>
                <p className="text-amber-400 font-bold mt-1">₹{item.price}</p>
                {item.note && <p className="text-gray-500 text-xs mt-0.5">{item.note}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Right - Cart (35%) */}
        <div className="w-[35%] flex flex-col">
          <div className="p-3 border-b border-gray-700 bg-gray-800">
            <h2 className="font-bold text-lg">Current Bill</h2>
            <p className="text-gray-400 text-xs">{cart.length} items</p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {cart.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Tap items to add to bill
              </div>
            )}
            {cart.map(item => (
              <div key={item.name} className="bg-gray-800 rounded-lg p-2 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.name, -1)}
                    className="w-7 h-7 rounded-full bg-red-600/20 text-red-400 font-bold text-sm flex items-center justify-center hover:bg-red-600/40">
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.name, 1)}
                    className="w-7 h-7 rounded-full bg-green-600/20 text-green-400 font-bold text-sm flex items-center justify-center hover:bg-green-600/40">
                    +
                  </button>
                  <span className="w-16 text-right text-sm font-bold text-amber-400">₹{item.total}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals & Actions */}
          <div className="border-t border-gray-700 p-3 bg-gray-800 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="font-bold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-amber-400">₹{subtotal.toFixed(2)}</span>
            </div>

            {/* Payment Method */}
            <div className="flex gap-2">
              <button onClick={() => setPaymentMethod('cash')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  paymentMethod === 'cash' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                💵 Cash
              </button>
              <button onClick={() => setPaymentMethod('digital')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  paymentMethod === 'digital' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                📱 Digital
              </button>
            </div>

            {/* Print & Save */}
            <button onClick={handlePrint} disabled={cart.length === 0 || loading}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold text-lg rounded-xl transition-all active:scale-[0.98]">
              {loading ? '⏳ Processing...' : '🖨️ Print & Save Bill'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 px-6 py-3 rounded-xl shadow-2xl text-sm font-medium animate-bounce">
          {toast}
        </div>
      )}
    </div>
  )
}
