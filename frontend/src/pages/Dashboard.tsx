import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { MenuItem } from '../types'
import { menuData } from '../data/menu'

interface OrderItem { name: string; price: number; quantity: number; total: number }
interface Order { invoiceNo: number; items: OrderItem[]; subtotal: number; total: number; paymentMethod: string; createdAt: string }

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'digital'>('all')
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('haven_menu')
    return saved ? JSON.parse(saved) : menuData
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '' })
  const [menuSearch, setMenuSearch] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'menu'>('dashboard')

  useEffect(() => {
    setOrders(JSON.parse(localStorage.getItem('haven_orders') || '[]'))
  }, [])

  // Today's orders
  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today)
  const totalRevenue = todayOrders.reduce((s, o) => s + o.total, 0)
  const cashTotal = todayOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0)
  const digitalTotal = todayOrders.filter(o => o.paymentMethod === 'digital').reduce((s, o) => s + o.total, 0)

  // Top 5 items
  const itemCount: Record<string, number> = {}
  todayOrders.forEach(o => o.items.forEach(i => { itemCount[i.name] = (itemCount[i.name] || 0) + i.quantity }))
  const topItems = Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const saveMenu = (updated: MenuItem[]) => {
    setMenu(updated)
    localStorage.setItem('haven_menu', JSON.stringify(updated))
  }

  const handlePriceUpdate = (id: string) => {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price <= 0) return
    saveMenu(menu.map(m => m.id === id ? { ...m, price } : m))
    setEditId(null)
    setEditPrice('')
  }

  const handleAddItem = () => {
    if (!newItem.name || !newItem.price || !newItem.category) return
    const item: MenuItem = { id: Date.now().toString(), name: newItem.name, price: parseFloat(newItem.price), category: newItem.category }
    saveMenu([...menu, item])
    setNewItem({ name: '', price: '', category: '' })
  }

  const handleDeleteItem = (id: string) => {
    saveMenu(menu.filter(m => m.id !== id))
  }

  const categories = [...new Set(menu.map(m => m.category))]
  const filteredMenu = menu.filter(m => menuSearch === '' || m.name.toLowerCase().includes(menuSearch.toLowerCase()) || m.category.toLowerCase().includes(menuSearch.toLowerCase()))

  const filtered = orders.filter(o => {
    const matchSearch = search === '' || o.invoiceNo.toString().includes(search) ||
      o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
    const matchMethod = filterMethod === 'all' || o.paymentMethod === filterMethod
    return matchSearch && matchMethod
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-400">📊 Admin Dashboard</h1>
        <Link to="/" className="px-4 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 text-sm">
          ← Back to POS
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'dashboard' ? 'bg-amber-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>
          📊 Dashboard
        </button>
        <button onClick={() => setTab('menu')} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'menu' ? 'bg-amber-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>
          📝 Manage Menu
        </button>
      </div>

      {tab === 'menu' ? (
      <div className="space-y-4">
        {/* Add New Item */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="font-bold text-sm text-gray-300 mb-3">➕ Add New Item</h3>
          <div className="flex flex-wrap gap-2">
            <input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="Item name" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm flex-1 min-w-[150px] focus:outline-none focus:border-amber-500" />
            <input value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })}
              placeholder="Price (₹)" type="number" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm w-28 focus:outline-none focus:border-amber-500" />
            <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm flex-1 min-w-[150px] focus:outline-none focus:border-amber-500">
              <option value="">Select category</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new">+ New Category</option>
            </select>
            {newItem.category === '__new' && (
              <input onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                placeholder="New category name" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm flex-1 min-w-[150px] focus:outline-none focus:border-amber-500" />
            )}
            <button onClick={handleAddItem} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold">Add</button>
          </div>
        </div>

        {/* Menu Items Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-300">📋 Menu Items ({menu.length})</h3>
            <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
              placeholder="Search items..." className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm w-48 focus:outline-none focus:border-amber-500" />
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Item</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Category</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Price</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMenu.map(item => (
                  <tr key={item.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-4 py-2 font-medium">{item.name}</td>
                    <td className="px-4 py-2 text-gray-400">{item.category}</td>
                    <td className="px-4 py-2 text-right">
                      {editId === item.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input value={editPrice} onChange={e => setEditPrice(e.target.value)}
                            type="number" className="w-20 px-2 py-1 bg-gray-700 border border-amber-500 rounded text-sm text-right focus:outline-none"
                            onKeyDown={e => e.key === 'Enter' && handlePriceUpdate(item.id)} autoFocus />
                          <button onClick={() => handlePriceUpdate(item.id)} className="text-green-400 text-xs font-bold">✓</button>
                          <button onClick={() => setEditId(null)} className="text-red-400 text-xs font-bold">✗</button>
                        </div>
                      ) : (
                        <span className="text-amber-400 font-bold">₹{item.price}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => { setEditId(item.id); setEditPrice(item.price.toString()) }}
                        className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded mr-1 hover:bg-blue-600/40">Edit ₹</button>
                      <button onClick={() => handleDeleteItem(item.id)}
                        className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/40">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : (
      <>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Today's Revenue" value={`₹${totalRevenue.toFixed(2)}`} color="text-green-400" />
        <Card label="Bills Generated" value={todayOrders.length.toString()} color="text-blue-400" />
        <Card label="Cash Collection" value={`₹${cashTotal.toFixed(2)}`} color="text-emerald-400" />
        <Card label="Digital Payments" value={`₹${digitalTotal.toFixed(2)}`} color="text-purple-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Top 5 */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="font-bold text-sm text-gray-300 mb-3">🏆 Top 5 Best Sellers (Today)</h3>
          {topItems.length ? (
            <div className="space-y-2">
              {topItems.map(([name, qty], i) => (
                <div key={name} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                  <span className="text-sm"><span className="text-amber-400 font-bold mr-2">#{i + 1}</span>{name}</span>
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">{qty} sold</span>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">No sales yet today</p>}
        </div>

        {/* End of Day */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="font-bold text-sm text-gray-300 mb-3">📋 End-of-Day Reconciliation</h3>
          <div className="space-y-3">
            <Row label="Total Revenue" value={`₹${totalRevenue.toFixed(2)}`} />
            <Row label="Cash Payments" value={`₹${cashTotal.toFixed(2)}`} />
            <Row label="Digital Payments" value={`₹${digitalTotal.toFixed(2)}`} />
            <Row label="Total Bills" value={todayOrders.length.toString()} />
            <div className="border-t border-gray-600 pt-2">
              <Row label="Cash in Drawer" value={`₹${cashTotal.toFixed(2)}`} bold />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <h3 className="font-bold text-sm text-gray-300">📜 Transaction History</h3>
          <div className="flex gap-2 w-full md:w-auto">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice or item..."
              className="flex-1 md:w-48 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-amber-500" />
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value as 'all' | 'cash' | 'digital')}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none">
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="digital">Digital</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-700/50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Invoice</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Date</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Time</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Items</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Amount</th>
                <th className="text-center px-4 py-2 text-gray-400 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const d = new Date(order.createdAt)
                return (
                  <tr key={order.invoiceNo} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-4 py-2 font-mono text-amber-400">#{order.invoiceNo}</td>
                    <td className="px-4 py-2">{d.toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2">{d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-2 text-gray-300 truncate max-w-[200px]">
                      {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                    </td>
                    <td className="px-4 py-2 text-right font-bold">₹{order.total.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        order.paymentMethod === 'cash' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
                      }`}>
                        {order.paymentMethod === 'cash' ? '💵 Cash' : '📱 Digital'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={`text-sm ${bold ? 'font-bold' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-amber-400' : ''}`}>{value}</span>
    </div>
  )
}
