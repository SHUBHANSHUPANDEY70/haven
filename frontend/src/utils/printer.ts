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
function bold(on: boolean): Uint8Array { return cmd(ESC, 0x45, on ? 1 : 0) }
function cut(): Uint8Array { return cmd(GS, 0x56, 0x00) }
function feed(n: number): Uint8Array { return cmd(ESC, 0x64, n) }

function payMethod(m: string): string {
  return m === 'cash' ? 'Cash Sale' : 'Digital Sale'
}

function buildReceipt(items: CartItem[], invoiceNo: number, paymentMethod: string, gstAmount = 0): Uint8Array[] {
  const W = 32
  const now = new Date()
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const total = subtotal + gstAmount
  const div = '-'.repeat(W) + '\n'

  const rpad = (s: string, len: number) => s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)
  const lpad = (s: string, len: number) => s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s

  // Item line: qty(3) + name(18) + amount(11) = 32 exactly
  const itemLine = (name: string, qty: number, amount: number) => {
    const qtyStr = ('x' + qty).padEnd(3)
    const amtStr = lpad(amount.toFixed(2), 11)
    const nameWidth = W - 3 - 11  // 18
    return qtyStr + rpad(name.slice(0, nameWidth), nameWidth) + amtStr + '\n'
  }

  // Footer line: label(15) + ":"(1) + value(16) = 32 exactly
  const footerLine = (label: string, val: number) =>
    rpad(label, 15) + ':' + lpad(val.toFixed(2), 16) + '\n'

  const pay = payMethod(paymentMethod)

  return [
    cmd(ESC, 0x40),       // Initialize printer
    cmd(GS, 0x21, 0x00),  // Normal character size
    centerAlign(), bold(true),
    text('Haven Cafe Restaurant\n'),
    bold(false),
    text('Near Sagar Bridge, Besides ICICI\n'),
    text('Bank, Anand Vihar building,\n'),
    text('Bargawan, Katni\n'),
    text('Phone: 9340112448\n'),
    text('FSSAI: 11426120000032\n'),
    leftAlign(), text(div),
    centerAlign(), bold(true), text('Bill of Supply\n'), bold(false),
    text('\n'),
    leftAlign(),
    text(rpad(pay, W - 5) + 'Date:\n'),
    text(lpad(date, W) + '\n'),
    text(lpad('Time: ' + time, W) + '\n'),
    text(lpad('Invoice no: ' + invoiceNo, W) + '\n'),
    text(div),
    text(rpad('Qty', 3) + rpad('Item Name', 18) + lpad('Amount', 11) + '\n'),
    text(div),
    ...items.map(item => text(itemLine(item.name, item.quantity, item.total))),
    text(div),
    text(footerLine('Subtotal', subtotal)),
    ...(gstAmount > 0 ? [text(footerLine('GST (5%)', gstAmount))] : []),
    text(footerLine('Total', total)),
    text(div),
    centerAlign(), bold(true),
    text('Terms & Conditions\n'),
    bold(false),
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

// --- Web Bluetooth ---
let writeChar: BluetoothRemoteGATTCharacteristic | null = null
let useWriteWithResponse = false

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

    // Clear stale char on disconnect
    device.addEventListener('gattserverdisconnected', () => {
      log('BLE disconnected — clearing cached char')
      writeChar = null
    })

    const services = await server.getPrimaryServices()
    log('Services: ' + services.map(s => s.uuid).join(', '))

    // First pass: known write characteristic UUIDs
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics()
        log(`Svc ${svc.uuid.slice(4, 8)}: ${chars.map(c => c.uuid.slice(4, 8) + (c.properties.write ? '[W]' : '') + (c.properties.writeWithoutResponse ? '[WnR]' : '')).join(', ')}`)
        for (const c of chars) {
          if (WRITE_CHAR_UUIDS.includes(c.uuid) && (c.properties.write || c.properties.writeWithoutResponse)) {
            writeChar = c
            useWriteWithResponse = !c.properties.writeWithoutResponse
            log('Using known char: ' + c.uuid)
            return true
          }
        }
      } catch { /* skip */ }
    }

    // Second pass: any writable characteristic
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics()
        for (const c of chars) {
          if (c.properties.writeWithoutResponse) {
            writeChar = c
            useWriteWithResponse = false
            log('Fallback char (noResp): ' + c.uuid)
            return true
          }
          if (c.properties.write && !writeChar) {
            writeChar = c
            useWriteWithResponse = true
          }
        }
      } catch { /* skip */ }
    }
    if (writeChar) log('Fallback char (resp): ' + writeChar.uuid)
    return writeChar !== null
  } catch (e) {
    log('Connect failed: ' + (e as Error).message)
    return false
  }
}

