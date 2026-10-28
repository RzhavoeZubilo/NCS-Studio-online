/**
 * Finds the SP-Daten pieces in whatever folder the user picked:
 *  - a downloaded SP-Daten set ("BMW SP-Daten 74"), one folder per chassis
 *    holding daten\ (SWT*, SGET, *.Cxx) and its own ecu\ (T_GRTB.prg), next to
 *    data\, sgdat\… with gigabytes of firmware that are never opened;
 *  - one chassis folder of such a set (E89);
 *  - an installed layout (NCSEXPER\DATEN\E89 + EDIABAS\Ecu) or a daten folder.
 * Only directory listings are walked; file contents are read later, and from
 * an ecu folder only T_GRTB.prg is needed.
 */

export interface FileLike {
  kind: 'file'
  name: string
  getFile(): Promise<File>
}

export interface DirLike {
  kind: 'directory'
  name: string
  values(): AsyncIterable<DirLike | FileLike>
}

export interface SpDatenLayout {
  /** chosen chassis, e.g. "E89" */
  chassis: string
  /** every chassis found, sorted */
  chassisOptions: string[]
  /** folder with SWTFSW*, SGET and the .Cxx module files */
  daten: DirLike
  /** T_GRTB.PRG (address assignment table), if found */
  tgrtb: FileLike | null
}

const MAX_DEPTH = 3
const isTgrtb = (e: DirLike | FileLike): e is FileLike => e.kind === 'file' && /^T_GRTB\.PRG$/i.test(e.name)
const isKeywords = (e: DirLike | FileLike) => e.kind === 'file' && /^SWTFSW/i.test(e.name)

async function entries(dir: DirLike): Promise<(DirLike | FileLike)[]> {
  const out: (DirLike | FileLike)[] = []
  for await (const e of dir.values()) out.push(e)
  return out
}

export async function locateSpDaten(root: DirLike, preferred = 'E89'): Promise<SpDatenLayout | null> {
  // chassis → its daten folder and its own ecu folder (if any)
  const chassis = new Map<string, { daten: DirLike; ecu: DirLike | null }>()
  let sharedTgrtb: FileLike | null = null // an installed EDIABAS\Ecu next to NCSEXPER

  const walk = async (dir: DirLike, parentName: string, depth: number) => {
    const list = await entries(dir)
    // the daten folder itself (NCSEXPER\DATEN\E89 or E89\daten)
    if (list.some(isKeywords)) {
      const name = (/^daten$/i.test(dir.name) ? parentName : dir.name).toUpperCase()
      if (!chassis.has(name)) chassis.set(name, { daten: dir, ecu: null })
      return
    }
    // an ECU folder: thousands of SGBDs, only T_GRTB matters
    const grtb = list.find(isTgrtb)
    if (grtb) {
      sharedTgrtb ??= grtb
      return
    }
    const dirs = list.filter((e): e is DirLike => e.kind === 'directory')
    // a chassis folder of a downloaded set: daten\ + ecu\, the rest is firmware
    const daten = dirs.find((d) => /^daten$/i.test(d.name))
    if (daten && (await entries(daten)).some(isKeywords)) {
      const name = dir.name.toUpperCase()
      if (!chassis.has(name)) chassis.set(name, { daten, ecu: dirs.find((d) => /^ecu$/i.test(d.name)) ?? null })
      return
    }
    if (depth >= MAX_DEPTH) return
    for (const d of dirs) await walk(d, dir.name, depth + 1)
  }

  await walk(root, '', 0)
  if (chassis.size === 0) return null
  const chassisOptions = [...chassis.keys()].sort()
  const chosen = chassis.has(preferred.toUpperCase()) ? preferred.toUpperCase() : chassisOptions[0]
  const { daten, ecu } = chassis.get(chosen)!
  // the chassis' own table first: every chassis of a set ships its own T_GRTB
  const own = ecu ? ((await entries(ecu)).find(isTgrtb) ?? null) : null
  return { chassis: chosen, chassisOptions, daten, tgrtb: own ?? sharedTgrtb }
}

/** Reads the daten files and T_GRTB.PRG of a located layout. */
export async function readSpDatenLayout(
  layout: SpDatenLayout,
  onProgress: (count: number) => void,
): Promise<{ name: string; data: Uint8Array }[]> {
  const files = (await entries(layout.daten)).filter((e): e is FileLike => e.kind === 'file')
  if (layout.tgrtb) files.push(layout.tgrtb)
  const items: { name: string; data: Uint8Array }[] = []
  for (const f of files) {
    const file = await f.getFile()
    items.push({ name: f.name, data: new Uint8Array(await file.arrayBuffer()) })
    if (items.length % 25 === 0) onProgress(items.length)
  }
  return items
}
