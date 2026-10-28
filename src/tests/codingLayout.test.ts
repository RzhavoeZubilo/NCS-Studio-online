import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Telegram } from '@/lib/kdcan'
import type { KdCanSerial } from '@/lib/serial'
import { readCodingBlocks } from '@/lib/carscan'
import {
  codingToTrc,
  decodeCoding,
  extractValue,
  parseCodingLayout,
  parseNettodata,
  readFields,
  type CodingFunction,
  type CodingLayout,
} from '@/lib/codingLayout'
import { invertKeywords, parseKeywordTable } from '@/lib/ncsdata'
import { parseTrc } from '@/lib/trc'
import { withFixtures } from './fixtureSuite'

const fn = (over: Partial<CodingFunction>): CodingFunction => ({
  fsw: 1,
  direct: false,
  block: 0x3000,
  address: 0x300001,
  length: 1,
  mask: [0xff],
  conditions: [],
  values: [],
  ...over,
})

describe('readFields', () => {
  it('reads byte- and word-counted lists, numbers and strings', () => {
    // {L}LWW{B}(B){B}{B}: block 3000, word 3, length 1, FSW 0x0802, cond [0x71], mask 08, unit 'h', no individual
    const data = new Uint8Array([1, 0, 0x30, 0, 0, 3, 0, 0, 0, 1, 0, 2, 8, 1, 0x71, 1, 0, 8, 1, 0x68, 0])
    expect(readFields({ type: 18, data }, '{L}LWW{B}(B){B}{B}')).toEqual([[0x3000], 3, 1, 0x0802, [0x71], [8], [0x68], []])
  })

  it('returns null for a short record', () => {
    expect(readFields({ type: 1, data: new Uint8Array([1, 0]) }, 'WL')).toBeNull()
  })
})

describe('parseNettodata', () => {
  it('maps every byte to its address', () => {
    const mem = parseNettodata('B 00300000,0003,C7,EE,0A\r\nB 00300200,0001,5E\r\n')
    expect([...mem]).toEqual([
      [0x300000, 0xc7],
      [0x300001, 0xee],
      [0x300002, 0x0a],
      [0x300200, 0x5e],
    ])
  })
})

describe('extractValue', () => {
  const mem = parseNettodata('B 00300000,0004,C7,EE,0A,F0')

  it('shifts the masked bits down', () => {
    expect(extractValue(mem, fn({ mask: [0x08] }))).toEqual([1]) // EE = 1110 1110, bit 3 set
    expect(extractValue(mem, fn({ mask: [0x30] }))).toEqual([2]) // bits 4–5 = 10
  })

  it('reads multi-byte values most significant first', () => {
    expect(extractValue(mem, fn({ address: 0x300002, length: 2, mask: [0xff, 0xff] }))).toEqual([0x0a, 0xf0])
    expect(extractValue(mem, fn({ address: 0x300002, length: 2, mask: [0x0f, 0xf0] }))).toEqual([0xaf])
  })

  it('returns null when a byte was not read', () => {
    expect(extractValue(mem, fn({ address: 0x300010 }))).toBeNull()
  })
})

describe('decodeCoding', () => {
  const layout: CodingLayout = {
    blocks: [],
    functions: [
      fn({ fsw: 1, mask: [0x01], values: [{ psw: 10, data: [0] }, { psw: 11, data: [1] }] }),
      // a multi-value function: two values share the same data
      fn({ fsw: 2, mask: [0x7f], values: [{ psw: 20, data: [0x7e] }, { psw: 21, data: [0x7f] }, { psw: 22, data: [0x7f] }] }),
      fn({ fsw: 3, mask: [0xf0], values: [{ psw: 30, data: [0] }] }),
    ],
  }
  const mem = parseNettodata('B 00300001,0001,FF')

  it('finds the matching values, all of them for shared data', () => {
    const d = decodeCoding(layout, mem)
    expect(d.get(1)?.psw).toEqual([11])
    expect(d.get(2)?.psw).toEqual([21, 22])
    expect(d.get(3)).toEqual({ fsw: 3, psw: [], raw: [0x0f] })
  })

  it('writes a trace with recognised functions only', () => {
    const names = new Map([[1, 'A'], [2, 'B'], [3, 'C']])
    const values = new Map([[10, 'nicht_aktiv'], [11, 'aktiv'], [20, 'wert_01'], [21, 'wert_02'], [22, 'wert_03']])
    expect(codingToTrc(layout, mem, names, values)).toEqual({
      text: 'A\r\n\taktiv\r\nB\r\n\twert_02\r\n\twert_03\r\n',
      functions: 2,
      unmatched: ['C'],
    })
  })
})

