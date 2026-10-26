import { create } from 'zustand'
import { dominantIndent, parseTrc, type Segment, type TrcDocument } from '@/lib/trc'
import { readTextSmart } from '@/lib/fileio'
import { parsePrg, type PrgFile } from '@/lib/prg'
import { idbDel, idbGet, idbSet } from '@/lib/idb'
import { indexSpDatenItems, readSpDatenFiles, type SpDatenIndex } from '@/lib/spdaten'
import { parseCsv } from '@/lib/translations'
import { mapFunctionNames, countSharedFunctions, pickModule } from '@/lib/ncsdata'
import { translateValue } from '@/lib/ruTranslate'
import faOptions from '@/data/faOptions.json'
import type { Lang } from '@/lib/i18n'
import { KdCanSerial, probeAdapter, type AdapterProbeResult } from '@/lib/serial'
import {
  scanBus,
  readSgbdIndex,
  readVin as readVinSvc,
  resolveVariant,
  type FoundEcu,
} from '@/lib/carscan'

type ParamLang = 'original' | 'en' | 'ru'
type Theme = 'dark' | 'light'
type View = 'coding' | 'prg' | 'dict' | 'fa'
export type Step = 'read' | 'edit' | 'write'

/** The ECU being coded: found on the bus (address) and/or its variant file. */
export interface EcuSelection {
  address?: number
  /** variant file, e.g. "KOMB87.C0B" */
  fileName?: string
}

interface AppState {
  doc: TrcDocument | null
  selected: number | null
  query: string
  changedOnly: boolean
  pendingScroll: number | null
  toast: string | null

  openFile: (file: File) => Promise<void>
  setQuery: (query: string) => void
  setChangedOnly: (value: boolean) => void
  select: (index: number | null) => void
  setValues: (index: number, values: string[]) => void
  revert: (index: number) => void
  revertAll: () => void
  scrollTo: (index: number) => void
  clearScroll: () => void
  showToast: (message: string) => void

  view: View
  prgFiles: { name: string; size: number; prg: PrgFile }[]
  prgActive: string | null
  prgJob: number | null
  prgTable: number | null

  spDaten: SpDatenIndex | null
  spDatenStatus: string | null
  /** remembered SP-Daten folder that needs the read permission re-granted */
  spDatenSaved: string | null
  ecuSel: EcuSelection | null
  step: Step
  lang: Lang
  settingsOpen: boolean
  theme: Theme
  paramLang: ParamLang
  linkedModule: { fileName: string; matchPct: number } | null
  overlay: Record<string, string> | null
  overlayFile: string
  dictStatus: string | null
  autoTranslateRunning: boolean
  faqOpen: boolean
  carConnected: boolean
  carAdapter: AdapterProbeResult | null
  carScanning: boolean
  carScanProgress: { done: number; total: number; found: FoundEcu[] } | null
  carFound: FoundEcu[]
  carError: string | null
  carVin: string | null
  readingVin: boolean

  setView: (view: View) => void
  openPrgFile: (file: File) => Promise<void>
  selectPrg: (name: string) => void
  selectPrgJob: (index: number | null) => void
  selectPrgTable: (index: number | null) => void
  openSpDatenFolder: () => Promise<void>
  openSpDatenFiles: (files: File[]) => Promise<void>
  loadSpDatenDir: (dir: FileSystemDirectoryHandle) => Promise<void>
  restoreSpDaten: () => Promise<void>
  reconnectSpDaten: () => Promise<void>
  selectEcu: (sel: EcuSelection | null) => void
  setStep: (step: Step) => void
  setLang: (lang: Lang) => void
  setSettingsOpen: (open: boolean) => void
  setTheme: (theme: Theme) => void
  setParamLang: (lang: ParamLang) => void
  loadOverlayCsv: (fileName: string, content: string) => void
  setOverlayEntry: (name: string, ru: string) => void
  clearOverlay: () => Promise<void>
  setDictStatus: (status: string | null) => void
  setAutoTranslateRunning: (running: boolean) => void
  setFaqOpen: (open: boolean) => void
  restoreOverlay: () => Promise<void>
  linkModule: () => void
  connectCar: () => Promise<void>
  disconnectCar: () => Promise<void>
  scanCar: () => Promise<void>
  cancelScan: () => void
  readVin: () => Promise<void>
}

