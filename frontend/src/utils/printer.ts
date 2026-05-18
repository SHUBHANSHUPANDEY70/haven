import type { CartItem } from '../types'

const ESC = 0x1B
const GS = 0x1D

const encoder = new TextEncoder()

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}

function text(s: string): Uint8Array {
  return encoder.encode(s)
}

function centerAlign(): Uint8Array { return cmd(ESC, 0x61, 1) }
function leftAlign(): Uint8Array { return cmd(ESC, 0x61, 0) }
function rightAlign(): Uint8Array { return cmd(ESC, 0x61, 2) }
function bold(on: boolean): Uint8Array { return cmd(ESC, 0x45, on ? 1 : 0) }
function doubleHeight(on: boolean): Uint8Array { return cmd(GS, 0x21, on ? 0x11 : 0x00) }
function cut(): Uint8Array { return cmd(GS, 0x56, 0x00) }
function feed(n: number): Uint8Array { return cmd(ESC, 0x64, n) }

function padRight(s: string, len: number): string { return s.padEnd(len) }
function padLeft(s: string, len: number): string { return s.padStart(len) }

function buildReceipt(items: CartItem[], invoiceNo: number, paymentMethod: string): Uint8Array[] {
  const now = new Date()
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const divider = '--------------------------------'

  const parts: Uint8Array[] = [
    cmd(ESC, 0x40), // Initialize
    centerAlign(),
    doubleHeight(true), bold(true),
    text('Haven Cafe Restaurant\n'),
    doubleHeight(false), bold(false),
    text('Near Sagar Bridge, Besides ICICI\n'),
    text('Bank, Anand Vihar building,\n'),
    text('Bargawan, Katni\n'),
    text('Phone: 9340112448\n'),
    text('FSSAI: 11426120000032\n'),
    text(divider + '\n'),
    bold(true),
    text('Bill of Supply\n'),
    bold(false),
    leftAlign(),
    text(`${payMethod(paymentMethod)}${padLeft('Date: ' + date, 32 - payMethod(paymentMethod).length)}\n`),
    text(`${padLeft('Time: ' + time, 32)}\n`),
    text(`${padLeft('Invoice no: ' + invoiceNo, 32)}\n`),
    text(divider + '\n'),
    text(padRight('Item', 16) + padLeft('Price', 8) + padLeft('Amount', 8) + '\n'),
    text('Qty\n'),
    text(divider + '\n'),
  ]

  for (const item of items) {
    parts.push(text(padRight(item.name.substring(0, 16), 16) + padLeft(item.price.toFixed(2), 8) + padLeft(item.total.toFixed(2), 8) + '\n'))
    parts.push(text(`x${item.quantity}\n`))
    parts.push(text(divider + '\n'))
  }

  parts.push(
    rightAlign(),
    text(`Subtotal  :  ${padLeft(subtotal.toFixed(2), 10)}\n`),
    text(`Total     :  ${padLeft(subtotal.toFixed(2), 10)}\n`),
    leftAlign(),
    text(divider + '\n'),
    centerAlign(),
    text('Terms & Conditions\n'),
    text('Thank you for dining at HAVEN.\n'),
    text('See you again soon.\n'),
    feed(4),
    cut(),
  )

  return parts
}

function payMethod(m: string): string {
  return m === 'cash' ? 'Cash Sale' : 'Digital Sale'
}

let bluetoothDevice: BluetoothDevice | null = null
let writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null

export async function connectPrinter(): Promise<boolean> {
  try {
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    })
    const server = await bluetoothDevice!.gatt!.connect()
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
    writeCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb')
    return true
  } catch {
    // Try generic serial profile
    try {
      bluetoothDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] })
      const server = await bluetoothDevice!.gatt!.connect()
      const services = await server.getPrimaryServices()
      for (const svc of services) {
        const chars = await svc.getCharacteristics()
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeCharacteristic = c
            return true
          }
        }
      }
    } catch { /* fallback failed */ }
    return false
  }
}

export async function printReceipt(items: CartItem[], invoiceNo: number, paymentMethod: string): Promise<boolean> {
  if (!writeCharacteristic) {
    const connected = await connectPrinter()
    if (!connected) return false
  }

  const parts = buildReceipt(items, invoiceNo, paymentMethod)
  const combined = concatArrays(parts)

  // Send in chunks of 100 bytes
  for (let i = 0; i < combined.length; i += 100) {
    const chunk = combined.slice(i, i + 100)
    await writeCharacteristic!.writeValueWithoutResponse(chunk)
    await new Promise(r => setTimeout(r, 50))
  }
  return true
}

export function isPrinterConnected(): boolean {
  return writeCharacteristic !== null
}

function concatArrays(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}
