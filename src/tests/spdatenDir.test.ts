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
        } else if ((v as DirLike).kind === 'directory') yield v as DirLike
        else yield tree(k, v as Record<string, unknown>)
      }
    },
  }
}

const daten = { 'SWTFSW03.DAT': '', 'SWTPSW03.DAT': '', 'KMBI_PL2.C08': '' }

describe('locateSpDaten', () => {
  it('finds the chassis and its own T_GRTB in a downloaded SP-Daten set without opening data\\', async () => {
    let firmwareListed = false
    const firmware = tree('data', { KOMBI: { 'fw.0pa': '' } })
    const data: DirLike = { ...firmware, values: () => ((firmwareListed = true), firmware.values()) }
    const root = tree('BMW SP-Daten 74', {
      'E89.rar': '',
      BASE: { daten: { 'A.DAT': '' }, ecu: { 'T_GRTB.prg': 'base' } },
      E53: { daten: { ...daten }, ecu: { 't_grtb.prg': 'e53' } },
      E89: { daten: { ...daten }, ecu: { 'T_GRTB.prg': 'e89' }, data },
    })
    const layout = await locateSpDaten(root)
    expect(layout?.chassis).toBe('E89')
    expect(layout?.chassisOptions).toEqual(['E53', 'E89'])
    expect(await (await layout!.tgrtb!.getFile()).text()).toBe('e89')
    expect(firmwareListed).toBe(false)
  })

  it('finds DATEN\\E89 and a shared ECU\\T_GRTB.PRG in an installed layout', async () => {
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
