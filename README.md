# Haven Cafe POS System

Complete Point of Sale system for Haven Cafe & Restaurant with Bluetooth thermal printing.

## Prerequisites
- Go 1.21+
- Node.js 18+
- MongoDB running on localhost:27017

## Setup & Run

### 1. Seed the Database
```bash
cd backend
go run ./cmd/seed/
```

### 2. Start Backend (port 8080)
```bash
cd backend
go run ./cmd/
```

### 3. Start Frontend (port 5173)
```bash
cd frontend
npm run dev
```

### 4. Access
- **POS Terminal**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5173/admin/dashboard

## Bluetooth Printer
Click "Connect Printer" in the POS header to pair with a 58mm/80mm ESC/POS thermal printer via Web Bluetooth.

## PWA
Install as a tablet app from Chrome → "Add to Home Screen" for fullscreen kiosk mode.
