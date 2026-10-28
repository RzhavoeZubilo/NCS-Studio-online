/**
 * Car bus scan and identification (research §3.2, §4.2).
 *
 * D-CAN E-series: tester transmits from 0xF1 (CAN ID 0x6F1); an ECU at
 * address A answers from source A (CAN ID 0x600|A).
 * Scan probe: KWP2000 TesterPresent with responseRequired (0x3E 0x01, as in
 * KOMB87.prg job DIAGNOSE_AUFRECHT) — works in the default session and changes
 * no ECU state; any answer (positive 0x7E or negative 0x7F) proves an ECU at
 * that address. Functional (broadcast) addresses are never probed.
 * Identification: the coding index (readSgbdIndex) resolves the exact .Cxx
 * variant file.
 */

import type { KdCanSerial } from '@/lib/serial'

export interface FoundEcu {
  /** diagnostic address, 0x00–0xFF */
  address: number
  /** first response payload bytes (0x7E positive / 0x7F negative / ...) */
  response: number[]
  /** diagnostic index from 1A 80 (ID_DIAG_INDEX): picks the SGBD variant in T_GRTB */
  diagIndex?: number
  /** exact SGBD variant from T_GRTB, e.g. "RAD2_GW" */
  sgbd?: string
  /** SGBD index reported by 22 F1 50 (UDS ECUs), as uppercase hex string */
  sgbdIndex?: string
  /** coding index (last byte of the SGBD index), when readable */
  codingIndex?: number
  /** exact variant file resolved via the SGBD index, e.g. RAD22.C32 */
  variantFile?: string
}

export interface ScanProgress {
  done: number
  total: number
  found: FoundEcu[]
}

const SCAN_TIMEOUT_MS = 120

/** Functional (broadcast) addresses: 0xDF and 0xE6–0xEF (EdiabasLib IsFunctionalAddress). */
export function isFunctionalAddress(address: number): boolean {
  return address === 0xdf || (address >= 0xe6 && address <= 0xef)
}

export async function scanBus(
  serial: KdCanSerial,
  onProgress: (p: ScanProgress) => void,
  shouldCancel: () => boolean,
  addresses?: number[],
): Promise<FoundEcu[]> {
  const list = (addresses ?? Array.from({ length: 256 }, (_, i) => i)).filter(
    // tester's own virtual address and broadcast addresses are not ECUs
    (a) => a !== 0xf1 && !isFunctionalAddress(a),
  )
  const found: FoundEcu[] = []
  const total = list.length
  let done = 0
  for (const address of list) {
    if (shouldCancel()) break
    try {
      const resp = await serial.request(address, new Uint8Array([0x3e, 0x01]), SCAN_TIMEOUT_MS)
      const ecu = resp.find((tel) => tel.source === address && tel.data.length >= 1)
      if (ecu) {
        found.push({ address, response: [...ecu.data] })
        onProgress({ done, total, found: [...found] })
      }
    } catch {
      // ignore single-address failures during the scan
    }
    done++
    if (done % 8 === 0) onProgress({ done, total, found: [...found] })
  }
  onProgress({ done, total, found: [...found] })
  return found
}

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}

/**
 * Sends one request and returns the positive response payload — the service
 * id + 0x40 followed by the echoed parameter bytes — or null for a negative
 * answer (7F), a response-pending (7F xx 78) without a final answer, or silence.
 */
async function query(
  serial: KdCanSerial,
  address: number,
  request: number[],
  timeoutMs: number,
): Promise<Uint8Array | null> {
  try {
    const resp = await serial.request(address, new Uint8Array(request), timeoutMs)
    for (const tel of resp) {
      if (tel.source !== address) continue
      const d = tel.data
      if (d[0] === request[0] + 0x40 && request.slice(1).every((b, i) => d[i + 1] === b)) return d
    }
  } catch {
    // communication hiccup — treat as no answer
  }
  return null
}

/**
 * Reads the coding index of one ECU. E-series ECUs speak KWP2000:
 * 1A 80 ReadECUIdentification → 5A 80 ..., ID_COD_INDEX is payload byte 9 and
 * ID_DIAG_INDEX bytes 10–11 (KOMB87.prg job IDENT). UDS ECUs answer 22 F1 50 → 62 F1 50 <SGBD index>,
 * whose last byte is the coding index (RAD22.C32 → 0x32).
 */
export async function readSgbdIndex(
  serial: KdCanSerial,
  address: number,
): Promise<{ sgbdIndex?: string; codingIndex: number; diagIndex?: number } | null> {
  const ident = await query(serial, address, [0x1a, 0x80], 300)
  if (ident && ident.length > 11) return { codingIndex: ident[9], diagIndex: (ident[10] << 8) | ident[11] }
  if (ident && ident.length > 9) return { codingIndex: ident[9] }
  const uds = await query(serial, address, [0x22, 0xf1, 0x50], 250)
  if (uds && uds.length >= 4) {
    const payload = [...uds.subarray(3)]
    return { sgbdIndex: toHex(payload), codingIndex: payload[payload.length - 1] }
  }
  return null
}

/** First 17 VIN characters of an ASCII payload, or null. */
function parseVin(bytes: Uint8Array): string | null {
  const vin = String.fromCharCode(...bytes).replace(/[^A-Z0-9]/g, '').slice(0, 17)
  return /^[A-Z0-9]{17}$/.test(vin) ? vin : null
}

/**
 * Reads the VIN from the CAS (address 0x40). E-series: KWP2000 1A 90
 * (KOMB87.prg job C_FG_LESEN) → 5A 90 + ASCII; UDS fallback 22 F1 90.
 */
export async function readVin(serial: KdCanSerial, casAddress = 0x40): Promise<string | null> {
  const kwp = await query(serial, casAddress, [0x1a, 0x90], 500)
  if (kwp) return parseVin(kwp.subarray(2))
  const uds = await query(serial, casAddress, [0x22, 0xf1, 0x90], 500)
  return uds ? parseVin(uds.subarray(3)) : null
}

/**
 * Reads an ECU's coding blocks: KWP2000 22 <block hi> <block lo>
 * ReadDataByCommonIdentifier → 62 <block> <data> (KOMB87.prg job C_C_LESEN,
 * "$3000 - $3EFF CodingDataSet"). Read-only. Returns coding memory keyed by
 * byte address (block << 8) + offset, and the blocks that did not answer.
 */
export async function readCodingBlocks(
  serial: KdCanSerial,
  address: number,
  blocks: { block: number; address: number; length: number }[],
  onProgress: (done: number, total: number) => void,
  shouldCancel: () => boolean = () => false,
): Promise<{ mem: Map<number, number>; failed: number[] }> {
  const mem = new Map<number, number>()
  const failed: number[] = []
  let done = 0
  for (const b of blocks) {
    if (shouldCancel()) break
    const resp = await query(serial, address, [0x22, b.block >> 8, b.block & 0xff], 800)
    if (resp && resp.length > 3) {
      resp.subarray(3).forEach((byte, i) => mem.set(b.address + i, byte))
    } else failed.push(b.block)
    onProgress(++done, blocks.length)
  }
  return { mem, failed }
}
