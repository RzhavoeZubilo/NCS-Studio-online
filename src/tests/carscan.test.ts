import { describe, expect, it } from 'vitest'
import type { Telegram } from '@/lib/kdcan'
import type { KdCanSerial } from '@/lib/serial'
import { readSgbdIndex, readVin, scanBus } from '@/lib/carscan'
import { ecuLabel, resolveEcu } from '@/lib/ecuInfo'
import type { SpDatenIndex } from '@/lib/spdaten'

/** Fake cable: answers each request (by target + hex payload) with canned telegrams. */
function fakeSerial(answers: Record<string, number[][]>) {
  const sent: string[] = []
  const serial = {
    async request(target: number, data: Uint8Array): Promise<Telegram[]> {
      const key = `${target.toString(16)}:${[...data].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`
      sent.push(key)
      return (answers[key] ?? []).map((d) => ({ target: 0xf1, source: target, data: new Uint8Array(d) }))
    },
  }
  return { serial: serial as unknown as KdCanSerial, sent }
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
const VIN = 'WBAPH5C55BA123456'

describe('readVin', () => {
  it('reads an E-series VIN with KWP2000 1A 90 from the CAS', async () => {
    const { serial } = fakeSerial({ '40:1a 90': [[0x5a, 0x90, ...ascii(VIN)]] })
    expect(await readVin(serial)).toBe(VIN)
  })

  it('waits past response-pending and falls back to UDS 22 F1 90', async () => {
    const { serial, sent } = fakeSerial({
      '40:1a 90': [[0x7f, 0x1a, 0x78]],
      '40:22 f1 90': [[0x62, 0xf1, 0x90, ...ascii(VIN)]],
    })
    expect(await readVin(serial)).toBe(VIN)
    expect(sent).toEqual(['40:1a 90', '40:22 f1 90'])
  })

  it('returns null when the CAS refuses both', async () => {
    const { serial } = fakeSerial({ '40:1a 90': [[0x7f, 0x1a, 0x11]], '40:22 f1 90': [[0x7f, 0x22, 0x11]] })
    expect(await readVin(serial)).toBeNull()
  })
})

describe('readSgbdIndex', () => {
  it('takes ID_COD_INDEX from payload byte 9 of 1A 80', async () => {
    const ident = [0x5a, 0x80, 0, 0, 0, 0, 0, 0, 0, 0x0b, 0x01, 0x02]
    const { serial } = fakeSerial({ '60:1a 80': [ident] })
    expect(await readSgbdIndex(serial, 0x60)).toEqual({ codingIndex: 0x0b, diagIndex: 0x0102 })
  })

  it('falls back to UDS 22 F1 50', async () => {
    const { serial } = fakeSerial({ '63:22 f1 50': [[0x62, 0xf1, 0x50, 0x00, 0x01, 0x32]] })
    expect(await readSgbdIndex(serial, 0x63)).toEqual({ sgbdIndex: '000132', codingIndex: 0x32 })
  })
})

describe('scanBus', () => {
  it('probes with 3E 01 and skips the tester and broadcast addresses', async () => {
    const { serial, sent } = fakeSerial({ '60:3e 01': [[0x7e, 0x01]] })
    const found = await scanBus(serial, () => {}, () => false, [0x60, 0xdf, 0xef, 0xf1])
    expect(sent).toEqual(['60:3e 01'])
    expect(found.map((e) => e.address)).toEqual([0x60])
  })
})

describe('ecuLabel', () => {
  it('names E81–E93 ECUs by address like ISTA without SP-Daten', () => {
    expect(ecuLabel(null, { address: 0x60 }).short).toBe('KOMBI')
    expect(ecuLabel(null, { address: 0x40 }).short).toBe('CAS')
    expect(ecuLabel(null, { address: 0x00 }).short).toBe('JBE')
    expect(ecuLabel(null, { address: 0x78 }).short).toBe('IHKA')
    expect(ecuLabel(null, { address: 0xc5 }).short).toBe('0xC5')
  })

  it('names the head unit and its MOST gateway after the variant', () => {
    expect(ecuLabel(null, { address: 0x63, sgbd: 'RAD2' }).short).toBe('RAD2')
    expect(ecuLabel(null, { address: 0x62, sgbd: 'RAD2_GW' }).short).toBe('RAD2-GW')
    expect(ecuLabel(null, { address: 0x12, sgbd: 'D60M57A0' }).short).toBe('DDE')
  })
})

describe('resolveEcu', () => {
  const entry = (address: number, sgbd: string, group: string, diagIndex: number) => ({
    address, sgbd, group, diagIndex, baureihe: 'E89', name: '',
  })
  const spDaten: SpDatenIndex = {
    folderName: 'E89',
    fswNames: new Map(),
    pswNames: new Map(),
    chassisMap: [],
    skipped: [],
    modules: [
      { fileName: 'CCC_60.C21', family: 'CCC', sgbds: [], codingIndex: 0x21, functions: [] },
      { fileName: 'RAD2.C21', family: 'RAD', sgbds: [], codingIndex: 0x21, functions: [] },
      { fileName: 'KMBI_PL2.C08', family: 'KOMBI', sgbds: [], codingIndex: 0x08, functions: [] },
    ],
    ecuByAddress: new Map([
      [0x63, [entry(0x63, 'CCC_60', 'D_MMI', 0x0100), entry(0x63, 'RAD2', 'D_MMI', 0x0a00)]],
      [0x60, [entry(0x60, 'KOMB87', 'D_KOMBI', 0x0300)]],
    ]),
  }

  it('picks the SGBD by diagnostic index and the file by coding index', () => {
    expect(resolveEcu(spDaten, 0x63, { codingIndex: 0x21, diagIndex: 0x0a00 })).toEqual({ sgbd: 'RAD2', variantFile: 'RAD2.C21' })
  })

  it('stays unresolved when the coding index alone is ambiguous', () => {
    expect(resolveEcu(spDaten, 0x63, { codingIndex: 0x21 })).toEqual({ sgbd: undefined, variantFile: undefined })
  })

  it('finds coding files named unlike their SGBD through the SGET family', () => {
    expect(resolveEcu(spDaten, 0x60, { codingIndex: 0x08, diagIndex: 0x0300 }).variantFile).toBe('KMBI_PL2.C08')
  })
})
