import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { MenuItem } from '../types'
import { menuData } from '../data/menu'
import { getOrders, getDashboard } from '../utils/api'

interface OrderItem { name: string; price: number; quantity: number; total: number }
interface Order { invoiceNo: number; items: OrderItem[]; subtotal: number; total: number; paymentMethod: string; createdAt: string }
interface Stats { totalRevenue: number; totalBills: number; cashTotal: number; digitalTotal: number; topItems: { name: string; quantity: number }[] }

type DateFilter = 'today' | 'week' | 'all'

function fmt(d: Date) { return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function fmtTime(d: Date) { return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) }

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [_stats, setStats] = useState<Stats>({ totalRevenue: 0, totalBills: 0, cashTotal: 0, digitalTotal: 0, topItems: [] })
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'digital'>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    return JSON.parse(localStorage.getItem('haven_menu') || 'null') || menuData
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '' })
  const [menuSearch, setMenuSearch] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'menu'>('dashboard')
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)

  useEffect(() => {
    getOrders().then(setOrders).catch(() => {
      setOrders(JSON.parse(localStorage.getItem('haven_orders') || '[]'))
    })
    getDashboard().then(s => setStats(s as Stats)).catch(() => {
      const localOrders: Order[] = JSON.parse(localStorage.getItem('haven_orders') || '[]')
      const today = new Date().toDateString()
      const todayOrders = localOrders.filter(o => new Date(o.createdAt).toDateString() === today)
      const itemCount: Record<string, number> = {}
      todayOrders.forEach(o => o.items.forEach(i => { itemCount[i.name] = (itemCount[i.name] || 0) + i.quantity }))
      setStats({
        totalRevenue: todayOrders.reduce((s, o) => s + o.total, 0),
        totalBills: todayOrders.length,
        cashTotal: todayOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0),
        digitalTotal: todayOrders.filter(o => o.paymentMethod === 'digital').reduce((s, o) => s + o.total, 0),
        topItems: Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity }))
      })
    })
  }, [])

  // --- derived data ---
  const now = new Date()
  const filteredByDate = orders.filter(o => {
    const d = new Date(o.createdAt)
    if (dateFilter === 'today') return d.toDateString() === now.toDateString()
    if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
      return d >= weekAgo
    }
    return true
  })

  // Top selling items (all-time across all orders, with qty + revenue)
  const itemStats: Record<string, { qty: number; revenue: number }> = {}
  orders.forEach(o => o.items.forEach(i => {
    if (!itemStats[i.name]) itemStats[i.name] = { qty: 0, revenue: 0 }
    itemStats[i.name].qty += i.quantity
    itemStats[i.name].revenue += i.total
  }))
  const topSellers = Object.entries(itemStats).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10)
  const maxQty = topSellers[0]?.[1].qty || 1

  // Date-wise revenue
  const dateRevMap: Record<string, { revenue: number; bills: number; cash: number; digital: number }> = {}
  orders.forEach(o => {
    const key = fmt(new Date(o.createdAt))
    if (!dateRevMap[key]) dateRevMap[key] = { revenue: 0, bills: 0, cash: 0, digital: 0 }
    dateRevMap[key].revenue += o.total
    dateRevMap[key].bills += 1
    if (o.paymentMethod === 'cash') dateRevMap[key].cash += o.total
    else dateRevMap[key].digital += o.total
  })
  const dateRows = Object.entries(dateRevMap).sort((a, b) => {
    const [da, db] = [a[0].split('/').reverse().join('-'), b[0].split('/').reverse().join('-')]
    return db.localeCompare(da)
  })

  // Filtered orders for transaction table
  const filtered = filteredByDate.filter(o => {
    const matchSearch = search === '' || o.invoiceNo.toString().includes(search) ||
      o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
    const matchMethod = filterMethod === 'all' || o.paymentMethod === filterMethod
    return matchSearch && matchMethod
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Today stats for cards
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === now.toDateString())
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0)
  const todayBills = todayOrders.length
  const todayCash = todayOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0)
  const todayDigital = todayOrders.filter(o => o.paymentMethod === 'digital').reduce((s, o) => s + o.total, 0)
  const avgOrderValue = filtered.length ? filtered.reduce((s, o) => s + o.total, 0) / filtered.length : 0

  // Menu management
  const saveMenu = (updated: MenuItem[]) => { setMenu(updated); localStorage.setItem('haven_menu', JSON.stringify(updated)) }
  const handlePriceUpdate = (id: string) => {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price <= 0) return
    saveMenu(menu.map(m => m.id === id ? { ...m, price } : m))
    setEditId(null); setEditPrice('')
  }
  const handleAddItem = () => {
    if (!newItem.name || !newItem.price || !newItem.category) return
    saveMenu([...menu, { id: Date.now().toString(), name: newItem.name, price: parseFloat(newItem.price), category: newItem.category }])
    setNewItem({ name: '', price: '', category: '' })
  }
  const handleDeleteItem = (id: string) => saveMenu(menu.filter(m => m.id !== id))
  const categories = [...new Set(menu.map(m => m.category))]
  const filteredMenu = menu.filter(m => menuSearch === '' || m.name.toLowerCase().includes(menuSearch.toLowerCase()) || m.category.toLowerCase().includes(menuSearch.toLowerCase()))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-amber-400">📊 Admin Dashboard</h1>
        <Link to="/" className="px-3 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 text-xs md:text-sm">← Bills</Link>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 mb-5">
        {(['dashboard', 'menu'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === t ? 'bg-amber-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>
            {t === 'dashboard' ? '📊 Dashboard' : '📝 Manage Menu'}
          </button>
        ))}
      </div>

      {tab === 'menu' ? (
        <div className="space-y-4">
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
              </select>
              <button onClick={handleAddItem} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold">Add</button>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-300">📋 Menu Items ({menu.length})</h3>
              <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                placeholder="Search..." className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm w-40 focus:outline-none focus:border-amber-500" />
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
                        ) : <span className="text-amber-400 font-bold">₹{item.price}</span>}
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
        <div className="space-y-5">

          {/* ── Summary Cards (today) ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Today's Revenue" value={`₹${todayRevenue.toFixed(0)}`} color="text-green-400" sub={`${todayBills} bills`} />
            <Card label="Cash (Today)" value={`₹${todayCash.toFixed(0)}`} color="text-emerald-400" sub="cash" />
            <Card label="Digital (Today)" value={`₹${todayDigital.toFixed(0)}`} color="text-blue-400" sub="UPI/Card" />
            <Card label="Avg Order Value" value={`₹${avgOrderValue.toFixed(0)}`} color="text-amber-400" sub={`${dateFilter}`} />
          </div>

          {/* ── Top Selling Items (all-time) ── */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="font-bold text-sm text-gray-300 mb-4">🏆 Top Selling Items <span className="text-gray-500 font-normal">(all-time)</span></h3>
            {topSellers.length === 0
              ? <p className="text-gray-500 text-sm">No sales data yet</p>
              : <div className="space-y-2">
                {topSellers.map(([name, s], i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-5 text-right ${i < 3 ? 'text-amber-400' : 'text-gray-500'}`}>#{i + 1}</span>
                    <span className="text-sm w-40 md:w-56 truncate">{name}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-amber-500 transition-all"
                        style={{ width: `${(s.qty / maxQty) * 100}%` }} />
                    </div>
                    <span className="text-xs text-amber-400 font-bold w-16 text-right">{s.qty} sold</span>
                    <span className="text-xs text-gray-400 w-20 text-right hidden md:block">₹{s.revenue.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            }
          </div>

          {/* ── Date-wise Revenue ── */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-bold text-sm text-gray-300">📅 Date-wise Revenue</h3>
            </div>
            <div className="overflow-y-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-400 font-medium">Date</th>
                    <th className="text-center px-4 py-2 text-gray-400 font-medium">Bills</th>
                    <th className="text-right px-4 py-2 text-gray-400 font-medium">Cash</th>
                    <th className="text-right px-4 py-2 text-gray-400 font-medium">Digital</th>
                    <th className="text-right px-4 py-2 text-gray-400 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dateRows.length === 0
                    ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No data</td></tr>
                    : dateRows.map(([date, d]) => (
                      <tr key={date} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                        <td className="px-4 py-2 font-medium">{date}</td>
                        <td className="px-4 py-2 text-center text-gray-400">{d.bills}</td>
                        <td className="px-4 py-2 text-right text-emerald-400">₹{d.cash.toFixed(0)}</td>
                        <td className="px-4 py-2 text-right text-blue-400">₹{d.digital.toFixed(0)}</td>
                        <td className="px-4 py-2 text-right font-bold text-amber-400">₹{d.revenue.toFixed(0)}</td>
                      </tr>
                    ))
                  }
                </tbody>
                {dateRows.length > 1 && (
                  <tfoot className="bg-gray-700/30 sticky bottom-0">
                    <tr>
                      <td className="px-4 py-2 font-bold text-gray-300">Total</td>
                      <td className="px-4 py-2 text-center font-bold">{orders.length}</td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-400">₹{dateRows.reduce((s, [, d]) => s + d.cash, 0).toFixed(0)}</td>
                      <td className="px-4 py-2 text-right font-bold text-blue-400">₹{dateRows.reduce((s, [, d]) => s + d.digital, 0).toFixed(0)}</td>
                      <td className="px-4 py-2 text-right font-bold text-amber-400">₹{dateRows.reduce((s, [, d]) => s + d.revenue, 0).toFixed(0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── Order Timeline / Transaction History ── */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                <h3 className="font-bold text-sm text-gray-300">📋 Orders & Timeline</h3>
                <div className="flex flex-wrap gap-2">
                  {/* Date filter */}
                  {(['today', 'week', 'all'] as DateFilter[]).map(f => (
                    <button key={f} onClick={() => setDateFilter(f)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${dateFilter === f ? 'bg-amber-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Time'}
                    </button>
                  ))}
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search..." className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-xs w-32 focus:outline-none focus:border-amber-500" />
                  <select value={filterMethod} onChange={e => setFilterMethod(e.target.value as 'all' | 'cash' | 'digital')}
                    className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-xs focus:outline-none">
                    <option value="all">All</option>
                    <option value="cash">Cash</option>
                    <option value="digital">Digital</option>
                  </select>
                </div>
              </div>
              {filtered.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {filtered.length} orders · Total ₹{filtered.reduce((s, o) => s + o.total, 0).toFixed(0)}
                </p>
              )}
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {filtered.length === 0
                ? <p className="px-4 py-8 text-center text-gray-500 text-sm">No orders found</p>
                : filtered.map(order => {
                  const d = new Date(order.createdAt)
                  const expanded = expandedOrder === order.invoiceNo
                  return (
                    <div key={order.invoiceNo} className="border-t border-gray-700/50">
                      {/* Order row */}
                      <button onClick={() => setExpandedOrder(expanded ? null : order.invoiceNo)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700/40 text-left transition-colors">
                        <span className="font-mono text-amber-400 font-bold text-sm w-12">#{order.invoiceNo}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400">{fmt(d)}</span>
                            <span className="text-xs font-semibold text-white">{fmtTime(d)}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${order.paymentMethod === 'cash' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'}`}>
                              {order.paymentMethod === 'cash' ? '💵 Cash' : '📱 Digital'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-white">₹{order.total.toFixed(0)}</p>
                          <p className="text-[10px] text-gray-500">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-gray-500 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
                      </button>
                      {/* Expanded item breakdown */}
                      {expanded && (
                        <div className="bg-gray-700/20 px-6 pb-3 space-y-1">
                          <div className="flex text-[10px] text-gray-500 font-medium pb-1 border-b border-gray-700 mb-1">
                            <span className="flex-1">Item</span>
                            <span className="w-16 text-center">Qty</span>
                            <span className="w-16 text-right">Price</span>
                            <span className="w-16 text-right">Amount</span>
                          </div>
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex text-xs">
                              <span className="flex-1 text-gray-300">{item.name}</span>
                              <span className="w-16 text-center text-gray-400">×{item.quantity}</span>
                              <span className="w-16 text-right text-gray-400">₹{item.price}</span>
                              <span className="w-16 text-right text-amber-400 font-semibold">₹{item.total}</span>
                            </div>
                          ))}
                          <div className="flex text-xs font-bold pt-1 border-t border-gray-700 mt-1">
                            <span className="flex-1 text-gray-300">Total</span>
                            <span className="w-16 text-right text-amber-400">₹{order.total.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              }
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

function Card({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
