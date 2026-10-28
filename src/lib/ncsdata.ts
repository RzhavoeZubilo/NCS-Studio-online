/**
 * Parser for NCS Expert SP-Daten files (DATEN\<chassis>\ folder).
 *
 * TypeScript port of NCS-Workbench's ncsdata.h (GPL-3.0, © ak-tr):
 * https://github.com/ak-tr/NCS-Workbench
 *
 * Every file is a list of records: length (1 byte), type (2 bytes, little
 * endian), payload (length bytes), a check byte. The header defines tables:
 * type 0x0300 = table id (u16) + name, 0x0400 = field format, 0x0500 = field
 * names, 0xFF00 = end of header. Data records use the table id as their type.
 *
 * Files used:
 *   BR_REF.DAT     chassis -> shared DATEN folder (E91 -> E89)
 *   SWTFSW*.DAT    function name -> id
 *   SWTPSW*.DAT    value name -> id (same format)
 *   <folder>SGET.000  module file -> ECU family (MK60_87.C0A -> DSC)
 *   <module>.Cxx   a module's coding data, incl. the function ids it codes.
 *                  The name is SGNAME.C + the coding index in hex; the file
 *                  says the index again in SGID_CODIERINDEX.
 *
 * In a module file, each PARZUWEISUNG_FSW record (a function with a list of
 * values) is followed by its values: PARZUWEISUNG_PSW1 records (value id +
 * data), with PARZUWEISUNG_PSW2 records (more data) in between.
 * PARZUWEISUNG_DIR records are functions coded with a direct number instead.
 */

export interface NcsRecord {
  type: number
  data: Uint8Array
}

export function parseNcsRecords(p: Uint8Array): NcsRecord[] {
  const out: NcsRecord[] = []
  let i = 0
  while (i + 3 <= p.length) {
    const len = p[i]
    if (i + 3 + len + 1 > p.length) break // trailing bytes after the last record
    const type = p[i + 1] | (p[i + 2] << 8)
    out.push({ type, data: p.subarray(i + 3, i + 3 + len) })
    i += 3 + len + 1
  }
  return out
}

function ncsString(r: NcsRecord, start: number): string {
  if (start >= r.data.length) return ''
  let end = start
  while (end < r.data.length && r.data[end] !== 0) ++end
  return latin1(r.data.subarray(start, end))
}

function ncsWord(r: NcsRecord, at: number): number {
  return at + 2 <= r.data.length ? r.data[at] | (r.data[at + 1] << 8) : 0
}

