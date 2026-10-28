import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildTelegram,
  checksum,
  TelegramParser,
  adapterCommand,
  TESTER_ADDRESS,
} from '@/lib/kdcan'

// Reference example from D-CAN_TRANSPORT_RESEARCH.md §1.2:
// KOMBI fuel level request 21 0A with ECU address A:
//   82 A F1 21 0A sum   where sum = (0x82+A+0xF1+0x21+0x0A) & 0xFF
describe('buildTelegram', () => {
  it('matches the documented KOMBI STATUS_TANKINHALT telegram', () => {
    const a = 0x12 // example ECU address
    const tel = buildTelegram(a, new Uint8Array([0x21, 0x0a]))
    const sum = (0x82 + a + 0xf1 + 0x21 + 0x0a) & 0xff
    expect([...tel]).toEqual([0x82, a, 0xf1, 0x21, 0x0a, sum])
  })

  it('builds adapter commands to the virtual ECU 0xF1', () => {
    const tel = adapterCommand(0xfd) // GET_TYPE
    const sum = (0x82 + 0xf1 + 0xf1 + 0xfd + 0xfd) & 0xff
    expect([...tel]).toEqual([0x82, 0xf1, 0xf1, 0xfd, 0xfd, sum])
    expect(tel[1]).toBe(TESTER_ADDRESS)
  })

  it('uses the long form for more than 63 data bytes', () => {
    const data = new Uint8Array(70).fill(0xab)
    const tel = buildTelegram(0x12, data)
    expect(tel[0]).toBe(0x80)
    expect(tel[3]).toBe(70)
    expect(tel.length).toBe(5 + 70)
    expect(checksum(tel.subarray(0, tel.length - 1))).toBe(tel[tel.length - 1])
  })

  it('uses the extended long form for 256+ bytes', () => {
    const data = new Uint8Array(300).fill(1)
    const tel = buildTelegram(0x12, data)
    expect(tel[0]).toBe(0x80)
    expect(tel[3]).toBe(0x00)
    expect(tel[4]).toBe(300 >> 8)
    expect(tel[5]).toBe(300 & 0xff)
    expect(tel.length).toBe(6 + 300)
  })
})

describe('checksum', () => {
  it('is a plain 8-bit sum (not XOR)', () => {
    expect(checksum(new Uint8Array([0x82, 0x12, 0xf1, 0x21, 0x0a]))).toBe(
      (0x82 + 0x12 + 0xf1 + 0x21 + 0x0a) & 0xff,
    )
  })
})

describe('TelegramParser', () => {
  it('extracts a telegram from a clean stream', () => {
    const p = new TelegramParser()
    const wire = buildTelegram(0x12, new Uint8Array([0x21, 0x0a]))
    const out = p.feed(wire)
    expect(out).toHaveLength(1)
    expect(out[0].target).toBe(0x12)
    expect(out[0].source).toBe(0xf1)
    expect([...out[0].data]).toEqual([0x21, 0x0a])
    expect(out[0].wireLength).toBe(wire.length)
  })

  it('assembles a telegram split across chunks', () => {
    const p = new TelegramParser()
    const wire = buildTelegram(0x12, new Uint8Array([0x50, 0x85, 0x01]))
    const out1 = p.feed(wire.subarray(0, 3))
    expect(out1).toHaveLength(0)
    const out2 = p.feed(wire.subarray(3))
    expect(out2).toHaveLength(1)
    expect([...out2[0].data]).toEqual([0x50, 0x85, 0x01])
  })

  it('skips garbage before the start byte', () => {
    const p = new TelegramParser()
    const wire = buildTelegram(0x12, new Uint8Array([0x10, 0x85]))
    const out = p.feed(new Uint8Array([0x00, 0xff, 0x55, ...wire]))
    expect(out).toHaveLength(1)
    expect(out[0].target).toBe(0x12)
  })

  it('drops telegrams with a broken checksum and resyncs', () => {
    const p = new TelegramParser()
    const good = buildTelegram(0x12, new Uint8Array([0x10, 0x85]))
    const bad = buildTelegram(0x13, new Uint8Array([0x10, 0x85]))
    bad[bad.length - 1] ^= 0xff // break the checksum
    const out = p.feed(new Uint8Array([...bad, ...good]))
    expect(out).toHaveLength(1)
    expect(out[0].target).toBe(0x12)
  })

  it('parses the long form', () => {
    const p = new TelegramParser()
    const data = new Uint8Array(70).fill(0xab)
    const wire = buildTelegram(0x12, data)
    const out = p.feed(wire)
    expect(out).toHaveLength(1)
    expect(out[0].data.length).toBe(70)
    expect([...out[0].data]).toEqual([...data])
  })
})


// T_GRTB.PRG fixture: the real SP-Daten assignment table (address -> module)
import { parseZuordnung } from '@/lib/grtb'
import { parsePrg } from '@/lib/prg'
import { withFixtures } from './fixtureSuite'

const dscT = withFixtures('t-grtb.prg')

dscT('T_GRTB.PRG (address assignment table)', () => {
  const entries = parseZuordnung(
    parsePrg(
      new Uint8Array(
        readFileSync(fileURLToPath(new URL('./fixtures/t-grtb.prg', import.meta.url))),
      ),
    ),
  )

  it('extracts over a thousand address entries', () => {
    // the count differs between SP-Daten versions (1163 in 69.0)
    expect(entries.length).toBeGreaterThan(1000)
  })

  it('keeps the diagnostic index that picks the variant', () => {
    expect(entries.find((e) => e.address === 0x60 && e.sgbd === 'KOMB87')?.diagIndex).toBe(0x8d0)
    expect(entries.find((e) => e.address === 0x63 && e.sgbd === 'RAD2' && e.baureihe === 'E90')?.diagIndex).toBe(0xfa8)
  })

  it('maps known addresses to module names', () => {
    const addr0 = entries.filter((e) => e.address === 0x00)
    expect(addr0.length).toBeGreaterThan(0)
    expect(addr0.some((e) => e.name === 'Zentrales Gatewaymodul')).toBe(true)
    expect(addr0.some((e) => e.sgbd === 'ZGM_E65' && e.baureihe === 'E65')).toBe(true)
  })

  it('contains the E90 junction box', () => {
    expect(
      entries.some((e) => e.sgbd === 'JBBF87' && e.baureihe === 'E87' && e.address === 0x00),
    ).toBe(true)
  })
})
