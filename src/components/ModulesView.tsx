import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Database, FolderOpen } from 'lucide-react'
import { useStore, useTranslator } from '@/state/store'
import { t } from '@/lib/i18n'
import { CarPanel } from '@/components/CarPanel'

function ModulesEmptyState() {
  const openSpDatenFolder = useStore((s) => s.openSpDatenFolder)
  const openSpDatenFiles = useStore((s) => s.openSpDatenFiles)
  const lang = useStore((s) => s.lang)
  const inputRef = useRef<HTMLInputElement>(null)

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) void openSpDatenFiles(files)
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-line p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-panel">
          <Database className="h-7 w-7 text-blue-500" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg">{t(lang, 'openSpDaten')}</h2>
        <p className="mt-1 text-sm text-faint">{t(lang, 'spDatenHint')}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void openSpDatenFolder()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <FolderOpen className="h-4 w-4" /> {t(lang, 'openFolder')}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2 text-sm text-fg2 transition-colors hover:bg-panel2"
          >
            {t(lang, 'chooseFiles')}
          </button>
        </div>
        <p className="mt-6 text-xs text-faint2">
          {t(lang, 'localOnly')} {t(lang, 'chooseFilesHint')}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>
    </div>
  )
}

function hex2(v: number): string {
  return v.toString(16).toUpperCase().padStart(2, '0')
}

export function ModulesView() {
  const spDaten = useStore((s) => s.spDaten)
  const spDatenModule = useStore((s) => s.spDatenModule)
  const spDatenStatus = useStore((s) => s.spDatenStatus)
  const selectSpDatenModule = useStore((s) => s.selectSpDatenModule)
  const lang = useStore((s) => s.lang)
  const tr = useTranslator()
  const carFound = useStore((s) => s.carFound)
  const carOnlyModules = useStore((s) => s.carOnlyModules)
  const setCarOnlyModules = useStore((s) => s.setCarOnlyModules)
  const [moduleFilter, setModuleFilter] = useState('')
  const [funcFilter, setFuncFilter] = useState('')

  // SGBD names of the ECUs found on the bus (for "my car only" filter)
  const carSgbd = useMemo(() => {
    if (!spDaten) return new Set<string>()
    const set = new Set<string>()
    for (const ecu of carFound) {
      for (const entry of spDaten.ecuByAddress.get(ecu.address) ?? []) {
        if (entry.sgbd) set.add(entry.sgbd.toUpperCase())
      }
    }
    return set
  }, [spDaten, carFound])

  if (spDatenStatus) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-faint">
        {spDatenStatus}
      </div>
    )
  }
  if (!spDaten) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CarPanel />
        <ModulesEmptyState />
      </div>
    )
  }

  const active = spDaten.modules.find((m) => m.fileName === spDatenModule) ?? spDaten.modules[0]

  const mf = moduleFilter.trim().toLowerCase()
  const filteredModules = spDaten.modules.filter((m) => {
    if (carOnlyModules && carSgbd.size > 0) {
      const sgbd = m.fileName.split('.')[0].toUpperCase()
      if (!carSgbd.has(sgbd)) return false
    }
    if (!mf) return true
    return (
      m.fileName.toLowerCase().includes(mf) ||
      m.family.toLowerCase().includes(mf) ||
      m.functions.some((f) => (spDaten.fswNames.get(f.id) ?? '').toLowerCase().includes(mf))
    )
  })

  const ff = funcFilter.trim().toLowerCase()
  const functions = active
    ? [...active.functions]
        .map((f) => ({ ...f, name: spDaten.fswNames.get(f.id) ?? `#${f.id}` }))
        .filter((f) => !ff || f.name.toLowerCase().includes(ff))
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CarPanel />
      <div className="flex min-h-0 flex-1">
      {/* module sidebar */}
      <div className="flex w-72 shrink-0 flex-col border-r border-line bg-panel/30">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            {spDaten.modules.length} · {spDaten.folderName}
          </span>
          {carFound.length > 0 && (
            <button
              type="button"
              onClick={() => setCarOnlyModules(!carOnlyModules)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                carOnlyModules
                  ? 'border-blue-600 bg-sel font-medium text-fg'
                  : 'border-line bg-panel text-mut hover:text-fg'
              }`}
              title={lang === 'ru' ? 'Показывать только блоки, найденные в машине' : 'Show only ECUs found in the car'}
            >
              {lang === 'ru' ? 'Мои блоки' : 'My car'} ({carFound.length})
            </button>
          )}
        </div>
        <div className="px-3 pb-2">
          <input
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            placeholder={t(lang, 'filterModules')}
            spellCheck={false}
            className="w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredModules.map((m) => {
            const selected = active?.fileName === m.fileName
            return (
              <button
                key={m.fileName}
                type="button"
                onClick={() => selectSpDatenModule(m.fileName)}
                className={`block w-full border-b border-line px-4 py-1.5 text-left transition-colors ${
                  selected ? 'bg-sel' : 'hover:bg-panel/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[13px] text-fg">
                    {m.fileName}
                  </span>
                  {m.family && (
                    <span className="shrink-0 rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-mut">
                      {m.family}
                    </span>
                  )}
                </div>
                <div className="text-xs text-faint">
                  {m.functions.length} {t(lang, 'functions')} · INDEX {hex2(m.codingIndex)}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* functions of the active module */}
      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel/40 px-4 py-2 text-xs text-mut">
              <span className="font-mono text-sm font-semibold text-fg">
                {active.fileName}
              </span>
              {active.family && <span>{active.family}</span>}
              <span>
                INDEX <span className="font-mono">{hex2(active.codingIndex)}</span>
              </span>
              <span>
                {active.functions.length} {t(lang, 'functions')}
              </span>
            </div>
            <div className="border-b border-line px-4 py-2">
              <input
                value={funcFilter}
                onChange={(e) => setFuncFilter(e.target.value)}
                placeholder={t(lang, 'searchFunctions')}
                spellCheck={false}
                className="w-80 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {functions.map((f) => {
                return (
                  <div key={f.id} className="border-b border-line px-4 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[13px] text-blue-500">{f.name}</span>
                      {tr(f.name) && <span className="text-xs text-faint">{tr(f.name)}</span>}
                      {f.direct && (
                        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] uppercase text-mut">
                          direct
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {f.values.map((v) => {
                        const valueName = spDaten.pswNames.get(v) ?? `#${v}`
                        const valueTr = tr(valueName)
                        return (
                          <span
                            key={v}
                            title={valueTr}
                            className="rounded-md border border-line bg-panel px-2 py-0.5 font-mono text-xs text-fg2"
                          >
                            {valueName}
                          </span>
                        )
                      })}
                      {f.values.length === 0 && (
                        <span className="text-xs text-faint2">{t(lang, 'noValues')}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-faint2">
            {t(lang, 'selectModule')}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
