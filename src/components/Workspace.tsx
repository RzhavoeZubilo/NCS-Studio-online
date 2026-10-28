import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { AlertTriangle, ArrowRight, Check, FileDown, Upload } from 'lucide-react'
import { useStore, type Step } from '@/state/store'
import { useDescribe } from '@/state/describe'
import { docStats, isChanged, serializeMan, serializeTrc } from '@/lib/trc'
import { saveTextFile } from '@/lib/fileio'
import { ecuLabel, hexAddr, sgbdOf, variantCandidates } from '@/lib/ecuInfo'
import { OptionRows } from '@/components/OptionRows'
import { DetailPanel } from '@/components/DetailPanel'
import { btn, btnPrimary } from '@/components/ui'

function useRu() {
  return useStore((s) => s.lang) === 'ru'
}

/** Drop zone + file button for FSW_PSW.TRC (the window accepts drops anywhere). */
function TraceDrop({ hint }: { hint: ReactNode }) {
  const ru = useRu()
  const openFile = useStore((s) => s.openFile)
  const inputRef = useRef<HTMLInputElement>(null)
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void openFile(file)
  }
  return (
    <div className="rounded-2xl border-2 border-dashed border-line p-8 text-center">
      <Upload className="mx-auto h-7 w-7 text-blue-500" />
      <div className="mt-3 text-sm font-medium text-fg">
        {ru ? 'Перетащите FSW_PSW.TRC в окно' : 'Drop FSW_PSW.TRC into the window'}
      </div>
      <div className="mt-1 text-xs text-faint">{hint}</div>
      <button type="button" onClick={() => inputRef.current?.click()} className={`${btnPrimary} mt-4`}>
        {ru ? 'Выбрать файл' : 'Choose file'}
      </button>
      <input ref={inputRef} type="file" accept=".trc,.man,.txt,.prg" className="hidden" onChange={onPick} />
    </div>
  )
}

