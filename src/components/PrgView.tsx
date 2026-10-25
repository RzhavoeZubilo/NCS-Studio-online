import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Cpu, Plus } from 'lucide-react'
import { useStore } from '@/state/store'
import type { PrgFile } from '@/lib/prg'
import { t } from '@/lib/i18n'

function PrgEmptyState() {
  const lang = useStore((s) => s.lang)
  const inputRef = useRef<HTMLInputElement>(null)
  const openPrgFile = useStore((s) => s.openPrgFile)

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = ''
    const file = e.target.files?.[0]
    if (file) void openPrgFile(file)
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-2xl border-2 border-dashed border-line p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-panel">
          <Cpu className="h-7 w-7 text-blue-500" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg">{t(lang, 'openPrgFile')}</h2>
        <p className="mt-1 text-sm text-faint">{t(lang, 'dropPrg')}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" /> Choose .prg
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".prg"
          multiple
          className="hidden"
          onChange={(e) => void onPick(e)}
        />
      </div>
    </div>
  )
}

function JobDetail({ prg, jobIdx }: { prg: PrgFile; jobIdx: number | null }) {
  const lang = useStore((s) => s.lang)
  if (jobIdx == null) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-faint2">
        {t(lang, 'selectJob')}
      </div>
    )
  }
  const job = prg.jobs[jobIdx]
  if (!job) return null
  const description = job.comments.filter((c) => !c.startsWith('JOBNAME:'))
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="break-all font-mono text-sm font-semibold text-blue-500">
            {job.name}
          </span>
          <span className="font-mono text-xs text-faint">@ 0x{job.address.toString(16).padStart(8, '0')}</span>
        </div>
        {description.length > 0 && (
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-mut">
            {description.join('\n')}
          </pre>
        )}
      </div>
      <div className="px-4 py-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
          {t(lang, 'disassembly')} ({job.disassembly.length} {t(lang, 'instructions')})
        </div>
        <pre className="overflow-x-auto font-mono text-xs leading-[1.6] text-fg2">
          {job.disassembly.join('\n')}
        </pre>
      </div>
    </div>
  )
}

