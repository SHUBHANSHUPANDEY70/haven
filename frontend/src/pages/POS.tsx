import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { MenuItem, CartItem } from '../types'
import { menuData } from '../data/menu'
import { getMenu, createOrder } from '../utils/api'
import { printReceipt, connectPrinter, isPrinterConnected } from '../utils/printer'

export default function POS() {
  const [menu, setMenu] = useState<MenuItem[]>(menuData)
  const [categories, setCategories] = useState<string[]>([...new Set(menuData.map(i => i.category))])
  const [activeCategory, setActiveCategory] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash')
  const [loading, setLoading] = useState(false)
  const [printerStatus, setPrinterStatus] = useState(false)
  const [toast, setToast] = useState('')
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    getMenu().then(items => {
      if (items.length > 0) {
        setMenu(items)
        setCategories([...new Set(items.map(i => i.category))])
      }
    }).catch(() => {})
  }, [])

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
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const handlePrint = async () => {
    if (cart.length === 0) return
    setLoading(true)
    try {
      const order = await createOrder(cart, paymentMethod)
      try {
        await printReceipt(cart, order.invoiceNo, paymentMethod)
        showToastMsg(`Bill #${order.invoiceNo} printed & saved!`)
      } catch {
        showToastMsg(`Bill #${order.invoiceNo} saved! (Print failed)`)
      }
      setCart([])
      setShowCart(false)
    } catch {
      const invoiceNo = parseInt(localStorage.getItem('haven_invoice') || '0') + 1
      localStorage.setItem('haven_invoice', invoiceNo.toString())
      const orders = JSON.parse(localStorage.getItem('haven_orders') || '[]')
      orders.unshift({ invoiceNo, items: cart, subtotal, total: subtotal, paymentMethod, createdAt: new Date().toISOString() })
      localStorage.setItem('haven_orders', JSON.stringify(orders))
      try {
        await printReceipt(cart, invoiceNo, paymentMethod)
        showToastMsg(`Bill #${invoiceNo} printed & saved!`)
      } catch {
        showToastMsg(`Bill #${invoiceNo} saved!`)
      }
      setCart([])
      setShowCart(false)
    }
    setLoading(false)
  }

  const handleConnect = async () => {
    const ok = await connectPrinter()
    setPrinterStatus(ok)
    showToastMsg(ok ? 'Printer connected!' : 'Connection failed')
  }

  const showToastMsg = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg md:text-xl font-bold text-amber-400">☕ Haven Cafe</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleConnect}
            className={`px-2 py-1 rounded text-[10px] md:text-xs font-medium ${printerStatus || isPrinterConnected() ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
            🖨️ {printerStatus || isPrinterConnected() ? 'OK' : 'Printer'}
          </button>
          <Link to="/admin/dashboard" className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] md:text-xs font-medium">
            📊
          </Link>
          {/* Mobile cart toggle */}
          <button onClick={() => setShowCart(!showCart)} className="md:hidden px-2 py-1 bg-amber-500 text-black rounded text-[10px] font-bold relative">
            🛒 {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left - Menu */}
        <div className={`${showCart ? 'hidden md:flex' : 'flex'} w-full md:w-[65%] flex-col border-r border-gray-700`}>
          {/* Category Tabs */}
          <div className="flex overflow-x-auto gap-1 p-2 bg-gray-800 border-b border-gray-700">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat ? 'bg-amber-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-2 md:p-3 grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-2 auto-rows-min">
            {filteredItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500 rounded-lg md:rounded-xl p-2 md:p-3 text-left transition-all active:scale-95">
                <p className="font-medium text-[11px] md:text-sm leading-tight">{item.name}</p>
                <p className="text-amber-400 font-bold text-xs md:text-sm mt-0.5 md:mt-1">₹{item.price}</p>
                {item.note && <p className="text-gray-500 text-[9px] md:text-xs">{item.note}</p>}
              </button>
            ))}
          </div>

          {/* Mobile bottom bar */}
          {cartCount > 0 && !showCart && (
            <div className="md:hidden flex items-center justify-between px-3 py-2 bg-gray-800 border-t border-gray-700">
              <span className="text-sm font-bold text-amber-400">₹{subtotal.toFixed(0)} • {cartCount} items</span>
              <button onClick={() => setShowCart(true)} className="px-4 py-2 bg-amber-500 text-black font-bold text-sm rounded-lg">
                View Cart →
              </button>
            </div>
          )}
        </div>

        {/* Right - Cart */}
        <div className={`${showCart ? 'flex' : 'hidden md:flex'} w-full md:w-[35%] flex-col absolute md:relative inset-0 md:inset-auto bg-gray-900 z-10`}>
          <div className="p-3 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base md:text-lg">Current Bill</h2>
              <p className="text-gray-400 text-xs">{cart.length} items</p>
            </div>
            <button onClick={() => setShowCart(false)} className="md:hidden px-2 py-1 bg-gray-700 rounded text-xs">← Menu</button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {cart.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">Tap items to add to bill</div>
            )}
            {cart.map(item => (
              <div key={item.name} className="bg-gray-800 rounded-lg p-2 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium truncate">{item.name}</p>
                  <p className="text-[10px] md:text-xs text-gray-400">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <button onClick={() => updateQty(item.name, -1)}
                    className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-red-600/20 text-red-400 font-bold text-xs md:text-sm flex items-center justify-center">−</button>
                  <span className="w-4 md:w-5 text-center text-xs md:text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.name, 1)}
                    className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-green-600/20 text-green-400 font-bold text-xs md:text-sm flex items-center justify-center">+</button>
                  <span className="w-14 md:w-16 text-right text-xs md:text-sm font-bold text-amber-400">₹{item.total}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals & Actions */}
          <div className="border-t border-gray-700 p-3 bg-gray-800 space-y-2 md:space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="font-bold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base md:text-lg font-bold">
              <span>Total</span>
              <span className="text-amber-400">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPaymentMethod('cash')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold ${paymentMethod === 'cash' ? 'bg-green-600' : 'bg-gray-700'}`}>
                💵 Cash
              </button>
              <button onClick={() => setPaymentMethod('digital')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold ${paymentMethod === 'digital' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                📱 Digital
              </button>
            </div>
            <button onClick={handlePrint} disabled={cart.length === 0 || loading}
              className="w-full py-3 md:py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold text-sm md:text-lg rounded-xl active:scale-[0.98]">
              {loading ? '⏳ Processing...' : '🖨️ Print & Save Bill'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 px-4 py-2 rounded-xl shadow-2xl text-xs md:text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
