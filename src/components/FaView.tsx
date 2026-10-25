import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Search, Tag } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import faOptions from '@/data/faOptions.json'
import { useStore } from '@/state/store'

interface FaEntry {
  code: string
  en: string
  enAll: string[]
  ru?: string[]
}

const ALL: FaEntry[] = faOptions as FaEntry[]

const WHEEL_RE = /wheel|felge|\brim\b|\brad\b|диск/i
const NOT_WHEEL_RE = /steering|рулев|4-wheel|4x4/i

function isWheelEntry(e: FaEntry): boolean {
  const text = e.en + ' ' + (e.ru ?? []).join(' ')
  if (NOT_WHEEL_RE.test(text)) return false
  return WHEEL_RE.test(text)
}
const DIAMETER_RE = /(\d{2})\s*(?:["”′]|Zoll|дюйм)/i

interface GroupDef {
  key: string
  en: string
  ru: string
  match: (e: FaEntry) => boolean
  /** optional subgroups (wheels by diameter) */
  children?: { key: string; label: string }[]
}

function buildGroups(): GroupDef[] {
  const ranges = [
    ['1', '1xx Body / safety', '1xx Кузов / безопасность'],
    ['2', '2xx Powertrain / suspension', '2xx Двигатель / ходовая'],
    ['3', '3xx Exterior', '3xx Экстерьер'],
    ['4', '4xx Interior', '4xx Интерьер'],
    ['5', '5xx Lights / PDC', '5xx Свет / парктроник'],
    ['6', '6xx Audio / navigation', '6xx Аудио / навигация'],
    ['7', '7xx Sport / individual', '7xx Спорт / индивидуализация'],
    ['8', '8xx Climate / country', '8xx Климат / страны'],
    ['9', '9xx Misc', '9xx Прочее'],
    ['0', '0xx Base / packages', '0xx База / пакеты'],
  ].map(([d, en, ru]) => ({
    key: 'num' + d,
    en,
    ru,
    match: (e: FaEntry) => /^S\d{3}/.test(e.code) && e.code[1] === d,
  }))
  // wheels are pulled out of the numeric ranges into their own group
  return [
    {
      key: 'wheels',
      en: 'Wheels',
      ru: 'Диски',
      match: isWheelEntry,
      children: (() => {
        const diameters = new Set<string>()
        for (const e of ALL) {
          if (!isWheelEntry(e)) continue
          const m = (e.en + ' ' + (e.ru ?? []).join(' ')).match(DIAMETER_RE)
          if (m) diameters.add(m[1] + '"')
        }
        const list = [...diameters].sort((a, b) => parseInt(a) - parseInt(b))
        return list.length > 0
          ? [...list.map((d) => ({ key: 'wheels-' + d, label: d })), { key: 'wheels-other', label: '—' }]
          : undefined
      })(),
    },
    ...ranges,
    {
      key: 'letters',
      en: 'Letter codes (VO/SALAPA)',
      ru: 'Буквенные (VO/SALAPA)',
      match: (e: FaEntry) => /^S[A-Z]/.test(e.code),
    },
  ]
}

const GROUPS = buildGroups()

function groupOf(e: FaEntry): GroupDef {
  return GROUPS.find((g) => g.match(e)) ?? GROUPS[GROUPS.length - 1]
}

function childOf(e: FaEntry, group: GroupDef): string | null {
  if (!group.children) return null
  const m = (e.en + ' ' + (e.ru ?? []).join(' ')).match(DIAMETER_RE)
  if (m) {
    const key = group.children.find((c) => c.label === m[1] + '"')
    if (key) return key.key
  }
  return group.children[group.children.length - 1].key
}

export function FaView() {
  const lang = useStore((s) => s.lang)
  const [query, setQuery] = useState('')
  const [groupKey, setGroupKey] = useState<string | null>(null)
  const [childKey, setChildKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const parentRef = useRef<HTMLDivElement>(null)

  const withGroup = useMemo(
    () => ALL.map((e) => ({ e, g: groupOf(e), child: childOf(e, groupOf(e)) })),
    [],
  )

  const groupList = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { g } of withGroup) counts.set(g.key, (counts.get(g.key) ?? 0) + 1)
    return GROUPS.map((g) => ({ g, count: counts.get(g.key) ?? 0 }))
  }, [])

  const childList = (group: GroupDef) => {
    const counts = new Map<string, number>()
    for (const { g, child } of withGroup) {
      if (g.key !== group.key || !child) continue
      counts.set(child, (counts.get(child) ?? 0) + 1)
    }
    return (group.children ?? []).map((c) => ({ ...c, count: counts.get(c.key) ?? 0 }))
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return withGroup.filter(({ e, g, child }) => {
      if (groupKey && g.key !== groupKey) return false
      if (groupKey && childKey && child !== childKey) return false
      if (!q) return true
      const ru = (e.ru ?? []).join(' ')
      return (
        e.code.toLowerCase().includes(q) ||
        e.en.toLowerCase().includes(q) ||
        ru.toLowerCase().includes(q)
      )
    })
  }, [withGroup, query, groupKey, childKey])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 15,
  })

  return (
    <div className="flex min-h-0 flex-1">
      {/* left: group menu */}
      <div className="flex w-64 shrink-0 flex-col border-r border-line bg-panel/30">
        <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-faint">
          {lang === 'ru' ? 'Группы' : 'Groups'} · {ALL.length}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {groupList.map(({ g, count }) => {
            const label = lang === 'ru' ? g.ru : g.en
            const hasChildren = !!g.children && g.children.length > 0
            const isOpen = expanded.includes(g.key)
            return (
              <div key={g.key}>
                <div className="flex items-stretch border-b border-line">
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? expanded.filter((k) => k !== g.key) : [...expanded, g.key])}
                      title={lang === 'ru' ? 'Раскрыть' : 'Expand'}
                      className="shrink-0 border-r border-line px-1 text-faint transition-colors hover:bg-panel/50 hover:text-fg"
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setGroupKey(groupKey === g.key ? null : g.key)
                      setChildKey(null)
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-[13px] transition-colors ${
                      groupKey === g.key
                        ? 'bg-sel font-medium text-fg'
                        : 'text-fg2 hover:bg-panel/50'
                    }`}
                  >
                    {!hasChildren && <span className="w-4 shrink-0" />}
                    <span className="truncate">{label}</span>
                    <span className="ml-auto shrink-0 text-xs text-faint2">{count}</span>
                  </button>
                </div>
                {hasChildren && isOpen && (
                  <div className="bg-panel/50">
                    {childList(g).map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setGroupKey(g.key)
                          setChildKey(childKey === c.key ? null : c.key)
                        }}
                        className={`flex w-full items-center gap-1.5 border-b border-line py-1 pl-8 pr-3 text-left text-xs transition-colors ${
                          childKey === c.key ? 'bg-sel font-medium text-fg' : 'text-mut hover:text-fg'
                        }`}
                      >
                        <span className="truncate">
                          {lang === 'ru' ? 'Диаметр' : 'Diameter'} {c.label}
                        </span>
                        <span className="ml-auto text-faint2">{c.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* right: table */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel/40 px-4 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-faint">
            <Tag className="h-4 w-4" />
            {lang === 'ru' ? 'Опции (FA)' : 'Options (FA)'}
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'ru' ? 'Код или описание…' : 'Code or description…'}
              spellCheck={false}
              className="w-72 rounded-lg border border-line bg-panel py-1.5 pl-9 pr-3 text-sm text-fg outline-none transition-colors placeholder:text-faint2 focus:border-blue-600"
            />
          </div>
        </div>

        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const { e } = rows[item.index]
              const ru = (e.ru ?? [])[0]
              // Original English description is always the primary line
              // (forums reference the original); Russian is the secondary.
              const main = e.en
              const alt = lang === 'ru' ? ru ?? '' : ''
              return (
                <div
                  key={e.code + item.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }}
                  className="grid grid-cols-[120px_1fr] items-center gap-4 border-b border-line px-4 hover:bg-panel/50"
                >
                  <span className="font-mono text-[13px] font-medium text-blue-500">{e.code}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-fg2" title={e.enAll.join(' | ')}>
                      {main}
                      {e.enAll.length > 1 && (
                        <span className="ml-2 text-xs text-faint2">({e.enAll.length})</span>
                      )}
                    </div>
                    {alt && <div className="truncate text-xs text-faint2">{alt}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex h-7 shrink-0 items-center border-t border-line bg-panel/60 px-4 text-xs text-faint">
          {rows.length} / {ALL.length}
        </div>
      </div>
    </div>
  )
}
