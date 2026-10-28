/**
 * T_GRTB.PRG: the global "Zuordnungstabelle" (assignment table) shipped in
 * SP-Daten ecu\ — maps every diagnostic address to SGBD name, group,
 * chassis and the German module name. Parsed with our PRG decoder.
 *
 * Row formats:
 *   KWP (ZUORDNUNGSTABELLE):      "00 ---- 0100"  addr ---- index
 *   UDS (ZUORDNUNGSTABELLEUDS):   "00 0F1050"     addr index
 */

import { parsePrg, type PrgFile } from '@/lib/prg'

export interface EcuAddressEntry {
  /** diagnostic address 0x00–0xFF */
  address: number
  /** SGBD name, e.g. "JBBF87" */
  sgbd: string
  /** group file stem, e.g. "D_ZGM" / "G_JBBF" */
  group: string
  /** chassis the variant belongs to, e.g. "E87" */
  baureihe: string
  /** German module name, e.g. "Junction Box Beifahrer" */
  name: string
  /** KWP rows ("00 ---- 0100"): diagnostic index (ID_DIAG_INDEX) of this variant */
  diagIndex?: number
}

export function parseZuordnung(prg: PrgFile): EcuAddressEntry[] {
  const out: EcuAddressEntry[] = []
  for (const table of prg.tables) {
    if (!table.name.startsWith('ZUORDNUNGSTABELLE')) continue
    for (const row of table.rows) {
      const first = row[0] ?? ''
      const parts = first.trim().split(/\s+/)
      if (parts.length < 2) continue
      const address = parseInt(parts[0], 16)
      if (Number.isNaN(address) || address < 0 || address > 0xff) continue
      const diag = parts.length >= 3 ? parseInt(parts[parts.length - 1], 16) : NaN
      out.push({
        address,
        diagIndex: Number.isNaN(diag) ? undefined : diag,
        sgbd: row[1] ?? '',
        group: row[2] ?? '',
        baureihe: row[3] ?? '',
        name: row[4] ?? '',
      })
    }
  }
  return out
}

/** Indexes the entries by address, preserving table order. */
export function indexByAddress(entries: EcuAddressEntry[]): Map<number, EcuAddressEntry[]> {
  const map = new Map<number, EcuAddressEntry[]>()
  for (const e of entries) {
    const list = map.get(e.address)
    if (list) list.push(e)
    else map.set(e.address, [e])
  }
  return map
}

/** Reads T_GRTB.PRG bytes and extracts the address entries. */
export function parseTGrtb(data: Uint8Array): EcuAddressEntry[] {
  return parseZuordnung(parsePrg(data))
}
