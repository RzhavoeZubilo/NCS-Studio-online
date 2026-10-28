/**
 * Where each coding function lives in an ECU's coding memory, read from the
 * module file (*.Cxx), and decoding of raw coding bytes into FSW/PSW values.
 *
 * Record formats come from the file's own table header, e.g.
 *   PARZUWEISUNG_FSW  "{L}LWW{B}(B){B}{B}"  BLOCKNR,WORTADR,BYTEADR,FSW,INDEX,MASKE,EINHEIT,INDIVID
 *   PARZUWEISUNG_PSW1 "W(B)"                PSW,DATUM
 *   CODIERDATENBLOCK  "{L}LWS"              BLOCKNR,WORTADR,BYTEADR,BEZEICHNUNG
 * Field letters: B = byte, W = word, L = dword (little endian), S = string,
 * A = byte; {X} = list with a byte count, (X) = list with a word count.
 * A function's bytes start at (BLOCKNR << 8) + WORTADR — the address NCS Dummy
 * shows as "00300301" — and BYTEADR is their count ("Length"). A value's
 * DATUM is stored shifted down to the mask's lowest bit ("Mask 08 (00..01)").
 */

import { findNcsTable, parseNcsRecords, type NcsRecord } from '@/lib/ncsdata'

type Field = number | number[] | string

/** Splits "{L}LWW{B}(B)" into ["{L}", "L", "W", "W", "{B}", "(B)"]. */
function formatTokens(format: string): string[] {
  return format.match(/\{[A-Z]\}|\([A-Z]\)|[A-Z]/g) ?? []
}

const SIZE: Record<string, number> = { B: 1, A: 1, W: 2, L: 4 }

function readNumber(d: Uint8Array, at: number, size: number): number {
  let v = 0
  for (let i = size - 1; i >= 0; i--) v = v * 256 + (d[at + i] ?? 0)
  return v
}

/** Reads one record by its table's format; null when the record is too short. */
export function readFields(r: NcsRecord, format: string): Field[] | null {
  const d = r.data
  const out: Field[] = []
  let at = 0
  for (const tok of formatTokens(format)) {
    if (tok === 'S') {
      let end = at
      while (end < d.length && d[end] !== 0) end++
      out.push(String.fromCharCode(...d.subarray(at, end)))
      at = end + 1
      continue
    }
    if (tok.length === 3) {
      const size = SIZE[tok[1]] ?? 1
      const countSize = tok[0] === '{' ? 1 : 2
      if (at + countSize > d.length) return null
      const count = readNumber(d, at, countSize)
      at += countSize
      const list: number[] = []
      for (let i = 0; i < count; i++, at += size) list.push(readNumber(d, at, size))
      out.push(list)
      continue
    }
    const size = SIZE[tok] ?? 1
    if (at + size > d.length) return null
    out.push(readNumber(d, at, size))
    at += size
  }
  return at <= d.length ? out : null
}

export interface CodingBlock {
  /** e.g. 0x3000 */
  block: number
  /** first byte address, (block << 8) + word address */
  address: number
  length: number
  /** e.g. "Steuerung_Anzeige_1" */
  name: string
}

export interface CodingValue {
  /** PSW id */
  psw: number
  /** value bytes, shifted down to the mask's lowest bit */
  data: number[]
}

export interface CodingFunction {
  /** FSW id */
  fsw: number
  /** PARZUWEISUNG_DIR: a number, not a list of values */
  direct: boolean
  block: number
  /** first byte address, (block << 8) + word address */
  address: number
  /** byte count */
  length: number
  mask: number[]
  /** conditions (KENNUNG indices); empty = always */
  conditions: number[]
  values: CodingValue[]
}

export interface CodingLayout {
  blocks: CodingBlock[]
  functions: CodingFunction[]
}

export function parseCodingLayout(p: Uint8Array): CodingLayout {
  const recs = parseNcsRecords(p)
  const blockT = findNcsTable(recs, 'CODIERDATENBLOCK')
  const fswT = findNcsTable(recs, 'PARZUWEISUNG_FSW')
  const dirT = findNcsTable(recs, 'PARZUWEISUNG_DIR')
  const psw1T = findNcsTable(recs, 'PARZUWEISUNG_PSW1')
  const psw2T = findNcsTable(recs, 'PARZUWEISUNG_PSW2')

  const blocks: CodingBlock[] = []
  const functions: CodingFunction[] = []
  let current: CodingFunction | null = null
  let lastValue: CodingValue | null = null

  const place = (f: Field[]) => {
    const block = (f[0] as number[])[0] ?? 0
    return { block, address: block * 256 + (f[1] as number), length: f[2] as number }
  }

  for (const r of recs) {
    if ((r.type & 0xff) === 0 && r.type >> 8 !== 0) continue // header record
    if (blockT.id > 0 && r.type === blockT.id) {
      const f = readFields(r, blockT.format)
      if (f) blocks.push({ ...place(f), name: f[3] as string })
      current = null
    } else if ((fswT.id > 0 && r.type === fswT.id) || (dirT.id > 0 && r.type === dirT.id)) {
      const direct = r.type === dirT.id
      const f = readFields(r, direct ? dirT.format : fswT.format)
      current = null
      if (!f) continue
      current = {
        fsw: f[3] as number,
        direct,
        ...place(f),
        conditions: f[4] as number[],
        mask: f[5] as number[],
        values: [],
      }
      functions.push(current)
      lastValue = null
    } else if (psw1T.id > 0 && r.type === psw1T.id) {
      const f = readFields(r, psw1T.format)
      if (!f || !current || current.direct) continue
      lastValue = { psw: f[0] as number, data: [...(f[1] as number[])] }
      current.values.push(lastValue)
    } else if (psw2T.id > 0 && r.type === psw2T.id) {
      // more data for the value before
      const f = readFields(r, psw2T.format)
      if (f && lastValue) lastValue.data.push(...(f[0] as number[]))
    } else {
      current = null
      lastValue = null
    }
  }
  return { blocks, functions }
}

