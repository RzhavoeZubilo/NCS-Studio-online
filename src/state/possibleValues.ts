import { useMemo } from 'react'
import { useStore } from '@/state/store'

/** Possible values per function name (lower case) from the ECU's SP-Daten module. */
export function usePossibleValues(): Map<string, string[]> {
  const spDaten = useStore((s) => s.spDaten)
  const linkedModule = useStore((s) => s.linkedModule)
  const ecuSel = useStore((s) => s.ecuSel)
  // the module matched by the trace content wins over the chosen one
  const fileName = linkedModule?.fileName ?? ecuSel?.fileName
  return useMemo(() => {
    const map = new Map<string, string[]>()
    const mod = spDaten?.modules.find((m) => m.fileName === fileName)
    if (!spDaten || !mod) return map
    for (const f of mod.functions) {
      const name = spDaten.fswNames.get(f.id)
      if (name) map.set(name.toLowerCase(), f.values.map((v) => spDaten.pswNames.get(v) ?? `#${v}`))
    }
    return map
  }, [spDaten, fileName])
}
