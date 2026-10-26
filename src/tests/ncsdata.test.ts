import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  findNcsTable,
  invertKeywords,
  parseChassisMap,
  parseKeywordTable,
  parseModuleCoding,
  parseModuleFamilies,
  ModuleStatus,
} from '@/lib/ncsdata'
import { withFixtures } from './fixtureSuite'

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))),
  )

// Reference values cross-checked against NCS-Workbench's ncsdata.h algorithm
// and the user's rad2 FSW/PSW trace (E89 chassis = E81..E93).
const dsc = withFixtures('RAD22.C32', 'SWTFSW03.dat', 'SWTPSW03.dat', 'E89SGET.000', 'BR_REF.DAT')

dsc('parseModuleCoding RAD22.C32', () => {
  const mod = parseModuleCoding(fixture('RAD22.C32'))

  it('recognizes the module and its coding index', () => {
    expect(mod.status).toBe(ModuleStatus.MODULE_OK)
    expect(mod.codingIndex).toBe(0x32)
  })

  it('finds all 85 coded functions', () => {
    expect(mod.functions).toHaveLength(85)
  })

  it('maps function ids to names via SWTFSW03.dat', () => {
    const fswNames = invertKeywords(parseKeywordTable(fixture('SWTFSW03.dat')))
    const first = mod.functions.slice(0, 5).map((f) => fswNames.get(f.id))
    expect(first).toEqual([
      'PDC',
      'RING_STATUS_20',
      'CODIERUNG_ERFOLGT',
      'BAUREIHEX',
      'SDV_CURVE',
    ])
    expect(mod.functions.some((f) => fswNames.get(f.id) === 'KEY_MEMORY_R')).toBe(true)
  })

  it('resolves possible values via SWTPSW03.dat (PDC -> nicht_aktiv/aktiv)', () => {
    const pswNames = invertKeywords(parseKeywordTable(fixture('SWTPSW03.dat')))
    const fswNames = invertKeywords(parseKeywordTable(fixture('SWTFSW03.dat')))
    const pdc = mod.functions.find((f) => fswNames.get(f.id) === 'PDC')
    if (!pdc) throw new Error('PDC function not found')
    expect(pdc.values.map((v) => pswNames.get(v))).toEqual(['nicht_aktiv', 'aktiv'])
  })
})

dsc('keyword tables', () => {
  it('parses SWTFSW03.dat: 9638 function names', () => {
    const kw = parseKeywordTable(fixture('SWTFSW03.dat'))
    expect(kw.size).toBe(9638)
    expect(kw.has('FADER')).toBe(true)
    expect(kw.has('PDC')).toBe(true)
  })

  it('parses SWTPSW03.dat: 2496 value names', () => {
    const kw = parseKeywordTable(fixture('SWTPSW03.dat'))
    expect(kw.size).toBe(2496)
    expect(kw.has('nicht_aktiv')).toBe(true)
    expect(kw.has('aktiv')).toBe(true)
  })
})

dsc('parseModuleFamilies E89SGET.000', () => {
  it('maps module files to ECU families', () => {
    const fams = parseModuleFamilies(fixture('E89SGET.000'))
    expect(fams.length).toBeGreaterThan(300)
    const map = new Map(fams.map((f) => [f.file, f.family]))
    expect(map.get('KMBI_PL2.C05')).toBe('KOMBI')
  })
})

dsc('parseChassisMap BR_REF.DAT', () => {
  it('maps replacement chassis folders', () => {
    const map = parseChassisMap(fixture('BR_REF.DAT'))
    expect(map).toContainEqual({ chassis: 'E46', folder: 'E46' })
    expect(map).toContainEqual({ chassis: 'R52', folder: 'R50' })
  })
})

describe('findNcsTable', () => {
  it('rejects a non-SP-Daten file', () => {
    const recs = [{ type: 0x0001, data: new Uint8Array([1, 2, 3]) }]
    expect(findNcsTable(recs, 'PARZUWEISUNG_FSW').id).toBe(-1)
  })
})