/** Coding memory: byte address → byte. */
export type CodingMemory = Map<number, number>

/** Parses nettodata lines "B 00300000,0010,C7,EE,…" (FSW_PSW.TRC / NETTODAT.TRC). */
export function parseNettodata(text: string): CodingMemory {
  const mem: CodingMemory = new Map()
  for (const line of text.split(/\r?\n/)) {
    const m = /^B ([0-9A-Fa-f]{8}),([0-9A-Fa-f]{1,4}),(.*)$/.exec(line.trim())
    if (!m) continue
    const start = parseInt(m[1], 16)
    m[3].split(',').forEach((h, i) => mem.set(start + i, parseInt(h, 16)))
  }
  return mem
}

/** Lowest set bit position of a multi-byte mask read as one big-endian number. */
function maskShift(mask: number[]): number {
  let shift = 0
  for (let i = mask.length - 1; i >= 0; i--) {
    const m = mask[i]
    if (m === 0) {
      shift += 8
      continue
    }
    let b = m
    while ((b & 1) === 0) {
      b >>= 1
      shift++
    }
    return shift
  }
  return 0
}

/** The function's bits from memory, shifted down; null when a byte is missing. */
export function extractValue(mem: CodingMemory, f: CodingFunction): number[] | null {
  let n = 0n
  let mask = 0n
  for (let i = 0; i < f.length; i++) {
    const b = mem.get(f.address + i)
    if (b === undefined) return null
    const m = f.mask[i] ?? 0xff
    n = (n << 8n) | BigInt(b & m)
    mask = (mask << 8n) | BigInt(m)
  }
  n >>= BigInt(maskShift(f.mask.length ? f.mask : new Array(f.length).fill(0xff)))
  // as many bytes as the shifted mask needs, most significant first
  let width = 0
  for (let m = mask >> BigInt(maskShift(f.mask)); m > 0n; m >>= 8n) width++
  const out: number[] = []
  for (let i = Math.max(width, 1) - 1; i >= 0; i--) out.push(Number((n >> BigInt(8 * i)) & 0xffn))
  return out
}

function sameValue(a: number[], b: number[]): boolean {
  // compare as numbers: leading zero bytes do not matter
  const strip = (x: number[]) => {
    let i = 0
    while (i < x.length - 1 && x[i] === 0) i++
    return x.slice(i)
  }
  const sa = strip(a)
  const sb = strip(b)
  return sa.length === sb.length && sa.every((v, i) => v === sb[i])
}

export interface DecodedFunction {
  fsw: number
  /** PSW ids whose data match the memory, or [] */
  psw: number[]
  /** raw shifted value, for direct functions and unmatched ones */
  raw: number[] | null
}

/**
 * Decodes coding memory into function values. A function listed several
 * times (different addresses for different equipment conditions) takes the
 * first placement whose bytes match one of its values.
 */
export function decodeCoding(layout: CodingLayout, mem: CodingMemory): Map<number, DecodedFunction> {
  const out = new Map<number, DecodedFunction>()
  for (const f of layout.functions) {
    const raw = extractValue(mem, f)
    if (raw === null) continue
    const psw = f.values.filter((v) => sameValue(v.data, raw)).map((v) => v.psw)
    const prev = out.get(f.fsw)
    if (prev && prev.psw.length > 0) continue
    if (prev && psw.length === 0 && !f.direct) continue
    out.set(f.fsw, { fsw: f.fsw, psw: [...new Set(psw)], raw })
  }
  return out
}

/**
 * Builds an FSW_PSW.TRC text from coding memory, as NCS Expert writes it
 * after CODIERDATEN_LESEN: each function with a recognised value, its value
 * names indented by a tab, CRLF line ends. Direct (numeric) functions are
 * system data and stay out; functions whose bytes match no value are listed
 * in `unmatched`.
 */
export function codingToTrc(
  layout: CodingLayout,
  mem: CodingMemory,
  fswNames: ReadonlyMap<number, string>,
  pswNames: ReadonlyMap<number, string>,
): { text: string; functions: number; unmatched: string[] } {
  const decoded = decodeCoding(layout, mem)
  const lines: string[] = []
  const unmatched: string[] = []
  const done = new Set<number>()
  let functions = 0
  for (const f of layout.functions) {
    if (f.direct || done.has(f.fsw)) continue
    done.add(f.fsw)
    const d = decoded.get(f.fsw)
    const name = fswNames.get(f.fsw) ?? `FSW_${f.fsw}`
    if (!d) continue
    if (d.psw.length === 0) {
      unmatched.push(name)
      continue
    }
    lines.push(name, ...d.psw.map((p) => '\t' + (pswNames.get(p) ?? `PSW_${p}`).toLowerCase()))
    functions++
  }
  return { text: lines.join('\r\n') + '\r\n', functions, unmatched }
}
