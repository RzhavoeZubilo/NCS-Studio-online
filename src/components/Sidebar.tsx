import { useMemo, useState } from 'react'
import { Loader2, Search, Square } from 'lucide-react'
import { useStore, type EcuSelection } from '@/state/store'
import { docStats } from '@/lib/trc'
import { ecuLabel, hexAddr } from '@/lib/ecuInfo'

const sectionTitle = 'px-3 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-wide text-faint'

/** Selecting another ECU drops the open trace — ask first when it has edits. */
function useSelectEcu() {
  const selectEcu = useStore((s) => s.selectEcu)
  const lang = useStore((s) => s.lang)
  return (sel: EcuSelection) => {
    const { doc, ecuSel } = useStore.getState()
    const same =
      ecuSel &&
      ecuSel.address === sel.address &&
      (ecuSel.fileName === sel.fileName || !sel.fileName)
    if (same) {
      useStore.getState().setView('coding')
      return
    }
    if (doc && docStats(doc).changed > 0) {
      const ok = confirm(
        lang === 'ru'
          ? 'В открытом файле есть несохранённые изменения. Перейти к другому блоку и закрыть файл?'
          : 'The open file has unsaved changes. Switch ECU and close the file?',
      )
      if (!ok) return
    }
    selectEcu(sel)
  }
}

function CarEcus() {
  const lang = useStore((s) => s.lang)
  const connected = useStore((s) => s.carConnected)
  const scanning = useStore((s) => s.carScanning)
  const progress = useStore((s) => s.carScanProgress)
  const found = useStore((s) => s.carFound)
  const scanCar = useStore((s) => s.scanCar)
  const cancelScan = useStore((s) => s.cancelScan)
  const spDaten = useStore((s) => s.spDaten)
  const ecuSel = useStore((s) => s.ecuSel)
  const select = useSelectEcu()
  const ru = lang === 'ru'

  const startScan = () => {
    const ok = confirm(
      ru
        ? 'Скан опрашивает адреса шины запросом TesterPresent и ничего в блоках не меняет.\n\nУбедитесь: машина стоит, зажигание включено, двигатель заглушен. Продолжить?'
        : 'The scan probes bus addresses with TesterPresent and changes nothing in the ECUs.\n\nMake sure the car is parked, ignition on, engine off. Continue?',
    )
    if (ok) void scanCar()
  }

  return (
    <div>
      <div className="flex items-center justify-between pr-2">
        <div className={sectionTitle}>{ru ? 'Блоки в машине' : 'ECUs in the car'}</div>
        {connected &&
          (scanning ? (
            <button type="button" onClick={cancelScan} className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-mut hover:bg-panel2 hover:text-fg">
              <Square className="h-3 w-3" /> {ru ? 'Стоп' : 'Stop'}
            </button>
          ) : (
            <button type="button" onClick={startScan} className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-blue-500 hover:bg-panel2">
              <Search className="h-3 w-3" /> {found.length ? (ru ? 'Повторить скан' : 'Rescan') : ru ? 'Сканировать' : 'Scan'}
            </button>
          ))}
      </div>

      {scanning && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-mut">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          {progress
            ? `${ru ? 'Опрос адресов' : 'Probing'} ${progress.done}/${progress.total}`
            : ru
              ? 'Определяю варианты…'
              : 'Identifying variants…'}
        </div>
      )}

      {!connected && found.length === 0 && (
        <p className="px-3 pb-1 text-xs leading-relaxed text-faint">
          {ru
            ? 'Подключите кабель и запустите скан — блоки появятся здесь с точным вариантом.'
            : 'Connect the cable and scan — ECUs appear here with their exact variant.'}
        </p>
      )}
      {connected && !scanning && found.length === 0 && (
        <p className="px-3 pb-1 text-xs leading-relaxed text-faint">
          {ru ? 'Нажмите «Сканировать», чтобы найти блоки.' : 'Press Scan to find the ECUs.'}
        </p>
      )}

      <div className="px-1.5">
        {found.map((ecu) => {
          const label = ecuLabel(spDaten, { address: ecu.address, fileName: ecu.variantFile })
          const selected =
            ecuSel?.address === ecu.address ||
            (ecuSel?.address === undefined && !!ecu.variantFile && ecuSel?.fileName === ecu.variantFile)
          return (
            <button
              key={ecu.address}
              type="button"
              onClick={() => select({ address: ecu.address, fileName: ecu.variantFile })}
              title={label.long || undefined}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                selected ? 'bg-sel text-fg' : 'text-fg2 hover:bg-panel2/60'
              }`}
            >
              <span className="min-w-0 truncate text-sm font-medium">{label.short}</span>
              <span className={`shrink-0 font-mono text-xs ${ecu.variantFile ? 'text-blue-500' : 'text-faint'}`}>
                {ecu.variantFile ?? hexAddr(ecu.address)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AllModules() {
  const lang = useStore((s) => s.lang)
  const spDaten = useStore((s) => s.spDaten)
  const ecuSel = useStore((s) => s.ecuSel)
  const select = useSelectEcu()
  const [filter, setFilter] = useState('')
  const ru = lang === 'ru'

  const rows = useMemo(() => {
    if (!spDaten) return []
    return spDaten.modules.map((m) => ({ m, label: ecuLabel(spDaten, { fileName: m.fileName }) }))
  }, [spDaten])

  const f = filter.trim().toLowerCase()
  const visible = f
    ? rows.filter(
        ({ m, label }) =>
          m.fileName.toLowerCase().includes(f) ||
          m.family.toLowerCase().includes(f) ||
          label.short.toLowerCase().includes(f) ||
          label.long.toLowerCase().includes(f),
      )
    : rows

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={sectionTitle}>
        {ru ? 'Все блоки SP-Daten' : 'All SP-Daten modules'}
        {spDaten && <span className="ml-1 normal-case tracking-normal text-faint2">({rows.length})</span>}
      </div>
      {!spDaten ? (
        <p className="px-3 text-xs leading-relaxed text-faint">
          {ru
            ? 'Выберите папку SP-Daten кузова в верхней панели (например, E89 для E90) — здесь появится список всех блоков.'
            : 'Choose the chassis SP-Daten folder in the top bar (e.g. E89 for an E90) to list every module here.'}
        </p>
      ) : (
        <>
          <div className="px-3 pb-1.5">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={ru ? 'KOMBI, FRM, JBBF…' : 'KOMBI, FRM, JBBF…'}
              spellCheck={false}
              className="w-full rounded-lg border border-line bg-panel px-2.5 py-1 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {visible.map(({ m, label }) => {
              const selected = ecuSel?.fileName === m.fileName
              return (
                <button
                  key={m.fileName}
                  type="button"
                  onClick={() => select({ fileName: m.fileName })}
                  title={label.long || undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition-colors ${
                    selected ? 'bg-sel text-fg' : 'text-fg2 hover:bg-panel2/60'
                  }`}
                >
                  <span className="min-w-0 truncate text-[13px]">{label.short}</span>
                  <span className="shrink-0 font-mono text-xs text-faint">{m.fileName}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-panel/30">
      <CarEcus />
      <div className="mx-3 my-2 border-t border-line" />
      <AllModules />
    </aside>
  )
}
