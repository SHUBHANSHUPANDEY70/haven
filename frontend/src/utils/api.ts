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
  api.get<(MenuItem & { _id?: string })[]>('/menu').then(r => r.data.map(normalizeMenuItem))

const normalizeMenuItem = (item: MenuItem & { _id?: string }): MenuItem => ({
  ...item,
  id: item.id || item._id || '',
})

export const createMenuItem = (item: { name: string; price: number; category: string }) =>
  api.post<MenuItem & { _id?: string }>('/menu', item).then(r => normalizeMenuItem(r.data))

export const updateMenuItem = (id: string, patch: Partial<Pick<MenuItem, 'name' | 'price' | 'category'>>) =>
  api.put<{ message: string }>(`/menu/${id}`, patch).then(r => r.data)

export const deleteMenuItem = (id: string) =>
  api.delete<{ message: string }>(`/menu/${id}`).then(r => r.data)

export const createOrder = (items: CartItem[], paymentMethod: string, total?: number) => {
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  return api.post<Order>('/orders', { items, subtotal, total: total ?? subtotal, paymentMethod }).then(r => r.data)
}

export const getOrders = () => api.get<Order[]>('/orders').then(r => r.data ?? [])

export const getDashboard = () => api.get<DashboardStats>('/dashboard').then(r => r.data)

export const deleteOrder = (id: string) => api.delete<{ message: string }>(`/orders/${id}`).then(r => r.data)

export const deleteOlderOrders = (cutoff: string) => api.delete<{ message: string; deletedCount: number }>(`/orders?cutoff=${encodeURIComponent(cutoff)}`).then(r => r.data)

