import { describe, expect, it } from 'vitest'
import { locateSpDaten, type DirLike, type FileLike } from '@/lib/spdatenDir'

/** Builds a fake directory tree: objects are folders, strings are file contents. */
function tree(name: string, spec: Record<string, unknown>): DirLike {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const [k, v] of Object.entries(spec)) {
        if (typeof v === 'string') {
          yield { kind: 'file', name: k, getFile: async () => new File([v], k) } satisfies FileLike
        } else yield tree(k, v as Record<string, unknown>)
      }
    },
  }
}

const daten = { 'SWTFSW03.DAT': '', 'SWTPSW03.DAT': '', 'KMBI_PL2.C08': '' }

describe('locateSpDaten', () => {
  it('finds DATEN\\E89 and ECU\\T_GRTB.PRG in the SP-Daten root', async () => {
    const root = tree('BMW SP-Daten 69.0', {
      DATEN: { E60: { ...daten }, E89: { ...daten } },
      ECU: { 'T_GRTB.PRG': '', 'KOMB87.PRG': '' },
    })
    const layout = await locateSpDaten(root)
    expect(layout?.chassis).toBe('E89')
    expect(layout?.chassisOptions).toEqual(['E60', 'E89'])
    expect(layout?.daten.name).toBe('E89')
    expect(layout?.tgrtb?.name).toBe('T_GRTB.PRG')
  })

  it('names a chassis\\daten folder after its parent', async () => {
    const layout = await locateSpDaten(tree('E89', { daten: { ...daten }, ecu: { 'T_GRTB.PRG': '' } }))
    expect(layout?.chassis).toBe('E89')
    expect(layout?.tgrtb).not.toBeNull()
  })

  it('accepts the chassis folder itself and falls back to the only chassis', async () => {
    const layout = await locateSpDaten(tree('E60', { ...daten }))
    expect(layout?.chassis).toBe('E60')
    expect(layout?.tgrtb).toBeNull()
  })

  it('returns null without NCS data', async () => {
    expect(await locateSpDaten(tree('Downloads', { 'a.txt': '' }))).toBeNull()
  })
})