let serialInstance: KdCanSerial | null = null
let cancelScanFlag = false

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?(o: { mode: 'read' }): Promise<PermissionState>
  requestPermission?(o: { mode: 'read' }): Promise<PermissionState>
}
const SP_DATEN_DIR_KEY = 'spDatenDir'

/** Reads every file of an SP-Daten chassis folder (daten\ + ecu\). */
async function readSpDatenDir(
  dir: FileSystemDirectoryHandle,
  onProgress: (count: number) => void,
): Promise<{ name: string; data: Uint8Array }[]> {
  // daten\ holds modules/keywords; ecu\ holds T_GRTB.PRG (address map) and groups
  const folders: FileSystemDirectoryHandle[] = []
  try {
    folders.push(await dir.getDirectoryHandle('daten'))
  } catch {
    // maybe the user picked the daten folder itself
    folders.push(dir)
  }
  try {
    folders.push(await dir.getDirectoryHandle('ecu'))
  } catch {
    // no ecu folder — fine
  }
  const items: { name: string; data: Uint8Array }[] = []
  for (const folder of folders) {
    const iter = (
      folder as unknown as {
        values(): AsyncIterable<{ kind: string; name: string; getFile(): Promise<File> }>
      }
    ).values()
    for await (const entry of iter) {
      if (entry.kind !== 'file') continue
      const file = await entry.getFile()
      items.push({ name: entry.name, data: new Uint8Array(await file.arrayBuffer()) })
      if (items.length % 25 === 0) onProgress(items.length)
    }
  }
  return items
}

