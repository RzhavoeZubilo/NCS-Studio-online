/**
 * Human labels for ECUs: joins bus addresses, variant files (KOMB87.C0B) and
 * the T_GRTB assignment table (address → SGBD, group, German name).
 */

import type { EcuAddressEntry } from '@/lib/grtb'
import type { SpDatenIndex, SpDatenModule } from '@/lib/spdaten'
import { E89X_ECU_NAMES } from '@/data/ecuNamesE89x'

export interface EcuLabel {
  /** short ECU name, e.g. "KOMBI" */
  short: string
  /** German module name from T_GRTB, '' if unknown */
  long: string
}

/** "KOMB87.C0B" → "KOMB87" */
export function sgbdOf(fileName: string): string {
  return fileName.split('.')[0].toUpperCase()
}

/** "D_KOMBI" / "G_JBBF" → "KOMBI" / "JBBF" */
function groupLabel(group: string): string {
  return group.replace(/^[DG]_/i, '').toUpperCase()
}

const bySgbdCache = new WeakMap<SpDatenIndex, Map<string, EcuAddressEntry>>()

function entriesBySgbd(spDaten: SpDatenIndex): Map<string, EcuAddressEntry> {
  let map = bySgbdCache.get(spDaten)
  if (!map) {
    map = new Map()
    for (const list of spDaten.ecuByAddress.values()) {
      for (const e of list) {
        const key = e.sgbd.toUpperCase()
        if (key && !map.has(key)) map.set(key, e)
      }
    }
    bySgbdCache.set(spDaten, map)
  }
  return map
}

function fromEntry(e: EcuAddressEntry): EcuLabel {
  return { short: groupLabel(e.group) || e.sgbd.toUpperCase(), long: e.name }
}

export function ecuLabel(
  spDaten: SpDatenIndex | null,
  sel: { address?: number; fileName?: string },
): EcuLabel {
  if (spDaten && sel.fileName) {
    const e = entriesBySgbd(spDaten).get(sgbdOf(sel.fileName))
    if (e) return fromEntry(e)
  }
  if (spDaten && sel.address !== undefined) {
    const e = spDaten.ecuByAddress.get(sel.address)?.[0]
    if (e) return fromEntry(e)
  }
  if (sel.fileName) return { short: sgbdOf(sel.fileName), long: '' }
  // without a T_GRTB table (no SP-Daten, or a selection without ecu\) fall
  // back to the built-in E81–E93 address list
  const builtIn = sel.address !== undefined && !spDaten?.ecuByAddress.size ? E89X_ECU_NAMES[sel.address] : undefined
  if (builtIn) return { short: builtIn, long: '' }
  return { short: sel.address !== undefined ? hexAddr(sel.address) : '?', long: '' }
}

/** Variant files that may sit at a bus address (by the T_GRTB SGBD names). */
export function variantCandidates(spDaten: SpDatenIndex, address: number): SpDatenModule[] {
  const sgbds = (spDaten.ecuByAddress.get(address) ?? []).map((e) => e.sgbd.toUpperCase())
  return spDaten.modules.filter((m) => sgbds.some((s) => s && m.fileName.startsWith(s)))
}

export function hexAddr(a: number): string {
  return '0x' + a.toString(16).toUpperCase().padStart(2, '0')
}
