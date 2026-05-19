import type { CartItem } from '../types'

declare global {
  interface Window {
    AndroidBluetooth?: {
      connectPrinter(): void
      isConnected(): boolean
      printData(base64: string): boolean
    }
    __btStatus?: (status: string) => void
  }
}

const ESC = 0x1B
const GS = 0x1D

const encoder = new TextEncoder()

function cmd(...bytes: number[]): Uint8Array { return new Uint8Array(bytes) }
function text(s: string): Uint8Array { return encoder.encode(s) }
function centerAlign(): Uint8Array { return cmd(ESC, 0x61, 1) }
function leftAlign(): Uint8Array { return cmd(ESC, 0x61, 0) }
function rightAlign(): Uint8Array { return cmd(ESC, 0x61, 2) }
function bold(on: boolean): Uint8Array { return cmd(ESC, 0x45, on ? 1 : 0) }
function doubleHeight(on: boolean): Uint8Array { return cmd(GS, 0x21, on ? 0x11 : 0x00) }
function cut(): Uint8Array { return cmd(GS, 0x56, 0x00) }
function feed(n: number): Uint8Array { return cmd(ESC, 0x64, n) }
function padRight(s: string, len: number): string { return s.padEnd(len) }
function padLeft(s: string, len: number): string { return s.padStart(len) }

function payMethod(m: string): string {
  return m === 'cash' ? 'Cash Sale' : 'Digital Sale'
}

function buildReceipt(items: CartItem[], invoiceNo: number, paymentMethod: string): Uint8Array[] {
  const now = new Date()
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const divider = '--------------------------------'

  return [
    cmd(ESC, 0x40),
    centerAlign(), doubleHeight(true), bold(true),
    text('Haven Cafe Restaurant\n'),
    doubleHeight(false), bold(false),
    text('Near Sagar Bridge, Besides ICICI\n'),
    text('Bank, Anand Vihar building,\n'),
    text('Bargawan, Katni\n'),
    text('Phone: 9340112448\n'),
    text('FSSAI: 11426120000032\n'),
    text(divider + '\n'),
    bold(true), text('Bill of Supply\n'), bold(false),
    leftAlign(),
    text(`${payMethod(paymentMethod)}${padLeft('Date: ' + date, 32 - payMethod(paymentMethod).length)}\n`),
    text(`${padLeft('Time: ' + time, 32)}\n`),
    text(`${padLeft('Invoice no: ' + invoiceNo, 32)}\n`),
    text(divider + '\n'),
    text(padRight('Item', 16) + padLeft('Price', 8) + padLeft('Amount', 8) + '\n'),
    text('Qty\n'),
    text(divider + '\n'),
    ...items.flatMap(item => [
      text(padRight(item.name.substring(0, 16), 16) + padLeft(item.price.toFixed(2), 8) + padLeft(item.total.toFixed(2), 8) + '\n'),
      text(`x${item.quantity}\n`),
      text(divider + '\n'),
    ]),
    rightAlign(),
    text(`Subtotal  :  ${padLeft(subtotal.toFixed(2), 10)}\n`),
    text(`Total     :  ${padLeft(subtotal.toFixed(2), 10)}\n`),
    leftAlign(), text(divider + '\n'),
    centerAlign(),
    text('Terms & Conditions\n'),
    text('Thank you for dining at HAVEN.\n'),
    text('See you again soon.\n'),
    feed(4), cut(),
  ]
}

function concatArrays(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { result.set(a, offset); offset += a.length }
  return result
}

function toBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
  return btoa(binary)
}

// --- Web Bluetooth fallback ---
let writeChar: BluetoothRemoteGATTCharacteristic | null = null
let useWriteWithResponse = false

// All known thermal printer service UUIDs
const PRINTER_SERVICES = [
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000ae3a-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000af00-0000-1000-8000-00805f9b34fb',
]

// Known writable characteristic UUIDs for thermal printers
const WRITE_CHAR_UUIDS = [
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '0000ae3b-0000-1000-8000-00805f9b34fb',
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
]

async function webBluetoothConnect(): Promise<boolean> {
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES
    })
    const server = await device!.gatt!.connect()
    const services = await server.getPrimaryServices()
    console.log('[Haven Printer] Services found:', services.map(s => s.uuid))

    // First pass: look for known write characteristics
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics()
        console.log(`[Haven Printer] Service ${svc.uuid} chars:`, chars.map(c => `${c.uuid} (write:${c.properties.write}, writeNoResp:${c.properties.writeWithoutResponse})`))
        for (const c of chars) {
          if (WRITE_CHAR_UUIDS.includes(c.uuid) && (c.properties.write || c.properties.writeWithoutResponse)) {
            writeChar = c
            useWriteWithResponse = !c.properties.writeWithoutResponse
            console.log('[Haven Printer] Using known char:', c.uuid)
            return true
          }
        }
      } catch { /* skip */ }
    }

    // Second pass: use any writable characteristic
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics()
        for (const c of chars) {
          if (c.properties.writeWithoutResponse) {
            writeChar = c
            useWriteWithResponse = false
            console.log('[Haven Printer] Fallback char (noResp):', c.uuid)
            return true
          }
          if (c.properties.write && !writeChar) {
            writeChar = c
            useWriteWithResponse = true
          }
        }
      } catch { /* skip */ }
    }
    if (writeChar) console.log('[Haven Printer] Fallback char (resp):', writeChar.uuid)
    return writeChar !== null
  } catch (e) {
    console.error('[Haven Printer] Connect failed:', e)
    return false
  }
}
// --- Public API ---

let androidConnected = false

export async function connectPrinter(): Promise<boolean> {
  // Use Android native bridge if available
  if (window.AndroidBluetooth) {
    return new Promise((resolve) => {
      window.__btStatus = (status: string) => {
        androidConnected = status === 'connected'
        resolve(androidConnected)
      }
      window.AndroidBluetooth!.connectPrinter()
      // Timeout after 12 seconds
      setTimeout(() => resolve(androidConnected), 12000)
    })
  }
  // Fallback to Web Bluetooth
  return webBluetoothConnect()
}

export function isPrinterConnected(): boolean {
  if (window.AndroidBluetooth) return window.AndroidBluetooth.isConnected()
  return writeChar !== null
}

export async function printReceipt(items: CartItem[], invoiceNo: number, paymentMethod: string): Promise<boolean> {
  const parts = buildReceipt(items, invoiceNo, paymentMethod)
  const combined = concatArrays(parts)

  // Use Android native bridge
  if (window.AndroidBluetooth) {
    if (!window.AndroidBluetooth.isConnected()) {
      const ok = await connectPrinter()
      if (!ok) return false
    }
    return window.AndroidBluetooth.printData(toBase64(combined))
  }

  // Web Bluetooth fallback
  if (!writeChar) {
    const ok = await webBluetoothConnect()
    if (!ok) throw new Error('Printer not connected')
  }
  // BLE MTU is typically 20 bytes for cheap printers, use small chunks
  const CHUNK = 20
  for (let i = 0; i < combined.length; i += CHUNK) {
    const chunk = combined.slice(i, i + CHUNK)
    if (useWriteWithResponse) {
      await writeChar!.writeValueWithResponse(chunk)
    } else {
      await writeChar!.writeValueWithoutResponse(chunk)
    }
    await new Promise(r => setTimeout(r, 30))
  }
  return true
}