export const useStore = create<AppState>((set, get) => ({
  doc: null,
  selected: null,
  query: '',
  changedOnly: false,
  pendingScroll: null,
  toast: null,
  view: 'coding',
  prgFiles: [],
  prgActive: null,
  prgJob: null,
  prgTable: null,
  spDaten: null,
  spDatenStatus: null,
  spDatenSaved: null,
  ecuSel: null,
  step: 'read',
  lang: (localStorage.getItem('lang') as Lang) || 'en',
  settingsOpen: false,
  theme: (localStorage.getItem('theme') as Theme) || 'dark',
  paramLang: (localStorage.getItem('paramLang') as ParamLang) || 'ru',
  linkedModule: null,
  overlay: null,
  overlayFile: '',
  dictStatus: null,
  autoTranslateRunning: false,
  faqOpen: false,
  carConnected: false,
  carAdapter: null,
  carScanning: false,
  carScanProgress: null,
  carFound: [],
  carError: null,
  carVin: null,
  readingVin: false,

  selectEcu: (ecuSel) => {
    const { linkedModule } = get()
    // the open trace stays only when it belongs to the newly selected ECU
    const keepDoc = !!ecuSel?.fileName && linkedModule?.fileName === ecuSel.fileName
    set(
      keepDoc
        ? { ecuSel, view: 'coding' }
        : { ecuSel, view: 'coding', doc: null, selected: null, query: '', changedOnly: false, linkedModule: null, step: 'read' },
    )
  },
  setStep: (step) => set({ step }),
  setLang: (lang) => {
    localStorage.setItem('lang', lang)
    set({ lang })
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },
  linkModule: () => {
    // Match the open trace to an SP-Daten module by shared function names
    // (NCS Dummy's "Module (filtered 1 of 397)" flow).
    const { doc, spDaten } = get()
    if (!doc || !spDaten) {
      set({ linkedModule: null })
      return
    }
    const nameToId = new Map<string, number>()
    for (const [id, name] of spDaten.fswNames) {
      const key = name.toLowerCase()
      if (!nameToId.has(key)) nameToId.set(key, id)
    }
    const optionNames: string[] = []
    for (const seg of doc.segments) {
      if (seg.kind === 'option') optionNames.push(seg.name.toLowerCase())
    }
    const traceIds = mapFunctionNames(optionNames, nameToId)
    if (traceIds.length === 0) {
      set({ linkedModule: null })
      return
    }
    const sortedIds = spDaten.modules.map((m) =>
      [...new Set(m.functions.filter((f) => !f.direct).map((f) => f.id))].sort((a, b) => a - b),
    )
    const hits = sortedIds.map((ids) => countSharedFunctions(traceIds, ids))
    const pick = pickModule(hits, traceIds.length)
    if (pick < 0) {
      set({ linkedModule: null })
      return
    }
    const mod = spDaten.modules[pick]
    const ecuSel = get().ecuSel
    set({
      linkedModule: {
        fileName: mod.fileName,
        matchPct: Math.round((hits[pick] * 100) / Math.max(1, traceIds.length)),
      },
      // a trace opened without a chosen ECU (or with an unresolved variant) picks its module
      ecuSel: !ecuSel ? { fileName: mod.fileName } : ecuSel.fileName ? ecuSel : { ...ecuSel, fileName: mod.fileName },
    })
  },
  setParamLang: (paramLang) => {
    localStorage.setItem('paramLang', paramLang)
    set({ paramLang })
  },
  loadOverlayCsv: (fileName, content) => {
    const overlay: Record<string, string> = { ...(get().overlay ?? {}) }
    for (const row of parseCsv(content)) {
      if (row.length < 2) continue
      const key = row[0].trim().toLowerCase()
      const ru = row[1].trim()
      if (key && ru) overlay[key] = ru
    }
    localStorage.setItem('paramLang', 'ru')
    void idbSet('ruOverlay', overlay)
    set({ overlay, overlayFile: fileName, paramLang: 'ru' })
  },
  setOverlayEntry: (name, ru) => {
    const overlay = { ...(get().overlay ?? {}) }
    const key = name.trim().toLowerCase()
    if (ru.trim()) overlay[key] = ru.trim()
    else delete overlay[key]
    void idbSet('ruOverlay', overlay)
    set({ overlay })
  },
  clearOverlay: async () => {
    await idbDel('ruOverlay')
    set({ overlay: null, overlayFile: '' })
  },
  setDictStatus: (dictStatus) => set({ dictStatus }),
  setAutoTranslateRunning: (autoTranslateRunning) => set({ autoTranslateRunning }),
  setFaqOpen: (faqOpen) => set({ faqOpen }),

  restoreOverlay: async () => {
    try {
      const saved = await idbGet<Record<string, string>>('ruOverlay')
      if (saved) set({ overlay: saved })
    } catch {
      // no overlay yet
    }
  },

  connectCar: async () => {
    set({ carError: null })
    try {
      if (!serialInstance) serialInstance = new KdCanSerial()
      if (!serialInstance.connected) {
        await serialInstance.connect()
        const probe = await probeAdapter(serialInstance)
        set({ carConnected: true, carAdapter: probe })
      } else {
        set({ carConnected: true })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ carError: msg })
      if (msg === 'no port selected' || e instanceof DOMException) {
        // user cancelled the picker — not an error worth a toast
        set({ carError: null })
      }
    }
  },

  disconnectCar: async () => {
    if (serialInstance) await serialInstance.disconnect()
    set({ carConnected: false, carAdapter: null, carFound: [], carScanProgress: null })
  },

  scanCar: async () => {
    if (!serialInstance || !serialInstance.connected) {
      set({ carError: 'Cable is not connected' })
      return
    }
    set({ carScanning: true, carFound: [], carScanProgress: { done: 0, total: 0, found: [] }, carError: null })
    cancelScanFlag = false
    try {
      // Prefer addresses known to the SP-Daten assignment table (much faster).
      const spDaten = get().spDaten
      const addresses = spDaten ? [...spDaten.ecuByAddress.keys()].sort((a, b) => a - b) : undefined
      const found = await scanBus(
        serialInstance,
        (p) => set({ carScanProgress: p, carFound: p.found }),
        () => cancelScanFlag,
        addresses,
      )
      // Identify each ECU: read its SGBD index (22 F1 50) and resolve the
      // exact variant file among the address candidates.
      // scanning stays on with no progress while the variants are identified
      set({ carScanProgress: null })
      const resolved: FoundEcu[] = []
      for (const ecu of found) {
        if (cancelScanFlag) break
        const candidates = spDaten
          ? spDaten.modules
              .filter((m) =>
                (spDaten.ecuByAddress.get(ecu.address) ?? []).some((entry) =>
                  m.fileName.toUpperCase().startsWith(entry.sgbd.toUpperCase()),
                ),
              )
              .map((m) => ({ fileName: m.fileName, codingIndex: m.codingIndex }))
          : []
        const id = await readSgbdIndex(serialInstance, ecu.address)
        const updated: FoundEcu = { ...ecu }
        if (id) {
          updated.sgbdIndex = id.sgbdIndex
          updated.codingIndex = id.codingIndex
          const variant = resolveVariant(
            updated,
            candidates.map((c) => ({ fileName: c.fileName, codingIndex: c.codingIndex })),
          )
          if (variant) updated.variantFile = variant
        }
        resolved.push(updated)
        set({ carFound: [...resolved] })
      }
      set({ carScanning: false, carScanProgress: null })
    } catch (e) {
      set({ carScanning: false, carScanProgress: null, carError: e instanceof Error ? e.message : String(e) })
    }
  },

  cancelScan: () => {
    cancelScanFlag = true
  },

  readVin: async () => {
    if (!serialInstance || !serialInstance.connected) {
      set({ carError: 'Cable is not connected' })
      return
    }
    set({ readingVin: true })
    try {
      const vin = await readVinSvc(serialInstance)
      set({ carVin: vin })
      if (vin) set({ toast: `VIN: ${vin}` })
      else set({ toast: get().lang === 'ru' ? 'VIN не прочитан' : 'VIN not read' })
    } catch (e) {
      set({ toast: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ readingVin: false })
    }
  },

  openFile: async (file) => {
    if (/\.prg$/i.test(file.name)) {
      await get().openPrgFile(file)
      return
    }
    const content = await readTextSmart(file)
    set({
      doc: parseTrc(content, file.name),
      selected: null,
      query: '',
      changedOnly: false,
      pendingScroll: null,
      view: 'coding',
      step: 'edit',
    })
  },

  setQuery: (query) => set({ query }),
  setChangedOnly: (changedOnly) => set({ changedOnly }),
  select: (selected) => set({ selected }),

  setValues: (index, values) => {
    const doc = get().doc
    if (!doc) return
    const fallback = dominantIndent(doc)
    set({
      doc: {
        ...doc,
        segments: doc.segments.map((seg, i): Segment => {
          if (i !== index || seg.kind !== 'option') return seg
          return {
            ...seg,
            values: values.map((text, j) => ({
              text,
              indent: seg.values[j]?.indent ?? fallback,
            })),
          }
        }),
      },
    })
  },

  revert: (index) => {
    const doc = get().doc
    if (!doc) return
    set({
      doc: {
        ...doc,
        segments: doc.segments.map((seg, i): Segment => {
          if (i !== index || seg.kind !== 'option') return seg
          return { ...seg, values: seg.original.map((v) => ({ ...v })) }
        }),
      },
    })
  },

  revertAll: () => {
    const doc = get().doc
    if (!doc) return
    set({
      doc: {
        ...doc,
        segments: doc.segments.map((seg): Segment =>
          seg.kind === 'option' ? { ...seg, values: seg.original.map((v) => ({ ...v })) } : seg,
        ),
      },
    })
  },

  scrollTo: (index) => set({ pendingScroll: index, selected: index }),
  clearScroll: () => set({ pendingScroll: null }),
  showToast: (toast) => set({ toast }),

  setView: (view) => set({ view }),

  openPrgFile: async (file) => {
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const prg = parsePrg(data)
      set((s) => ({
        prgFiles: [
          ...s.prgFiles.filter((f) => f.name !== file.name),
          { name: file.name, size: file.size, prg },
        ],
        prgActive: file.name,
        prgJob: null,
        prgTable: null,
        view: 'prg',
      }))
    } catch (e) {
      set({ toast: `PRG parse error: ${e instanceof Error ? e.message : String(e)}` })
    }
  },

  selectPrg: (prgActive) => set({ prgActive, prgJob: null, prgTable: null }),
  selectPrgJob: (prgJob) => set({ prgJob }),
  selectPrgTable: (prgTable) => set({ prgTable }),

  openSpDatenFolder: async () => {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: (o?: { mode?: string }) => Promise<FileSystemDirectoryHandle>
      }
    ).showDirectoryPicker
    if (!picker) {
      get().showToast('Folder picker needs Chrome or Edge — use “Choose files” instead')
      return
    }
    let dir: FileSystemDirectoryHandle
    try {
      dir = await picker.call(window, { mode: 'read' })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      set({ toast: `Cannot open folder: ${e instanceof Error ? e.message : String(e)}` })
      return
    }
    await get().loadSpDatenDir(dir)
    void idbSet(SP_DATEN_DIR_KEY, dir).catch(() => {
      // handle not storable (older browser) — the folder is just not remembered
    })
  },

  openSpDatenFiles: async (files) => {
    set({ spDatenStatus: 'Indexing…' })
    const items = await readSpDatenFiles(files, (done, total) =>
      set({ spDatenStatus: `Indexing… ${done}/${total}` }),
    )
    set({ spDatenStatus: null })
    if (items.length === 0) {
      set({ toast: 'No SP-Daten files among the selected files' })
      return
    }
    set({ spDaten: indexSpDatenItems(items, 'selection'), spDatenSaved: null })
  },

  loadSpDatenDir: async (dir) => {
    set({ spDatenStatus: 'Indexing…' })
    try {
      const items = await readSpDatenDir(dir, (n) => set({ spDatenStatus: `Indexing… ${n} files` }))
      if (items.length === 0) {
        set({ toast: 'No SP-Daten files found in this folder' })
        return
      }
      set({ spDaten: indexSpDatenItems(items, dir.name), spDatenSaved: null })
    } catch (e) {
      set({ toast: `Cannot read folder: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      set({ spDatenStatus: null })
    }
  },

  restoreSpDaten: async () => {
    let dir: DirHandle | undefined
    try {
      dir = await idbGet<DirHandle>(SP_DATEN_DIR_KEY)
    } catch {
      return
    }
    if (!dir) return
    // Chrome may keep the grant ("allow on every visit"); otherwise it needs a click
    const state = (await dir.queryPermission?.({ mode: 'read' })) ?? 'prompt'
    if (state === 'granted') await get().loadSpDatenDir(dir)
    else set({ spDatenSaved: dir.name })
  },

  reconnectSpDaten: async () => {
    const dir = await idbGet<DirHandle>(SP_DATEN_DIR_KEY).catch(() => undefined)
    if (!dir) {
      set({ spDatenSaved: null })
      return
    }
    const state = (await dir.requestPermission?.({ mode: 'read' })) ?? 'denied'
    if (state === 'granted') await get().loadSpDatenDir(dir)
  },
}))

/** Hook: parameter translation honoring parameter language and the RU overlay. */
// Built-in option-code descriptions (from the FA reference): code → {ru, en}
const FA_BY_CODE: Record<string, { ru?: string; en: string }> = Object.fromEntries(
  (faOptions as { code: string; en: string; ru?: string[] }[]).map((o) => [
    o.code.toLowerCase(),
    { ru: o.ru?.[0], en: o.en },
  ]),
)

export function useTranslator() {
  const paramLang = useStore((s) => s.paramLang)
  const overlay = useStore((s) => s.overlay)
  return (token: string): string | undefined => {
    if (paramLang === 'original') return undefined
    const key = token.trim().toLowerCase()
    const own = overlay?.[key]
    if (own) return own
    // FA option codes (S508A…) — from the built-in options reference
    if (/^s[0-9a-z]{3,5}$/.test(key) && FA_BY_CODE[key]) {
      const fa = FA_BY_CODE[key]
      return paramLang === 'ru' ? (fa.ru ?? fa.en) : fa.en
    }
    const lang: 'ru' | 'en' = paramLang === 'ru' ? 'ru' : 'en'
    // translateValue checks the exact value and function overrides before the
    // word-by-word fallback, so nicht_aktiv reads "выключено", not "Nicht включено"
    const tr = translateValue(token, lang)
    return tr.toLowerCase() !== token.toLowerCase() ? tr : undefined
  }
}
