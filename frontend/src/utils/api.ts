import axios from 'axios'
import type { MenuItem, Order, DashboardStats, CartItem } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

// Wake up the Render backend on load (free tier spins down after inactivity).
// Uses HEAD /menu so it's cheap — no response body needed.
export function wakeBackend() {
  api.head('/menu').catch(() => {/* ignore — just warming up */})
}

// MongoDB returns _id — normalize it to id so our MenuItem interface works
export const getMenu = () =>
  api.get<(MenuItem & { _id?: string })[]>('/menu').then(r =>
    r.data.map(item => ({ ...item, id: item.id || item._id || '' }))
  )

export const createOrder = (items: CartItem[], paymentMethod: string, total?: number) => {
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  return api.post<Order>('/orders', { items, subtotal, total: total ?? subtotal, paymentMethod }).then(r => r.data)
}

export const getOrders = () => api.get<Order[]>('/orders').then(r => r.data)

export const getDashboard = () => api.get<DashboardStats>('/dashboard').then(r => r.data)