function Welcome() {
  const ru = useRu()
  const spDaten = useStore((s) => s.spDaten)
  const connected = useStore((s) => s.carConnected)
  const descriptions = useStore((s) => s.descriptions)
  const items = [
    {
      done: !!spDaten,
      text: ru
        ? 'Выберите папку SP-Daten кузова в верхней панели — для E90 это E89. Папка запоминается.'
        : 'Choose the chassis SP-Daten folder in the top bar — E89 for an E90. The folder is remembered.',
    },
    {
      done: !!descriptions,
      text: ru
        ? 'Необязательно: перетащите в окно Translations.csv из папки NCS Dummy — добавятся пояснения к значениям wert_xx. Файл запоминается.'
        : 'Optional: drop Translations.csv from the NCS Dummy folder into the window to explain wert_xx values. The file is remembered.',
    },
    {
      done: connected,
      text: ru
        ? 'Подключите кабель и просканируйте шину — или выберите блок из списка слева без машины.'
        : 'Connect the cable and scan the bus — or pick a module from the list on the left.',
    },
    {
      done: false,
      text: ru
        ? 'Выберите блок: дальше приложение проведёт по шагам «прочитать → изменить → записать».'
        : 'Pick an ECU: the app then walks you through read → edit → write.',
    },
  ]
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-xl">
        <h2 className="text-lg font-semibold text-fg">{ru ? 'Кодирование блока' : 'Coding an ECU'}</h2>
        <ol className="mt-4 space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  it.done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-panel2 text-mut'
                }`}
              >
                {it.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="pt-0.5 text-fg2">{it.text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <TraceDrop
            hint={
              ru
                ? 'Уже прочитали блок в NCS Expert? Откройте файл — блок определится по содержимому.'
                : 'Already read the ECU in NCS Expert? Open the file — the module is matched by content.'
            }
          />
        </div>
      </div>
    </div>
  )
}

function EcuHeader() {
  const ru = useRu()
  const spDaten = useStore((s) => s.spDaten)
  const ecuSel = useStore((s) => s.ecuSel)
  const doc = useStore((s) => s.doc)
  const linkedModule = useStore((s) => s.linkedModule)
  const selectEcu = useStore((s) => s.selectEcu)
  const carFound = useStore((s) => s.carFound)
  if (!ecuSel) {
    return (
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-lg font-semibold text-fg">{ru ? 'Блок не определён' : 'Unknown ECU'}</h2>
        <p className="mt-0.5 text-sm text-mut">
          {spDaten
            ? ru
              ? 'Файл не похож ни на один блок из SP-Daten — выберите блок в списке слева.'
              : 'The file matches no SP-Daten module — pick the ECU on the left.'
            : ru
              ? 'Выберите SP-Daten в верхней панели — блок определится по содержимому файла и появятся все возможные значения.'
              : 'Choose SP-Daten in the top bar — the ECU is matched by file content and every possible value appears.'}
        </p>
      </div>
    )
  }

  const found = carFound.find((e) => e.address === ecuSel.address)
  const label = ecuLabel(spDaten, { ...ecuSel, sgbd: found?.sgbd })
  const module = spDaten?.modules.find((m) => m.fileName === ecuSel.fileName)
  const candidates =
    !ecuSel.fileName && spDaten && ecuSel.address !== undefined
      ? variantCandidates(spDaten, ecuSel.address, found?.diagIndex)
      : []
  const mismatch = doc && linkedModule && ecuSel.fileName && linkedModule.fileName !== ecuSel.fileName

  return (
    <div className="border-b border-line px-5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-fg">{label.short}</h2>
        {label.long && <span className="text-sm text-mut">{label.long}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-faint">
          {ecuSel.fileName && <span className="font-mono text-blue-500">{ecuSel.fileName}</span>}
          {module && <span>INDEX {module.codingIndex.toString(16).toUpperCase().padStart(2, '0')}</span>}
          {ecuSel.address !== undefined && <span>{ru ? 'адрес' : 'address'} {hexAddr(ecuSel.address)}</span>}
          {doc && <span className="font-mono">{doc.fileName}</span>}
          {doc && linkedModule && !mismatch && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-600">
              {ru ? 'совпадение' : 'match'} {linkedModule.matchPct}%
            </span>
          )}
        </span>
      </div>

      {candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-mut">
          {ru ? 'Вариант не определён по индексу. Возможные файлы:' : 'Variant not resolved by index. Candidates:'}
          {candidates.slice(0, 12).map((m) => (
            <button
              key={m.fileName}
              type="button"
              onClick={() => selectEcu({ ...ecuSel, fileName: m.fileName })}
              className="rounded-md border border-line px-1.5 py-0.5 font-mono text-fg2 transition-colors hover:border-blue-600"
            >
              {m.fileName}
            </button>
          ))}
        </div>
      )}

      {mismatch && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {ru
            ? `Файл похож на ${linkedModule.fileName} (${linkedModule.matchPct}%), а выбран ${ecuSel.fileName}. Проверьте, что в NCS Expert прочитан нужный блок.`
            : `The file looks like ${linkedModule.fileName} (${linkedModule.matchPct}%), but ${ecuSel.fileName} is selected. Check that NCS Expert read the right ECU.`}
          <button
            type="button"
            onClick={() => selectEcu({ ...ecuSel, fileName: linkedModule.fileName })}
            className="rounded-md border border-amber-600/50 px-2 py-0.5 transition-colors hover:bg-amber-500/15"
          >
            {ru ? `Это ${linkedModule.fileName}` : `It is ${linkedModule.fileName}`}
          </button>
        </div>
      )}
    </div>
  )
}

function Stepper() {
  const ru = useRu()
  const step = useStore((s) => s.step)
  const setStep = useStore((s) => s.setStep)
  const doc = useStore((s) => s.doc)
  const changed = doc ? docStats(doc).changed : 0
  const steps: { id: Step; label: string; note: string; done: boolean }[] = [
    { id: 'read', label: ru ? 'Прочитать' : 'Read', note: doc ? doc.fileName : ru ? 'из блока или файла' : 'from the ECU or a file', done: !!doc },
    {
      id: 'edit',
      label: ru ? 'Изменить' : 'Edit',
      note: changed ? (ru ? `изменений: ${changed}` : `${changed} changed`) : ru ? 'нет изменений' : 'no changes',
      done: changed > 0,
    },
    { id: 'write', label: ru ? 'Записать' : 'Write', note: ru ? 'FSW_PSW.MAN → NCS Expert' : 'FSW_PSW.MAN → NCS Expert', done: false },
  ]
  return (
    <div className="flex gap-2 px-5 py-3">
      {steps.map((s, i) => {
        const active = step === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`flex flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
              active ? 'border-blue-600 bg-sel' : 'border-line hover:bg-panel/60'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                s.done ? 'bg-emerald-500/15 text-emerald-600' : active ? 'bg-blue-600 text-white' : 'bg-panel2 text-mut'
              }`}
            >
              {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm ${active ? 'font-medium text-fg' : 'text-fg2'}`}>{s.label}</span>
              <span className="block truncate text-xs text-faint">{s.note}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Instructions({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2 text-sm text-fg2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-4 shrink-0 text-right text-faint">{i + 1}.</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  )
}

const code = (s: string) => <code className="rounded bg-panel2 px-1 font-mono text-[13px] text-fg">{s}</code>

/** Reading the coding straight from the ECU over the cable (KWP2000 22 30xx). */
function ReadFromCar() {
  const ru = useRu()
  const connected = useStore((s) => s.carConnected)
  const ecuSel = useStore((s) => s.ecuSel)
  const spDaten = useStore((s) => s.spDaten)
  const progress = useStore((s) => s.codingRead)
  const readCodingFromCar = useStore((s) => s.readCodingFromCar)
  const module = spDaten?.modules.find((m) => m.fileName === ecuSel?.fileName)

  // what is still missing, in the order the user fixes it
  const missing = !connected
    ? ru
      ? 'Подключите кабель и просканируйте шину.'
      : 'Connect the cable and scan the bus.'
    : ecuSel?.address === undefined
      ? ru
        ? 'Выберите блок из списка «Блоки в машине».'
        : 'Pick the ECU under “ECUs in the car”.'
      : !spDaten
        ? ru
          ? 'Выберите SP-Daten: без файла кодировки байты не перевести в параметры.'
          : 'Choose SP-Daten: the coding file turns bytes into parameters.'
        : !module
          ? ru
            ? 'Файл кодировки блока не определён — выберите вариант в шапке блока.'
            : 'The ECU coding file is unknown — pick the variant in the ECU header.'
          : null

  return (
    <div className="rounded-xl border border-line bg-panel/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{ru ? 'Прочитать из блока' : 'Read from the ECU'}</div>
          <div className="text-xs text-faint">
            {missing ??
              (ru
                ? `Только чтение: ${module!.fileName}, блоки кодировки читаются запросом 22 30xx.`
                : `Read-only: ${module!.fileName}, coding blocks are read with 22 30xx.`)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void readCodingFromCar()}
          disabled={!!missing || !!progress}
          className={btnPrimary}
        >
          {progress
            ? `${ru ? 'Чтение' : 'Reading'} ${progress.done}/${progress.total}…`
            : ru
              ? 'Прочитать'
              : 'Read'}
        </button>
      </div>
    </div>
  )
}

function ReadStep() {
  const ru = useRu()
  const doc = useStore((s) => s.doc)
  const ecuSel = useStore((s) => s.ecuSel)
  const setStep = useStore((s) => s.setStep)
  const codingSource = useStore((s) => s.codingSource)
  const sgbd = ecuSel?.fileName ? sgbdOf(ecuSel.fileName) : null
  const stats = doc ? docStats(doc) : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto px-5 py-4">
      {doc && stats && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-4 py-3 text-sm">
          <Check className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="flex-1 text-fg2">
            {codingSource ? (ru ? 'Прочитано из блока' : 'Read from the ECU') : ru ? 'Загружен' : 'Loaded'}{' '}
            <span className="font-mono text-fg">{doc.fileName}</span> — {stats.options} {ru ? 'опций' : 'options'}
            {codingSource && codingSource.unmatched.length > 0 && (
              <span className="text-faint">
                {' '}
                · {ru ? 'не распознано' : 'unrecognised'}: {codingSource.unmatched.length}
              </span>
            )}
          </span>
          <button type="button" onClick={() => setStep('edit')} className={btnPrimary}>
            {ru ? 'Изменить' : 'Edit'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <ReadFromCar />
      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-mut hover:text-fg">
          {ru ? 'Или через NCS Expert и файл FSW_PSW.TRC' : 'Or via NCS Expert and an FSW_PSW.TRC file'}
        </summary>
        <div className="mt-3 space-y-4">
          <Instructions
            items={
              ru
                ? [
                    <>Прочитайте FA: {code('VIN/ZCS/FA')} → {code('ZCS/FA f. ECU')}, серия по SP-Daten, источник CAS или FRM.</>,
                    <>{code('Process ECU')} → выберите блок {sgbd ? code(sgbd) : 'нужный блок'} → {code('Change job')} → {code('CODIERDATEN_LESEN')} → {code('Execute job')}.</>,
                    <>NCS Expert сохранит результат в {code('C:\\NCSEXPER\\WORK\\FSW_PSW.TRC')}.</>,
                  ]
                : [
                    <>Read the FA: {code('VIN/ZCS/FA')} → {code('ZCS/FA f. ECU')}, chassis per SP-Daten, source CAS or FRM.</>,
                    <>{code('Process ECU')} → pick {sgbd ? code(sgbd) : 'the ECU'} → {code('Change job')} → {code('CODIERDATEN_LESEN')} → {code('Execute job')}.</>,
                    <>NCS Expert saves the result to {code('C:\\NCSEXPER\\WORK\\FSW_PSW.TRC')}.</>,
                  ]
            }
          />
          <TraceDrop
            hint={
              doc
                ? ru
                  ? 'Новый файл заменит текущий.'
                  : 'A new file replaces the current one.'
                : ru
                  ? 'Файл не покидает браузер.'
                  : 'The file never leaves your browser.'
            }
          />
        </div>
      </details>
    </div>
  )
}

/** Read-only list of the module's functions with every possible value. */
function ModuleFunctions() {
  const ru = useRu()
  const spDaten = useStore((s) => s.spDaten)
  const ecuSel = useStore((s) => s.ecuSel)
  const describe = useDescribe()
  const [filter, setFilter] = useState('')
  const module = spDaten?.modules.find((m) => m.fileName === ecuSel?.fileName)

  const functions = useMemo(() => {
    if (!spDaten || !module) return []
    return module.functions
      .map((f) => ({ ...f, name: spDaten.fswNames.get(f.id) ?? `#${f.id}` }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [spDaten, module])

  if (!spDaten || !module) return null
  const f = filter.trim().toLowerCase()
  const visible = f
    ? functions.filter((fn) => fn.name.toLowerCase().includes(f) || describe.fn(fn.name).title.toLowerCase().includes(f))
    : functions

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-5 pb-2">
        <span className="text-sm font-medium text-fg">
          {ru ? 'Функции блока' : 'Module functions'} <span className="text-faint">({functions.length})</span>
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={ru ? 'Поиск функции' : 'Search functions'}
          spellCheck={false}
          className="w-72 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
        {visible.map((fn) => (
          <div key={fn.id} className="border-b border-line px-5 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-fg">{describe.fn(fn.name).title}</span>
              {describe.fn(fn.name).title !== fn.name && <span className="font-mono text-xs text-faint">{fn.name}</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {fn.values.map((v) => {
                const name = spDaten.pswNames.get(v) ?? `#${v}`
                return (
                  <span key={v} title={describe.value(fn.name, name)} className="rounded border border-line px-1.5 font-mono text-xs text-mut">
                    {name}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NeedTrace() {
  const ru = useRu()
  const setStep = useStore((s) => s.setStep)
  return (
    <div className="flex items-center gap-3 px-5 py-3 text-sm text-mut">
      {ru ? 'Сначала загрузите прочитанный файл блока.' : 'Load the ECU trace first.'}
      <button type="button" onClick={() => setStep('read')} className={btn}>
        {ru ? 'К шагу «Прочитать»' : 'Go to Read'}
      </button>
    </div>
  )
}

function EditStep() {
  const ru = useRu()
  const doc = useStore((s) => s.doc)
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const changedOnly = useStore((s) => s.changedOnly)
  const setChangedOnly = useStore((s) => s.setChangedOnly)
  const revertAll = useStore((s) => s.revertAll)
  const setStep = useStore((s) => s.setStep)
  const describe = useDescribe()

  const rows = useMemo(() => {
    if (!doc) return []
    const q = query.trim().toLowerCase()
    const out: number[] = []
    doc.segments.forEach((seg, i) => {
      if (seg.kind !== 'option') return
      if (changedOnly && !isChanged(seg)) return
      if (q) {
        const text = describe.fn(seg.name)
        const hay = `${seg.name}\n${text.title}\n${text.original ?? ''}\n${seg.values.map((v) => v.text).join('\n')}`.toLowerCase()
        if (!hay.includes(q)) return
      }
      out.push(i)
    })
    return out
  }, [doc, query, changedOnly, describe])

  if (!doc) {
    return (
      <>
        <NeedTrace />
        <ModuleFunctions />
      </>
    )
  }
  const stats = docStats(doc)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-y border-line bg-panel/40 px-5 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ru ? 'Поиск: дневные огни, PARKLICHT…' : 'Search: daytime lights, PARKLICHT…'}
          spellCheck={false}
          className="w-80 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
        />
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-mut">
          <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} className="accent-blue-600" />
          {ru ? 'Только изменённые' : 'Changed only'}
        </label>
        <span className="text-xs text-faint">
          {rows.length} / {stats.options}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {stats.changed > 0 && (
            <>
              <span className="text-xs text-amber-600">
                {ru ? `изменений: ${stats.changed}` : `${stats.changed} changed`}
              </span>
              <button type="button" onClick={revertAll} className={btn}>
                {ru ? 'Отменить всё' : 'Revert all'}
              </button>
            </>
          )}
          <button type="button" onClick={() => setStep('write')} disabled={stats.changed === 0} className={btnPrimary}>
            {ru ? 'Записать' : 'Write'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <OptionRows rows={rows} />
        </div>
        <DetailPanel />
      </div>
    </>
  )
}

function WriteStep() {
  const ru = useRu()
  const doc = useStore((s) => s.doc)
  const ecuSel = useStore((s) => s.ecuSel)
  const setStep = useStore((s) => s.setStep)
  const scrollTo = useStore((s) => s.scrollTo)
  const showToast = useStore((s) => s.showToast)
  const describe = useDescribe()
  if (!doc) return <NeedTrace />

  const sgbd = ecuSel?.fileName ? sgbdOf(ecuSel.fileName) : null
  const changes = doc.segments.flatMap((seg, i) =>
    seg.kind === 'option' && isChanged(seg)
      ? [{ index: i, name: seg.name, from: seg.original.map((v) => v.text).join(', '), to: seg.values.map((v) => v.text).join(', ') }]
      : [],
  )

  const saveMan = async () => {
    await saveTextFile('FSW_PSW.MAN', serializeMan(doc))
    showToast(ru ? 'FSW_PSW.MAN сохранён' : 'FSW_PSW.MAN saved')
  }
  const saveTrc = async () => {
    await saveTextFile(doc.fileName, serializeTrc(doc))
    showToast(ru ? 'Файл .trc сохранён' : '.trc saved')
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto px-5 py-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-fg">
          {ru ? `Что изменится (${changes.length})` : `Changes (${changes.length})`}
        </h3>
        {changes.length === 0 ? (
          <p className="text-sm text-faint">{ru ? 'Изменений нет — записывать нечего.' : 'No changes — nothing to write.'}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            {changes.map((c) => (
              <button
                key={c.index}
                type="button"
                onClick={() => {
                  setStep('edit')
                  scrollTo(c.index)
                }}
                className="grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-3 border-b border-line px-4 py-2 text-left last:border-b-0 hover:bg-panel/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-fg">{describe.fn(c.name).title}</span>
                  <span className="block truncate font-mono text-xs text-faint">{c.name}</span>
                </span>
                <span className="truncate font-mono text-[13px]">
                  <span className="text-faint line-through">{c.from || '—'}</span>
                  <span className="mx-2 text-faint">→</span>
                  <span className="text-amber-600">{c.to || '—'}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-fg">{ru ? 'Закодируйте в NCS Expert' : 'Code it with NCS Expert'}</h3>
        <Instructions
          items={
            ru
              ? [
                  <>Сохраните {code('FSW_PSW.MAN')} в {code('C:\\NCSEXPER\\WORK')}, заменив старый.</>,
                  <>{code('Process ECU')} → тот же блок {sgbd ? code(sgbd) : ''} → {code('Change job')} → {code('SG_CODIEREN')} → {code('Execute job')}.</>,
                  <>Профиль NCS Expert должен брать {code('FSW_PSW.MAN')} (режим эксперта).</>,
                ]
              : [
                  <>Save {code('FSW_PSW.MAN')} to {code('C:\\NCSEXPER\\WORK')}, replacing the old one.</>,
                  <>{code('Process ECU')} → the same ECU {sgbd ? code(sgbd) : ''} → {code('Change job')} → {code('SG_CODIEREN')} → {code('Execute job')}.</>,
                  <>The NCS Expert profile must use {code('FSW_PSW.MAN')} (expert mode).</>,
                ]
          }
        />
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => void saveMan()} disabled={changes.length === 0} className={btnPrimary}>
            <FileDown className="h-4 w-4" /> {ru ? 'Сохранить FSW_PSW.MAN' : 'Save FSW_PSW.MAN'}
          </button>
          <button type="button" onClick={() => void saveTrc()} className="text-sm text-mut underline-offset-2 hover:text-fg hover:underline">
            {ru ? 'или сохранить как .trc' : 'or save as .trc'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Workspace() {
  const ecuSel = useStore((s) => s.ecuSel)
  const doc = useStore((s) => s.doc)
  const step = useStore((s) => s.step)
  if (!ecuSel && !doc) return <Welcome />
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EcuHeader />
      <Stepper />
      {step === 'read' ? <ReadStep /> : step === 'edit' ? <EditStep /> : <WriteStep />}
    </div>
  )
}
