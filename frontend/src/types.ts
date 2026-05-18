export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  note?: string
}

export interface CartItem {
  name: string
  price: number
  quantity: number
  total: number
}

export interface Order {
  id: string
  invoiceNo: number
  items: CartItem[]
  subtotal: number
  total: number
  paymentMethod: string
  createdAt: string
}

export interface DashboardStats {
  totalRevenue: number
  totalBills: number
  topItems: { name: string; quantity: number }[]
  cashTotal: number
  digitalTotal: number
}
