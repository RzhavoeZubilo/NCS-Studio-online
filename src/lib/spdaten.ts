/**
 * Indexing of an NCS Expert SP-Daten chassis folder (e.g. SP-Daten 69.0\E89).
 *
 * Takes the file list of the folder's `daten\` subfolder, parses the keyword
 * tables (function/value names), the module family map (SGET) and every
 * module coding file (*.Cxx) — building the data for the options tree.
 */

import {
  parseChassisMap,
  parseKeywordTable,
  parseModuleCoding,
  parseModuleFamilies,
  ModuleStatus,
  type ModuleFunction,
} from '@/lib/ncsdata'
import { parsePrg } from '@/lib/prg'
import { parseZuordnung, indexByAddress, type EcuAddressEntry } from '@/lib/grtb'

export interface SpDatenModule {
  /** e.g. "RAD22.C32" (upper case) */
  fileName: string
  /** ECU family from SGET.000, '' if unknown */
  family: string
  codingIndex: number
  functions: ModuleFunction[]
}

export interface SpDatenIndex {
  folderName: string
  /** function id -> name */
  fswNames: Map<number, string>
  /** value id -> name */
  pswNames: Map<number, string>
  /** chassis replacement map from BR_REF.DAT */
  chassisMap: { chassis: string; folder: string }[]
  modules: SpDatenModule[]
  /** T_GRTB.PRG: diagnostic address -> module entries (name, SGBD, chassis) */
  ecuByAddress: Map<number, EcuAddressEntry[]>
  /** files that could not be parsed as any known type */
  skipped: string[]
}

export interface SpDatenItem {
  name: string
  data: Uint8Array
}

const MODULE_FILE = /^[A-Z0-9_]+\.C[0-9A-F]{2}$/
const KEYWORD_FILE = /^SWTFSW/i
const VALUE_FILE = /^SWTPSW/i
const FAMILIES_FILE = /SGET\.000$/i
const CHASSIS_MAP_FILE = /^BR_REF\.DAT$/i
const TGRB_FILE = /^T_GRTB\.PRG$/i

const upper = (s: string) => s.toUpperCase()

export function indexSpDatenItems(items: SpDatenItem[], folderName: string): SpDatenIndex {
  const fswNames = new Map<number, string>()
  const pswNames = new Map<number, string>()
  const families = new Map<string, string>()
  let chassisMap: { chassis: string; folder: string }[] = []
  let tgrtbEntries: EcuAddressEntry[] = []
  const modules: SpDatenModule[] = []
  const skipped: string[] = []

  for (const item of items) {
    const name = upper(item.name)
    try {
      if (KEYWORD_FILE.test(name)) {
        for (const [k, id] of parseKeywordTable(item.data)) {
          if (!fswNames.has(id)) fswNames.set(id, k)
        }
      } else if (VALUE_FILE.test(name)) {
        for (const [k, id] of parseKeywordTable(item.data)) {
          if (!pswNames.has(id)) pswNames.set(id, k)
        }
      } else if (FAMILIES_FILE.test(name)) {
        for (const f of parseModuleFamilies(item.data)) families.set(f.file, f.family)
      } else if (CHASSIS_MAP_FILE.test(name)) {
        chassisMap = parseChassisMap(item.data)
      } else if (TGRB_FILE.test(name)) {
        tgrtbEntries = parseZuordnung(parsePrg(item.data))
      } else if (MODULE_FILE.test(name)) {
        const coding = parseModuleCoding(item.data)
        if (coding.status === ModuleStatus.MODULE_OK) {
          modules.push({
            fileName: name,
            family: families.get(name) ?? '',
            codingIndex: coding.codingIndex,
            functions: coding.functions,
          })
        } else {
          skipped.push(name)
        }
      } else {
        skipped.push(name)
      }
    } catch {
      skipped.push(name)
    }
  }

  // Families are defined in SGET.000 which may come after the modules.
  for (const m of modules) {
    if (!m.family) m.family = families.get(m.fileName) ?? ''
  }
  modules.sort((a, b) => a.fileName.localeCompare(b.fileName))

  const ecuByAddress = indexByAddress(tgrtbEntries)
  return { folderName, fswNames, pswNames, chassisMap, ecuByAddress, modules, skipped }
}

/** Collects {name, data} items from a File list (input[multiple] or folder pick). */
export async function readSpDatenFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<SpDatenItem[]> {
  const items: SpDatenItem[] = []
  const wanted = files.filter((f) => {
    const n = upper(f.name)
    return (
      MODULE_FILE.test(n) ||
      KEYWORD_FILE.test(n) ||
      VALUE_FILE.test(n) ||
      FAMILIES_FILE.test(n) ||
      CHASSIS_MAP_FILE.test(n) ||
      TGRB_FILE.test(n)
    )
  })
  let done = 0
  for (const file of wanted) {
    items.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) })
    onProgress?.(++done, wanted.length)
  }
  return items
}
