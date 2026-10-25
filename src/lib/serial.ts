/**
 * Web Serial transport for K+DCAN adapters (research §1.6, §4.1):
 * open at 115200 8N1, raise DTR/RTS, exchange raw BMW-FAST telegrams.
 * Both "smart" and "dumb" cables speak plain BMW-FAST in D-CAN mode;
 * a smart adapter additionally answers adapter-info commands (§1.5).
 */

import {
  TelegramParser,
  buildTelegram,
  bytesEqual,
  type Telegram,
} from '@/lib/kdcan'

interface SerialPortLike {
  open(o: {
    baudRate: number
    dataBits: number
    stopBits: number
    parity: 'none' | 'even' | 'odd'
    bufferSize?: number
    flowControl?: 'none' | 'hardware'
  }): Promise<void>
  setSignals(s: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>
  close(): Promise<void>
  readable: {
    getReader(): {
      read(): Promise<{ value?: Uint8Array; done: boolean }>
      releaseLock(): void
      cancel(): Promise<void>
    }
  } | null
  writable: {
    getWriter(): { write(d: Uint8Array): Promise<void>; releaseLock(): void }
  } | null
}

export interface AdapterInfo {
  /** undefined for a dumb FTDI passthrough */
  type?: number
  version?: number
  voltage?: number
  /** ignition status byte from the adapter, if reported */
  ignition?: number
}

export class SerialUnavailableError extends Error {
  constructor() {
    super('Web Serial is not available in this browser')
  }
}

interface ReaderLike {
  read(): Promise<{ value?: Uint8Array; done: boolean }>
  releaseLock(): void
  cancel(): Promise<void>
}

export class KdCanSerial {
  private port: SerialPortLike | null = null
  private reader: ReaderLike | null = null
  private parser = new TelegramParser()
  private closed = false
  private collector: ((tel: Telegram) => void) | null = null
  private lastSent: Telegram | null = null

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  get connected(): boolean {
    return this.port !== null
  }

  async connect(): Promise<void> {
    if (this.port) return
    if (!KdCanSerial.isSupported()) throw new SerialUnavailableError()
    const nav = navigator as Navigator & {
      serial?: {
        requestPort(): Promise<SerialPortLike>
        getPorts(): Promise<SerialPortLike[]>
      }
    }
    if (!nav.serial) throw new SerialUnavailableError()
    // Reuse an already-granted port when possible (no permission prompt).
    const ports = await nav.serial.getPorts()
    const port = ports[0] ?? (await nav.serial.requestPort())
    if (!port) throw new Error('no port selected')
    await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 4096, flowControl: 'none' })
    // DTR/RTS high — required for dumb FTDI passthrough K-line direction.
    await port.setSignals({ dataTerminalReady: true, requestToSend: true })
    this.port = port
    this.closed = false
    void this.readLoop()
  }

  private async readLoop(): Promise<void> {
    const readable = this.port?.readable
    if (!readable) return
    this.reader = readable.getReader()
    try {
      for (;;) {
        const { value, done } = await this.reader.read()
        if (done || this.closed) break
        if (!value || !this.collector) continue
        const tels = this.parser.feed(value)
        for (const tel of tels) {
          if (this.lastSent && this.isEcho(tel)) continue // smart adapters repeat the sent telegram
          this.collector(tel)
        }
      }
    } catch {
      // port lost (unplug) — surfaced through connected state
    } finally {
      try {
        this.reader.releaseLock()
      } catch {
        // reader already released
      }
      this.reader = null
    }
  }

  private isEcho(tel: Telegram): boolean {
    const sent = this.lastSent
    return !!sent && tel.target === sent.target && tel.source === sent.source && bytesEqual(tel.data, sent.data)
  }

  async sendTelegram(target: number, data: Uint8Array): Promise<void> {
    const writable = this.port?.writable
    if (!writable) throw new Error('serial port is not open')
    this.lastSent = { target, source: 0xf1, data: new Uint8Array(data) }
    await this.send(buildTelegram(target, data))
  }

  private async send(raw: Uint8Array): Promise<void> {
    const writable = this.port?.writable
    if (!writable) throw new Error('serial port is not open')
    const writer = writable.getWriter()
    try {
      await writer.write(raw)
    } finally {
      writer.releaseLock()
    }
  }

  /** Sends one telegram and collects responses within `timeoutMs`. */
  async request(target: number, data: Uint8Array, timeoutMs = 300): Promise<Telegram[]> {
    if (!this.port) throw new Error('serial port is not open')
    const responses: Telegram[] = []
    this.collector = (tel) => {
      // A reply comes from the addressed ECU (source = target) or the adapter (F1).
      if (tel.source === target || tel.source === 0xf1 || tel.target === 0xf1) responses.push(tel)
    }
    await this.sendTelegram(target, data)
    await new Promise((r) => setTimeout(r, timeoutMs))
    this.collector = null
    return responses
  }

  async disconnect(): Promise<void> {
    this.closed = true
    try {
      await this.reader?.cancel()
    } catch {
      // reader may already be gone with the unplugged port
    }
    try {
      await this.port?.close()
    } catch {
      // port already removed
    }
    this.port = null
  }
}

export interface AdapterProbeResult {
  kind: 'smart' | 'dumb'
  info: AdapterInfo
}

/** Probes the adapter type, ignition and voltage (research §1.5). */
export async function probeAdapter(serial: KdCanSerial): Promise<AdapterProbeResult> {
  const info: AdapterInfo = {}
  let kind: 'smart' | 'dumb' = 'dumb'
  const typeResp = await serial.request(0xf1, new Uint8Array([0xfd]), 300)
  for (const tel of typeResp) {
    if (tel.source === 0xf1 && tel.data.length >= 4) {
      // payload: FD type_hi type_lo ver_hi ver_lo ...
      const type = (tel.data[1] << 8) | tel.data[2]
      if (type >= 0x0002) {
        kind = 'smart'
        info.type = type
        info.version = (tel.data[3] << 8) | (tel.data[4] ?? 0)
      }
      break
    }
  }
  if (kind === 'smart') {
    const ign = await serial.request(0xf1, new Uint8Array([0xfe]), 200)
    for (const tel of ign) {
      if (tel.source === 0xf1 && tel.data.length >= 2) {
        info.ignition = tel.data[1]
        break
      }
    }
    const volt = await serial.request(0xf1, new Uint8Array([0xfc]), 200)
    for (const tel of volt) {
      if (tel.source === 0xf1 && tel.data.length >= 2) {
        info.voltage = tel.data[1] / 10
        break
      }
    }
  }
  return { kind, info }
}
