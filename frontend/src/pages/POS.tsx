import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { MenuItem, CartItem } from '../types'
import { menuData } from '../data/menu'
import { getMenu, createOrder } from '../utils/api'
import { printReceipt, connectPrinter, isPrinterConnected } from '../utils/printer'

export default function POS() {
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    return JSON.parse(localStorage.getItem('haven_menu') || 'null') || menuData
  })
  const [categories, setCategories] = useState<string[]>(() => {
    const initialMenu = JSON.parse(localStorage.getItem('haven_menu') || 'null') || menuData
    return [...new Set(initialMenu.map((i: MenuItem) => i.category))] as string[]
  })
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>(() => {
    return JSON.parse(localStorage.getItem('haven_cart') || '[]')
  })
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash')
  const [loading, setLoading] = useState(false)
  const [printerStatus, setPrinterStatus] = useState(false)
  const [printerConnecting, setPrinterConnecting] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'add' | 'remove' | 'info'; leaving: boolean }[]>([])
  const [showCart, setShowCart] = useState(false)
  const [applyGST, setApplyGST] = useState(false)

  const addToast = (msg: string, type: 'add' | 'remove' | 'info' = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type, leaving: false }])
    // Start fade-out after 1.4s, remove after 1.65s
    setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t)), 1400)
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 1650)
  }

  useEffect(() => {
    getMenu().then(items => {
      if (items.length > 0) {
        const localMenu: MenuItem[] = JSON.parse(localStorage.getItem('haven_menu') || 'null')
        if (localMenu) {
          // Keep all custom added items that don't exist in backend by name
          const customItems = localMenu.filter(l => !items.some(i => i.name.toLowerCase() === l.name.toLowerCase()))
          const merged = [...items, ...customItems]
          setMenu(merged)
          setCategories([...new Set(merged.map(i => i.category))])
          localStorage.setItem('haven_menu', JSON.stringify(merged))
        } else {
          setMenu(items)
          setCategories([...new Set(items.map(i => i.category))])
          localStorage.setItem('haven_menu', JSON.stringify(items))
        }
      }
    }).catch(() => {
      const localMenu = JSON.parse(localStorage.getItem('haven_menu') || 'null')
      if (localMenu) {
        setMenu(localMenu)
        setCategories([...new Set(localMenu.map((i: MenuItem) => i.category))] as string[])
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('haven_cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => { setActiveCategory('All') }, [categories])

  const filteredItems = menu.filter(i =>
    (activeCategory === 'All' || i.category === activeCategory) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  )

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === item.name)
      if (existing) {
        addToast(`+1  ${item.name}`, 'add')
        return prev.map(c => c.name === item.name
          ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
          : c)
      }
      addToast(`Added  ${item.name}`, 'add')
      return [...prev, { name: item.name, price: item.price, quantity: 1, total: item.price }]
    })
  }

  const updateQty = (name: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(c => c.name === name)
      if (item) {
        const newQty = item.quantity + delta
        if (newQty <= 0) addToast(`Removed  ${name}`, 'remove')
        else if (delta > 0) addToast(`+1  ${name}`, 'add')
        else addToast(`-1  ${name}`, 'remove')
      }
      return prev.map(c => {
        if (c.name !== name) return c
        const qty = c.quantity + delta
        return qty <= 0 ? null! : { ...c, quantity: qty, total: qty * c.price }
      }).filter(Boolean)
    })
  }

  const subtotal = cart.reduce((s, i) => s + i.total, 0)
  const gstAmount = applyGST ? Math.round(subtotal * 0.05 * 100) / 100 : 0
  const total = subtotal + gstAmount
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const handlePrint = async () => {
    if (cart.length === 0) return

    // On web Bluetooth, check connection before even saving the order
    if (!window.AndroidBluetooth && !isPrinterConnected()) {
      showToastMsg('Connect printer first (tap 🖨️)')
      return
    }

    setLoading(true)
    try {
      const order = await createOrder(cart, paymentMethod, total)
      try {
        await printReceipt(cart, order.invoiceNo, paymentMethod, gstAmount)
        showToastMsg(`Bill #${order.invoiceNo} printed & saved!`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : ''
        if (msg === 'NOT_CONNECTED') {
          showToastMsg(`Bill #${order.invoiceNo} saved! Connect printer & reprint`)
        } else {
          showToastMsg(`Bill #${order.invoiceNo} saved! (Print failed)`)
        }
      }
      setCart([])
      setShowCart(false)
    } catch {
      const invoiceNo = parseInt(localStorage.getItem('haven_invoice') || '0') + 1
      localStorage.setItem('haven_invoice', invoiceNo.toString())
      const orders = JSON.parse(localStorage.getItem('haven_orders') || '[]')
      orders.unshift({ invoiceNo, items: cart, subtotal, total, paymentMethod, createdAt: new Date().toISOString() })
      localStorage.setItem('haven_orders', JSON.stringify(orders))
      try {
        await printReceipt(cart, invoiceNo, paymentMethod, gstAmount)
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
    if (printerConnecting) return
    setPrinterConnecting(true)
    const ok = await connectPrinter()
    setPrinterStatus(ok)
    setPrinterConnecting(false)
    showToastMsg(ok ? 'Printer connected!' : 'Connection failed')
  }

  const showToastMsg = (msg: string) => addToast(msg, 'info')

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg md:text-xl font-bold text-amber-400">☕ Haven Cafe</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleConnect} disabled={printerConnecting}
            className={`px-2 py-1 rounded text-[10px] md:text-xs font-medium transition-colors ${
              printerConnecting ? 'bg-yellow-600 cursor-wait' :
              printerStatus || isPrinterConnected() ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}>
            🖨️ {printerConnecting ? 'Scanning...' : printerStatus || isPrinterConnected() ? 'OK' : 'Printer'}
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
            {['All', ...categories].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat ? 'bg-amber-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 bg-gray-800 border-b border-gray-700">
            <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-amber-500" />
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
              <span className="text-sm font-bold text-amber-400">₹{total.toFixed(0)} • {cartCount} items</span>
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
            {/* GST Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyGST}
                onChange={e => setApplyGST(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <span className="text-sm text-gray-300">Apply GST (5%)</span>
              {applyGST && <span className="ml-auto text-sm text-amber-400 font-semibold">+₹{gstAmount.toFixed(2)}</span>}
            </label>
            <div className="flex justify-between text-base md:text-lg font-bold">
              <span>Total</span>
              <span className="text-amber-400">₹{total.toFixed(2)}</span>
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
              {loading ? '⏳ Processing...' : !isPrinterConnected() && !window.AndroidBluetooth ? '⚠️ Connect Printer First' : '🖨️ Print & Save Bill'}
            </button>
          </div>
        </div>
      </div>

      {/* Stacked Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`px-4 py-2 rounded-xl shadow-2xl text-xs md:text-sm font-semibold flex items-center gap-2 whitespace-nowrap ${
              t.leaving ? 'toast-leave' : 'toast-enter'
            } ${
              t.type === 'add'    ? 'bg-green-700  text-green-100  border border-green-500' :
              t.type === 'remove' ? 'bg-red-900/90 text-red-200    border border-red-600'   :
                                    'bg-gray-800   text-white      border border-gray-600'
            }`}>
            {t.type === 'add' ? '✓' : t.type === 'remove' ? '✕' : 'ℹ'} {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
