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

/** ISTA / NCS Expert spell these E81–E93 ECUs differently from EdiabasLib. */
const ISTA_NAMES: Record<number, string> = {
  0x00: 'JBE',
  0x12: 'DME',
  0x56: 'FZD',
  0x63: 'CCC / M-ASK / RAD2',
  0x78: 'IHKA',
}

/** ECUs named after the installed variant: head unit, its MOST gateway, engine. */
function variantName(address: number, sgbd: string): string | undefined {
  if (address === 0x12) return /^D/i.test(sgbd) ? 'DDE' : 'DME'
  if (address === 0x62 || address === 0x63) return sgbd.toUpperCase().replace(/_/g, '-')
  return undefined
}

function byAddress(spDaten: SpDatenIndex | null, address: number, sgbd?: string): EcuLabel {
  const entries = spDaten?.ecuByAddress.get(address) ?? []
  const entry = entries.find((e) => sgbd && e.sgbd.toUpperCase() === sgbd.toUpperCase()) ?? entries[0]
  const long = entry?.name ?? ''
  const fromVariant = sgbd ? variantName(address, sgbd) : undefined
  if (fromVariant) return { short: fromVariant, long }
  // a chassis folder other than E89 (E60, E70…): its own T_GRTB group names
  const otherChassis = !!spDaten && /^[A-Z]\d{2,3}$/i.test(spDaten.folderName) && !/^E89$/i.test(spDaten.folderName)
  const builtIn = otherChassis ? undefined : (ISTA_NAMES[address] ?? E89X_ECU_NAMES[address])
  const short = builtIn ?? (entry ? groupLabel(entry.group) || entry.sgbd.toUpperCase() : hexAddr(address))
  return { short, long }
}

export function ecuLabel(
  spDaten: SpDatenIndex | null,
  sel: { address?: number; fileName?: string; sgbd?: string },
): EcuLabel {
  if (sel.address !== undefined) return byAddress(spDaten, sel.address, sel.sgbd)
  if (spDaten && sel.fileName) {
    const e = entriesBySgbd(spDaten).get(sgbdOf(sel.fileName))
    if (e) return byAddress(spDaten, e.address, e.sgbd)
    // coding files named unlike their SGBD (KMBI_PL2.C08): match the SGET family
    const family = spDaten.modules.find((m) => m.fileName === sel.fileName)?.family.toUpperCase()
    for (const list of family ? spDaten.ecuByAddress.values() : []) {
      const f = list.find((x) => groupLabel(x.group) === family)
      if (f) return byAddress(spDaten, f.address)
    }
  }
  return { short: sel.fileName ? sgbdOf(sel.fileName) : '?', long: '' }
}

/**
 * Coding files that may serve a bus address: modules SGET links to the T_GRTB
 * SGBD (KOMB87 → KMBI_PL2.C08), modules named after it (RAD2 → RAD2.C0x) or
 * of the same ECU family (D_KOMBI → KOMBI). With the diagnostic index from 1A 80 only
 * the exact T_GRTB variant is considered.
 */
export function variantCandidates(spDaten: SpDatenIndex, address: number, diagIndex?: number): SpDatenModule[] {
  const entries = spDaten.ecuByAddress.get(address) ?? []
  const exact = diagIndex !== undefined ? entries.filter((e) => e.diagIndex === diagIndex) : []
  const pool = exact.length ? exact : entries
  const sgbds = pool.map((e) => e.sgbd.toUpperCase()).filter(Boolean)
  const families = pool.map((e) => groupLabel(e.group)).filter(Boolean)
  return spDaten.modules.filter(
    (m) =>
      m.sgbds.some((s) => sgbds.includes(s)) ||
      sgbds.some((s) => m.fileName.startsWith(s)) ||
      (!!m.family && families.includes(m.family.toUpperCase())),
  )
}

/** Exact SGBD variant (by diagnostic index) and coding file (by coding index) of a found ECU. */
export function resolveEcu(
  spDaten: SpDatenIndex,
  address: number,
  ident: { codingIndex: number; diagIndex?: number },
): { sgbd?: string; variantFile?: string } {
  const entries = spDaten.ecuByAddress.get(address) ?? []
  const exact = ident.diagIndex !== undefined ? entries.find((e) => e.diagIndex === ident.diagIndex) : undefined
  const matches = variantCandidates(spDaten, address, ident.diagIndex).filter((m) => m.codingIndex === ident.codingIndex)
  return { sgbd: exact?.sgbd, variantFile: matches.length === 1 ? matches[0].fileName : undefined }
}

export function hexAddr(a: number): string {
  return '0x' + a.toString(16).toUpperCase().padStart(2, '0')
}