// Send data in chunks — 200 bytes / 100ms is what this printer needs
async function sendChunked(data: Uint8Array): Promise<void> {
  const CHUNK = 200
  const DELAY = 100
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK)
    try {
      if (useWriteWithResponse) {
        await writeChar!.writeValueWithResponse(chunk)
      } else {
        await writeChar!.writeValueWithoutResponse(chunk)
      }
    } catch (e) {
      // Char went stale mid-print — clear it so next print reconnects
      log('Write error mid-print: ' + (e as Error).message + ' — clearing char')
      writeChar = null
      throw e
    }
    await new Promise(r => setTimeout(r, DELAY))
  }
}

// --- Public API ---

export const printerLogs: string[] = []
function log(msg: string) { printerLogs.push(msg); console.log('[Haven Printer]', msg) }
export function clearPrinterLogs() { printerLogs.length = 0 }

let androidConnected = false

export async function connectPrinter(): Promise<boolean> {
  if (window.AndroidBluetooth) {
    return new Promise((resolve) => {
      window.__btStatus = (status: string) => {
        androidConnected = status === 'connected'
        resolve(androidConnected)
      }
      window.AndroidBluetooth!.connectPrinter()
      setTimeout(() => resolve(androidConnected), 12000)
    })
  }
  return webBluetoothConnect()
}

export function isPrinterConnected(): boolean {
  if (window.AndroidBluetooth) return window.AndroidBluetooth.isConnected()
  return writeChar !== null
}

export async function printReceipt(
  items: CartItem[],
  invoiceNo: number,
  paymentMethod: string,
  gstAmount = 0
): Promise<boolean> {
  log('Printing bill #' + invoiceNo + ' (' + items.length + ' items)')
  const parts = buildReceipt(items, invoiceNo, paymentMethod, gstAmount)
  const combined = concatArrays(parts)
  log('Data size: ' + combined.length + ' bytes')

  // ── Android native bridge ──
  if (window.AndroidBluetooth) {
    // Auto-connect if needed
    if (!window.AndroidBluetooth.isConnected()) {
      log('Not connected — auto-connecting...')
      const ok = await connectPrinter()
      if (!ok) { log('FAILED: Could not connect'); return false }
    }
    const result = window.AndroidBluetooth.printData(toBase64(combined))
    if (result) log('DONE: Data handed to Android bridge')
    else log('FAILED: Android bridge returned false')
    return result
  }

  // ── Web Bluetooth ──
  // If char is null or stale, reconnect (up to 1 retry)
  if (!writeChar) {
    log('No char — connecting...')
    const ok = await webBluetoothConnect()
    if (!ok) { log('FAILED: Could not connect'); throw new Error('Printer not connected') }
  }

  log('Sending ' + combined.length + ' bytes to ' + writeChar!.uuid)
  try {
    await sendChunked(combined)
  } catch {
    // One retry: reconnect and try again
    log('Send failed — retrying with fresh connection...')
    writeChar = null
    const ok = await webBluetoothConnect()
    if (!ok) { log('FAILED: Reconnect failed'); throw new Error('Printer not connected') }
    await sendChunked(combined)
  }
  log('DONE: All data sent successfully')
  return true
}