describe('readCodingBlocks', () => {
  it('reads each block with 22 30xx and maps the answer to addresses', async () => {
    const sent: string[] = []
    const serial = {
      async request(target: number, data: Uint8Array): Promise<Telegram[]> {
        sent.push([...data].map((b) => b.toString(16).padStart(2, '0')).join(' '))
        if (data[2] === 0x00) return [{ target: 0xf1, source: target, data: new Uint8Array([0x62, 0x30, 0x00, 0xc7, 0xee]) }]
        return [{ target: 0xf1, source: target, data: new Uint8Array([0x7f, 0x22, 0x31]) }]
      },
    } as unknown as KdCanSerial
    const blocks = [
      { block: 0x3000, address: 0x300000, length: 2 },
      { block: 0x3002, address: 0x300200, length: 9 },
    ]
    const progress: number[] = []
    const { mem, failed } = await readCodingBlocks(serial, 0x60, blocks, (d) => progress.push(d))
    expect(sent).toEqual(['22 30 00', '22 30 02'])
    expect([...mem]).toEqual([
      [0x300000, 0xc7],
      [0x300001, 0xee],
    ])
    expect(failed).toEqual([0x3002])
    expect(progress).toEqual([1, 2])
  })
})

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const dsc = withFixtures('KMBI_PL2.C08', 'SWTFSW03.dat', 'SWTPSW03.dat', 'kombi-nettodata.trc', 'kombi-fsw-psw.trc')

dsc('KMBI_PL2.C08 against NCS Dummy and a real trace', () => {
  const layout = parseCodingLayout(new Uint8Array(readFileSync(fixture('KMBI_PL2.C08'))))
  const fsw = parseKeywordTable(new Uint8Array(readFileSync(fixture('SWTFSW03.dat'))))
  const pswNames = invertKeywords(parseKeywordTable(new Uint8Array(readFileSync(fixture('SWTPSW03.dat')))))
  const byName = (name: string) => layout.functions.find((f) => f.fsw === fsw.get(name))!

  it('places blocks and functions where NCS Dummy shows them', () => {
    expect(layout.blocks.find((b) => b.block === 0x3000)).toMatchObject({ address: 0x300000, length: 0x12, name: 'Steuerung_Anzeige_1' })
    expect(layout.blocks.find((b) => b.block === 0x3002)).toMatchObject({ address: 0x300200, length: 0x09, name: 'WEG' })
    expect(byName('CSUM_ST_ANZEIGE_1')).toMatchObject({ address: 0x300000, length: 1, mask: [0xff] })
    const motorsport = byName('MOTORSPORT')
    expect(motorsport).toMatchObject({ address: 0x300301, length: 1, mask: [0x08] })
    expect(motorsport.values.map((v) => [pswNames.get(v.psw), v.data])).toEqual([
      ['wert_01', [0]],
      ['wert_02', [1]],
    ])
  })

  it('decodes the nettodata into the values of the FSW/PSW trace', () => {
    const mem = parseNettodata(readFileSync(fixture('kombi-nettodata.trc'), 'latin1'))
    const decoded = decodeCoding(layout, mem)
    const trace = parseTrc(readFileSync(fixture('kombi-fsw-psw.trc'), 'latin1'), 'kombi.trc')
    let same = 0
    let total = 0
    for (const seg of trace.segments) {
      if (seg.kind !== 'option') continue
      total++
      const got = (decoded.get(fsw.get(seg.name)!)?.psw ?? []).map((p) => pswNames.get(p)?.toLowerCase())
      if (seg.values.every((v) => got.includes(v.text.toLowerCase()))) same++
    }
    // the nettodata is a little older than the trace: 8 menu options were changed since
    expect(total).toBe(317)
    expect(same).toBe(309)
  })
})

const dscV = withFixtures('KMBI_PL2.C08', 'E89SGET.000', 't-grtb.prg')

dscV('variant resolution with the real T_GRTB and SGET', () => {
  it('maps KOMBI at 0x60 (KOMB87, diag 8D0, coding index 08) to KMBI_PL2.C08', async () => {
    const { indexSpDatenItems } = await import('@/lib/spdaten')
    const { resolveEcu } = await import('@/lib/ecuInfo')
    const item = (name: string, file = name) => ({ name, data: new Uint8Array(readFileSync(fixture(file))) })
    const spDaten = indexSpDatenItems([item('KMBI_PL2.C08'), item('E89SGET.000'), item('T_GRTB.PRG', 't-grtb.prg')], 'E89')
    expect(spDaten.modules[0].sgbds).toContain('KOMB87')
    expect(resolveEcu(spDaten, 0x60, { codingIndex: 0x08, diagIndex: 0x8d0 })).toEqual({ sgbd: 'KOMB87', variantFile: 'KMBI_PL2.C08' })
  })
})