function TableDetail({ prg, tableIdx }: { prg: PrgFile; tableIdx: number | null }) {
  const lang = useStore((s) => s.lang)
  if (tableIdx == null) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-faint2">
        {t(lang, 'selectTable')}
      </div>
    )
  }
  const table = prg.tables[tableIdx]
  if (!table) return null
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mb-3 font-mono text-sm font-semibold text-blue-500">{table.name}</div>
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr>
            {table.columns.map((col) => (
              <th
                key={col}
                className="sticky top-0 border-b border-line bg-base px-3 py-1.5 text-left font-medium uppercase tracking-wide text-faint"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-line hover:bg-panel/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1 text-fg2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PrgDetail({ prg }: { prg: PrgFile }) {
  const lang = useStore((s) => s.lang)
  const [mode, setMode] = useState<'jobs' | 'tables'>('jobs')
  const [query, setQuery] = useState('')
  const [jobIdx, setJobIdx] = useState<number | null>(0)
  const [tableIdx, setTableIdx] = useState<number | null>(null)

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return prg.jobs.map((_, i) => i)
    return prg.jobs
      .map((job, i) => {
        const hay = `${job.name}\n${job.comments.join('\n')}`.toLowerCase()
        return hay.includes(q) ? i : -1
      })
      .filter((i) => i >= 0)
  }, [prg, query])

  const segBtn = (active: boolean) =>
    `rounded-md px-3 py-1 text-sm transition-colors ${
      active ? 'bg-panel2 font-medium text-fg' : 'text-mut hover:text-fg'
    }`

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel/40 px-4 py-2 text-xs text-mut">
        <span className="font-mono text-sm font-semibold text-fg">
          {prg.info.bipVersion}
        </span>
        <span>rev {prg.info.revision}</span>
        {prg.info.author && <span>{prg.info.author}</span>}
        {prg.info.lastChanged && <span>changed: {prg.info.lastChanged}</span>}
        {prg.info.packageVersion !== '00000000' && (
          <span className="font-mono">pkg {prg.info.packageVersion}</span>
        )}
        {prg.uses.length > 0 && <span>uses: {prg.uses.join(', ')}</span>}
        {prg.ssize !== 0 && <span>ssize {prg.ssize}</span>}
      </div>

      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <div className="flex items-center rounded-lg border border-line bg-panel p-0.5">
          <button type="button" onClick={() => setMode('jobs')} className={segBtn(mode === 'jobs')}>
            {t(lang, 'jobs')} ({prg.jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('tables')}
            className={segBtn(mode === 'tables')}
          >
            {t(lang, 'tables')} ({prg.tables.length})
          </button>
        </div>
        {mode === 'jobs' && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, 'searchJobs')}
            spellCheck={false}
            className="w-72 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
          />
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-line">
          {mode === 'jobs'
            ? filteredJobs.map((i) => {
                const job = prg.jobs[i]
                const preview = job.comments.find((c) => !c.startsWith('JOBNAME:')) ?? ''
                const selected = jobIdx === i
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setJobIdx(i)}
                    className={`block w-full border-b border-line px-4 py-1.5 text-left transition-colors ${
                      selected ? 'bg-sel' : 'hover:bg-panel/50'
                    }`}
                  >
                    <div className="truncate font-mono text-[13px] text-fg">{job.name}</div>
                    {preview && (
                      <div className="truncate text-xs text-faint">{preview}</div>
                    )}
                  </button>
                )
              })
            : prg.tables.map((table, i) => {
                const selected = tableIdx === i
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTableIdx(i)}
                    className={`block w-full border-b border-line px-4 py-1.5 text-left transition-colors ${
                      selected ? 'bg-sel' : 'hover:bg-panel/50'
                    }`}
                  >
                    <div className="truncate font-mono text-[13px] text-fg">
                      {table.name}
                    </div>
                    <div className="text-xs text-faint">
                      {table.rows.length} {t(lang, 'rows')} · {table.columns.length} {t(lang, 'cols')}
                    </div>
                  </button>
                )
              })}
        </div>

        {mode === 'jobs' ? (
          <JobDetail prg={prg} jobIdx={jobIdx} />
        ) : (
          <TableDetail prg={prg} tableIdx={tableIdx} />
        )}
      </div>
    </div>
  )
}

export function PrgView() {
  const lang = useStore((s) => s.lang)
  const prgFiles = useStore((s) => s.prgFiles)
  const prgActive = useStore((s) => s.prgActive)
  const selectPrg = useStore((s) => s.selectPrg)
  const openPrgFile = useStore((s) => s.openPrgFile)
  const inputRef = useRef<HTMLInputElement>(null)

  const active = prgFiles.find((f) => f.name === prgActive) ?? prgFiles[0]

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = ''
    for (const file of Array.from(e.target.files ?? [])) {
      await openPrgFile(file)
    }
  }

  if (prgFiles.length === 0 || !active) return <PrgEmptyState />

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-64 shrink-0 flex-col border-r border-line bg-panel/30">
        <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-faint">
          {t(lang, 'loadedEcus')}
        </div>
        <div className="flex-1 overflow-y-auto">
          {prgFiles.map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => selectPrg(f.name)}
              className={`block w-full border-b border-line px-4 py-2 text-left transition-colors ${
                active.name === f.name ? 'bg-sel' : 'hover:bg-panel/50'
              }`}
            >
              <div className="truncate font-mono text-[13px] text-fg">{f.name}</div>
              <div className="text-xs text-faint">
                {f.prg.jobs.length} jobs · {f.prg.tables.length} tables
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-sm text-mut transition-colors hover:bg-panel2 hover:text-fg"
        >
          <Plus className="h-4 w-4" /> {t(lang, 'addPrg')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".prg"
          multiple
          className="hidden"
          onChange={(e) => void onPick(e)}
        />
      </div>
      <PrgDetail key={active.name} prg={active.prg} />
    </div>
  )
}
