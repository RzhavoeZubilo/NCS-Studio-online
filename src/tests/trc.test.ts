import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  docStats,
  isChanged,
  parseTrc,
  serializeMan,
  serializeTrc,
} from '@/lib/trc'
import { parseTranslationsCsv } from '@/lib/translations'

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'latin1')

const fixturesAvailable = existsSync(
  fileURLToPath(new URL('./fixtures', import.meta.url)),
)
const dsc = fixturesAvailable ? describe : describe.skip

dsc('parseTrc round-trip', () => {
  it('reproduces a real FSW/PSW file byte-for-byte', () => {
    const src = fixture('rad2-fsw-psw.trc')
    const doc = parseTrc(src, 'rad2.trc')
    expect(serializeTrc(doc)).toBe(src)
  })

  it('reproduces a binary-record file (B lines) byte-for-byte', () => {
    const src = fixture('high-box.trc')
    const doc = parseTrc(src, 'high-box.trc')
    const stats = docStats(doc)
    expect(stats.binary).toBeGreaterThan(0)
    expect(serializeTrc(doc)).toBe(src)
  })
})

dsc('FSW/PSW structure', () => {
  const doc = parseTrc(fixture('rad2-fsw-psw.trc'), 'rad2.trc')

  it('pairs an option with its indented value', () => {
    const first = doc.segments[0]
    expect(first.kind).toBe('option')
    if (first.kind !== 'option') return
    expect(first.name).toBe('CODIERUNG_ERFOLGT')
    expect(first.values.map((v) => v.text)).toEqual(['codierung_erfolgt'])
  })

  it('collects all lines of a multi-value option', () => {
    const seg = doc.segments.find(
      (s) => s.kind === 'option' && s.name === 'RAD22_VEHICLE_FILTERS',
    )
    if (seg?.kind !== 'option') throw new Error('option not found')
    expect(seg.values.map((v) => v.text)).toEqual([
      'pl2_hifi',
      'pl2_top_hifi',
      'pl3_stereo',
      'pl3_hifi_branded',
      'klangzeichen_test',
    ])
  })

  it('detects edits against the original values', () => {
    const seg = doc.segments.find((s) => s.kind === 'option' && s.name === 'PDC')
    if (seg?.kind !== 'option') throw new Error('option not found')
    expect(isChanged(seg)).toBe(false)
    expect(isChanged({ ...seg, values: [{ text: 'nicht_aktiv', indent: seg.values[0].indent }] })).toBe(
      true,
    )
  })

  it('exports MAN with CRLF and single-tab values', () => {
    const man = serializeMan(doc)
    expect(man).toContain('CODIERUNG_ERFOLGT\r\n\tcodierung_erfolgt\r\n')
    for (const line of man.split('\r\n')) {
      if (line.startsWith('\t')) {
        expect(line.startsWith('\t\t')).toBe(false)
      }
    }
  })

  it('round-trips its own MAN output', () => {
    const man = serializeMan(doc)
    expect(serializeTrc(parseTrc(man, 'test.man'))).toBe(man)
  })
})

dsc('parseTranslationsCsv', () => {
  it('parses quoted fields and normalizes keys', () => {
    const map = parseTranslationsCsv(
      'CONTRIBUTORS,"revtor,IcemanBHE"\nLASTMODIFIED,20201210\n\nnicht_aktiv,not active\n',
    )
    expect(map.get('nicht_aktiv')).toBe('not active')
    expect(map.get('contributors')).toBe('revtor,IcemanBHE')
    expect(map.get('lastmodified')).toBe('20201210')
  })
})
