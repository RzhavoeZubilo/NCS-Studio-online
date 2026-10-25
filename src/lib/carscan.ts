/**
 * Car bus scan and identification (research §3.2, §4.2).
 *
 * D-CAN E-series: tester transmits from 0xF1 (CAN ID 0x6F1); an ECU at
 * address A answers from source A (CAN ID 0x600|A).
 * Scan probe: KWP2000 StartDiagnosticSession (0x10 0x85) — read-only; any
 * answer (positive 0x50 or negative 0x7F) proves an ECU at that address.
 * Identification: UDS ReadDataByIdentifier 22 F1 50 returns the SGBD index
 * (research §1.2: "SGBD-Index 22 F150 INDEX XXXXXX (Hex)") — the index
 * resolves the exact .Cxx variant file (last byte = coding index).
 */

import type { KdCanSerial } from '@/lib/serial'

export interface FoundEcu {
  /** diagnostic address, 0x00–0xFF */
  address: number
  /** first response payload bytes (0x50 positive / 0x7F negative / ...) */
  response: number[]
  /** SGBD index reported by 22 F1 50, as uppercase hex string */
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

export async function scanBus(
  serial: KdCanSerial,
  onProgress: (p: ScanProgress) => void,
  shouldCancel: () => boolean,
  addresses?: number[],
): Promise<FoundEcu[]> {
  const list = addresses ?? Array.from({ length: 256 }, (_, i) => i)
  const found: FoundEcu[] = []
  const total = list.length
  let done = 0
  for (const address of list) {
    if (shouldCancel()) break
    if (address === 0xf1) {
      // tester's own virtual address — skip
      done++
      continue
    }
    try {
      const resp = await serial.request(address, new Uint8Array([0x10, 0x85]), SCAN_TIMEOUT_MS)
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
  // Close diagnostic sessions on every found ECU — leaving them open makes
  // some ECUs (steering, airbag) log a diagnostic event.
  if (!shouldCancel()) {
    await closeSessions(serial, found, shouldCancel)
    onProgress({ done, total, found: [...found] })
  }
  return found
}

/**
 * Closes the diagnostic session on every found ECU (10 81 endDiagnosticSession).
 */
export async function closeSessions(
  serial: KdCanSerial,
  found: FoundEcu[],
  shouldCancel: () => boolean,
): Promise<void> {
  for (const ecu of found) {
    if (shouldCancel()) return
    try {
      await serial.request(ecu.address, new Uint8Array([0x10, 0x81]), 80)
    } catch {
      // best effort — unclosed sessions are cleared at the next scan
    }
  }
}

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}

/**
 * Reads the SGBD index of one ECU: 22 F1 50 → 62 F1 50 <payload>.
 * The payload's last byte is the coding index used in .Cxx file names
 * (RAD22.C32 → index 0x32).
 */
export async function readSgbdIndex(
  serial: KdCanSerial,
  address: number,
): Promise<{ sgbdIndex: string; codingIndex: number } | null> {
  try {
    const resp = await serial.request(address, new Uint8Array([0x22, 0xf1, 0x50]), 250)
    for (const tel of resp) {
      if (tel.source !== address) continue
      const d = tel.data
      // positive response: 62 F1 50 [payload...]
      if (d.length >= 5 && d[0] === 0x62 && d[1] === 0xf1 && d[2] === 0x50) {
        const payload = [...d.subarray(3)]
        return { sgbdIndex: toHex(payload), codingIndex: payload[payload.length - 1] }
      }
      // negative response (0x7F ...) — ECU present but does not support F150
      if (d[0] === 0x7f) return null
    }
  } catch {
    // communication hiccup — treat as unknown
  }
  return null
}

export interface ResolvedEcu extends FoundEcu {
  /** exact variant file, e.g. "RAD22.C32" (resolved via the SGBD index) */
  variantFile?: string
}

/**
 * Resolves the exact variant file for an ECU: among the address candidates
 * (from the T_GRTB assignment table) finds the module whose file name matches
 * the reported SGBD index (SGNAME.C<codingIndex>).
 */
export function resolveVariant(
  ecu: FoundEcu,
  candidates: { fileName: string; codingIndex: number }[],
): string | undefined {
  if (ecu.codingIndex === undefined) return undefined
  const matches = candidates.filter((c) => c.codingIndex === ecu.codingIndex)
  return matches.length === 1 ? matches[0].fileName : undefined
}

/** Reads the VIN from the CAS (address 0x40): 22 F1 90 → 62 F1 90 + 17 chars. */
export async function readVin(serial: KdCanSerial, casAddress = 0x40): Promise<string | null> {
  try {
    const resp = await serial.request(casAddress, new Uint8Array([0x22, 0xf1, 0x90]), 300)
    for (const tel of resp) {
      if (tel.source !== casAddress) continue
      const d = tel.data
      if (d.length >= 20 && d[0] === 0x62 && d[1] === 0xf1 && d[2] === 0x90) {
        const vin = String.fromCharCode(...d.subarray(3, 20))
        return /^[A-Z0-9]{17}$/.test(vin) ? vin : null
      }
      if (d[0] === 0x7f) return null
    }
  } catch {
    // no VIN from this module
  }
  return null
}
