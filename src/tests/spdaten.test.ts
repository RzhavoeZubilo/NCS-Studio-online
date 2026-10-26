import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { indexSpDatenItems } from '@/lib/spdaten'
import { withFixtures } from './fixtureSuite'

const fixture = (name: string) => ({
  name,
  data: new Uint8Array(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))),
  ),
})

const dsc = withFixtures('RAD22.C32', 'SWTFSW03.dat', 'SWTPSW03.dat', 'E89SGET.000', 'BR_REF.DAT')

dsc('indexSpDatenItems', () => {
  const index = indexSpDatenItems(
    [
      fixture('RAD22.C32'),
      fixture('SWTFSW03.dat'),
      fixture('SWTPSW03.dat'),
      fixture('E89SGET.000'),
      fixture('BR_REF.DAT'),
      // unknown files must be skipped, not crash
      { name: 'E89AT.M00', data: new Uint8Array([1, 2, 3]) },
    ],
    'E89',
  )

  it('indexes the module with family and coding index', () => {
    expect(index.modules).toHaveLength(1)
    const rad22 = index.modules[0]
    expect(rad22.fileName).toBe('RAD22.C32')
    expect(rad22.codingIndex).toBe(0x32)
  })

  it('resolves function names and possible values', () => {
    const rad22 = index.modules[0]
    const pdc = rad22.functions.find((f) => index.fswNames.get(f.id) === 'PDC')
    if (!pdc) throw new Error('PDC not found')
    expect(pdc.values.map((v) => index.pswNames.get(v))).toEqual(['nicht_aktiv', 'aktiv'])
  })

  it('reads the chassis replacement map', () => {
    expect(index.chassisMap).toContainEqual({ chassis: 'R52', folder: 'R50' })
  })

  it('skips unknown files', () => {
    expect(index.skipped).toContain('E89AT.M00')
  })
})
