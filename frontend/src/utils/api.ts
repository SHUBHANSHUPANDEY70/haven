import axios from 'axios'
import type { MenuItem, Order, DashboardStats, CartItem } from '../types'

const api = axios.create({ baseURL: '/api' })

export const getMenu = () => api.get<MenuItem[]>('/menu').then(r => r.data)

export const createOrder = (items: CartItem[], paymentMethod: string) => {
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  return api.post<Order>('/orders', { items, subtotal, total: subtotal, paymentMethod }).then(r => r.data)
}

export const getOrders = () => api.get<Order[]>('/orders').then(r => r.data)

export const getDashboard = () => api.get<DashboardStats>('/dashboard').then(r => r.data)
