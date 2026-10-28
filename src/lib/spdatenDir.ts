/**
 * Finds the SP-Daten pieces in whatever folder the user picked: a chassis
 * folder (E89 holding SWT* files, or E89\daten), NCSEXPER\DATEN with chassis
 * subfolders, or the SP-Daten root (DATEN\E89 + ECU). Only directory listings
 * are walked; file contents are read later, and from the ECU folder only
 * T_GRTB.PRG is needed.
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

async function entries(dir: DirLike): Promise<(DirLike | FileLike)[]> {
  const out: (DirLike | FileLike)[] = []
  for await (const e of dir.values()) out.push(e)
  return out
}

export async function locateSpDaten(root: DirLike, preferred = 'E89'): Promise<SpDatenLayout | null> {
  const daten = new Map<string, DirLike>() // chassis → daten folder
  let tgrtb: FileLike | null = null

  const walk = async (dir: DirLike, parentName: string, depth: number) => {
    const list = await entries(dir)
    if (list.some((e) => e.kind === 'file' && /^SWTFSW/i.test(e.name))) {
      // a "daten" folder is named after its chassis by its parent (E89\daten)
      const chassis = (/^daten$/i.test(dir.name) ? parentName : dir.name).toUpperCase()
      if (!daten.has(chassis)) daten.set(chassis, dir)
      return
    }
    const grtb = list.find((e): e is FileLike => e.kind === 'file' && /^T_GRTB\.PRG$/i.test(e.name))
    if (grtb) {
      tgrtb ??= grtb
      return // an ECU folder: thousands of SGBDs, nothing else to find here
    }
    if (depth >= MAX_DEPTH) return
    for (const e of list) if (e.kind === 'directory') await walk(e, dir.name, depth + 1)
  }

  await walk(root, '', 0)
  if (daten.size === 0) return null
  const chassisOptions = [...daten.keys()].sort()
  const chassis = daten.has(preferred.toUpperCase()) ? preferred.toUpperCase() : chassisOptions[0]
  return { chassis, chassisOptions, daten: daten.get(chassis)!, tgrtb }
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