function latin1(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

export interface NcsTable {
  /** -1 if the file doesn't define the table */
  id: number
  format: string
  /** field names, comma-separated */
  fields: string
}

export function findNcsTable(recs: NcsRecord[], name: string): NcsTable {
  const t: NcsTable = { id: -1, format: '', fields: '' }
  let current = false
  for (const r of recs) {
    if ((r.type & 0xff) !== 0) continue // data record
    const kind = r.type >> 8
    if (kind === 0xff) break
    if (kind === 3) {
      current = ncsString(r, 2) === name
      if (current) t.id = ncsWord(r, 0)
    } else if (kind === 4 && current) {
      t.format = ncsString(r, 0)
    } else if (kind === 5 && current) {
      t.fields = ncsString(r, 0)
    }
  }
  return t
}

/** SWTFSW*.DAT / SWTPSW*.DAT: name -> id (table SWT_EINTRAG, format "WS"). */
export function parseKeywordTable(p: Uint8Array): Map<string, number> {
  const out = new Map<string, number>()
  const recs = parseNcsRecords(p)
  const t = findNcsTable(recs, 'SWT_EINTRAG')
  if (t.id <= 0 || t.format !== 'WS') return out
  for (const r of recs) {
    if (r.type === t.id && r.data.length > 2) out.set(ncsString(r, 2), ncsWord(r, 0))
  }
  return out
}

/** id -> name, from parseKeywordTable's name -> id. */
export function invertKeywords(keywords: ReadonlyMap<string, number>): Map<number, string> {
  const out = new Map<number, string>()
  for (const [name, id] of keywords) {
    if (!out.has(id)) out.set(id, name) // an id listed twice keeps its first name
  }
  return out
}

export interface ModuleFunction {
  id: number
  /** PARZUWEISUNG_DIR: coded with a number, no list of values */
  direct: boolean
  /** value (PSW) ids, in file order, unique */
  values: number[]
}

export type ModuleStatus =
  | 'ok'
  | 'not-ncs' // no records or no table header: not an SP-Daten file
  | 'no-functions' // no PARZUWEISUNG_FSW table
  | 'unsupported' // the table is there, in an unknown format

export const ModuleStatus = {
  MODULE_OK: 'ok',
  MODULE_NOT_NCS: 'not-ncs',
  MODULE_NO_FUNCTIONS: 'no-functions',
  MODULE_UNSUPPORTED: 'unsupported',
} as const

export interface ModuleCoding {
  status: ModuleStatus
  /** SGID_CODIERINDEX, -1 if missing */
  codingIndex: number
  /** file order; a function listed twice is merged */
  functions: ModuleFunction[]
}

/**
 * Function id of a PARZUWEISUNG_FSW / _DIR record, format "{L}LWW...": a
 * counted list of 4-byte values (count byte first), a 4-byte value, a word,
 * then the function id (word). False if the record is too short.
 */
function moduleRecordFunction(r: NcsRecord): number | null {
  if (r.data.length === 0) return null
  const at = 1 + 4 * r.data[0] + 4 + 2
  if (at + 2 > r.data.length) return null
  return ncsWord(r, at)
}

/** Module coding file (*.Cxx): its coding index, functions and their values. */
export function parseModuleCoding(p: Uint8Array): ModuleCoding {
  const recs = parseNcsRecords(p)
  const fsw = findNcsTable(recs, 'PARZUWEISUNG_FSW')
  if (fsw.id < 0) {
    let header = false
    for (const r of recs) {
      if (r.type === 0xff00) {
        header = true
        break
      }
    }
    return { status: header ? ModuleStatus.MODULE_NO_FUNCTIONS : ModuleStatus.MODULE_NOT_NCS, codingIndex: -1, functions: [] }
  }
  if (fsw.id === 0 || !fsw.format.startsWith('{L}LWW')) {
    return { status: ModuleStatus.MODULE_UNSUPPORTED, codingIndex: -1, functions: [] }
  }
  const dir = findNcsTable(recs, 'PARZUWEISUNG_DIR')
  const psw1 = findNcsTable(recs, 'PARZUWEISUNG_PSW1')
  const psw2 = findNcsTable(recs, 'PARZUWEISUNG_PSW2')
  const index = findNcsTable(recs, 'SGID_CODIERINDEX')
  const dirOk = dir.id > 0 && dir.format.startsWith('{L}LWW')
  const valuesOk = psw1.id > 0 && psw1.format.startsWith('W')

  const where = new Map<number, number>() // function id -> index in functions
  const functions: ModuleFunction[] = []
  let current = -1 // function the next PSW1 records belong to
  let codingIndex = -1

  for (const r of recs) {
    if ((r.type & 0xff) === 0 && r.type >> 8 !== 0) continue // header record
    const isFsw = r.type === fsw.id
    const isDir = dirOk && r.type === dir.id
    if (isFsw || isDir) {
      const id = moduleRecordFunction(r)
      if (id !== null) {
        let idx = where.get(id)
        if (idx === undefined) {
          functions.push({ id, direct: isDir, values: [] })
          idx = functions.length - 1
          where.set(id, idx)
        } else if (isFsw) {
          functions[idx].direct = false // a list of values after all
        }
        current = isFsw ? idx : -1
        continue
      }
    }
    if (valuesOk && r.type === psw1.id) {
      if (current >= 0 && r.data.length >= 2) {
        const v = functions[current].values
        const value = ncsWord(r, 0)
        if (!v.includes(value)) v.push(value)
      }
    } else if (psw2.id > 0 && r.type === psw2.id) {
      // more data for the value before it
    } else if (index.id > 0 && r.type === index.id) {
      if (r.data.length >= 1 && codingIndex < 0) codingIndex = r.data[0]
      current = -1
    } else {
      current = -1 // another table: the run of values has ended
    }
  }
  return { status: ModuleStatus.MODULE_OK, codingIndex, functions }
}

/**
 * Module coding file (*.Cxx): ids of the non-direct functions it codes from
 * its PARZUWEISUNG_FSW table, sorted and unique (module detection).
 */
export function parseModuleFunctions(p: Uint8Array): number[] {
  const m = parseModuleCoding(p)
  const ids = m.functions.filter((f) => !f.direct).map((f) => f.id)
  return [...new Set(ids)].sort((a, b) => a - b)
}

/** Splits "A,B,C". */
function splitFieldNames(s: string): string[] {
  return s.split(',')
}

export interface ModuleFamily {
  /** e.g. "MK60_87.C0A" (upper case) */
  file: string
  /** e.g. "DSC" */
  family: string
  /** diagnostic SGBDs served by this coding file (T_GRTB names, e.g. KMBI_PL2 → KOMB87) */
  sgbds: string[]
}

/**
 * <folder>SGET.000: module file name -> ECU family, e.g. MK60_87.C0A -> DSC.
 * Tables SGAUSWAHL_* list SGNAME (MK60_87), CBD (C0A) and UMRSG (DSC) among
 * their leading string fields; SGAUSWAHL_SGBD also names the diagnostic SGBD
 * (KMBI_PL2.C08 → KOMB87). Keys are upper case.
 */
export function parseModuleFamilies(p: Uint8Array): ModuleFamily[] {
  const out = new Map<string, { family: string; sgbds: Set<string> }>()
  const recs = parseNcsRecords(p)
  const tables = ['SGAUSWAHL_SGBD', 'SGAUSWAHL_VM', 'SGAUSWAHL_VMSGBD']
  for (const name of tables) {
    const t = findNcsTable(recs, name)
    if (t.id <= 0) continue
    const names = splitFieldNames(t.fields)
    let strings = 0 // leading string fields, readable one after another
    while (strings < t.format.length && t.format[strings] === 'S') ++strings
    let sg = -1, cbd = -1, family = -1, sgbd = -1
    for (let i = 0; i < names.length && i < strings; i++) {
      if (names[i] === 'SGNAME') sg = i
      else if (names[i] === 'CBD') cbd = i
      else if (names[i] === 'UMRSG') family = i
      else if (names[i] === 'SGBD') sgbd = i
    }
    if (sg < 0 || cbd < 0 || family < 0) continue
    for (const r of recs) {
      if (r.type !== t.id) continue
      const values: string[] = []
      let at = 0
      for (let f = 0; f < strings; f++) {
        const s = ncsString(r, at)
        values.push(s)
        at += s.length + 1
      }
      if (!values[sg] || !values[cbd] || !values[family]) continue
      const file = (values[sg] + '.' + values[cbd]).toUpperCase()
      const entry = out.get(file) ?? { family: values[family], sgbds: new Set<string>() }
      if (sgbd >= 0 && values[sgbd]) entry.sgbds.add(values[sgbd].toUpperCase())
      out.set(file, entry)
    }
  }
  return [...out.entries()].map(([file, e]) => ({ file, family: e.family, sgbds: [...e.sgbds] }))
}

export interface ChassisMapEntry {
  /** e.g. "E91" */
  chassis: string
  /** e.g. "E89" */
  folder: string
}

/** BR_REF.DAT: (chassis, DATEN folder) pairs, e.g. (E91, E89). Table BR_ERSATZ, format "SS". */
export function parseChassisMap(p: Uint8Array): ChassisMapEntry[] {
  const out: ChassisMapEntry[] = []
  const recs = parseNcsRecords(p)
  const t = findNcsTable(recs, 'BR_ERSATZ')
  if (t.id <= 0 || t.format !== 'SS') return out
  for (const r of recs) {
    if (r.type !== t.id) continue
    const chassis = ncsString(r, 0)
    const folder = ncsString(r, chassis.length + 1)
    if (chassis && folder) out.push({ chassis, folder })
  }
  return out
}

// ---------------------------------------------------------------------------
// Trace <-> module matching (NCS-Workbench ncsdata.h: MapFunctionNames,
// CountSharedFunctions, PickModule)

/** Ids of the trace's function names; names the table doesn't know are skipped. */
export function mapFunctionNames(
  names: string[],
  keywords: ReadonlyMap<string, number>,
): number[] {
  const ids: number[] = []
  for (const name of names) {
    const id = keywords.get(name.toLowerCase())
    if (id !== undefined) ids.push(id)
  }
  return [...new Set(ids)].sort((a, b) => a - b)
}

/** How many of the trace's function ids a module codes (both sorted). */
export function countSharedFunctions(trace: number[], module: number[]): number {
  let hits = 0
  for (const id of trace) {
    if (module.includes(id)) hits++
  }
  return hits
}

/**
 * Index of the module that clearly matches a trace with traceCount functions:
 * it codes at least 80% of them and more than twice as many as the runner-up.
 * -1 if no module is a clear match.
 */
export function pickModule(hits: number[], traceCount: number): number {
  let best = -1
  let runnerUp = 0
  for (let i = 0; i < hits.length; i++) {
    if (best < 0 || hits[i] > hits[best]) {
      if (best >= 0) runnerUp = hits[best]
      best = i
    } else if (hits[i] > runnerUp) {
      runnerUp = hits[i]
    }
  }
  if (
    best < 0 ||
    traceCount <= 0 ||
    hits[best] * 5 < traceCount * 4 ||
    hits[best] <= runnerUp * 2
  ) {
    return -1
  }
  return best
}
