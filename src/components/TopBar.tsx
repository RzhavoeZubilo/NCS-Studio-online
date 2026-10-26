import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  BookOpen,
  Cpu,
  Database,
  FileCode2,
  HelpCircle,
  Languages,
  Loader2,
  Moon,
  PlugZap,
  Settings,
  Sun,
  Tag,
  Unplug,
  Wrench,
} from 'lucide-react'
import { useStore } from '@/state/store'
import { KdCanSerial } from '@/lib/serial'
import { t } from '@/lib/i18n'
import { SettingsPanel } from '@/components/SettingsPanel'
import { btn, chip, iconBtn } from '@/components/ui'

function CarStatus() {
  const lang = useStore((s) => s.lang)
  const connected = useStore((s) => s.carConnected)
  const adapter = useStore((s) => s.carAdapter)
  const connectCar = useStore((s) => s.connectCar)
  const disconnectCar = useStore((s) => s.disconnectCar)
  const carVin = useStore((s) => s.carVin)
  const readingVin = useStore((s) => s.readingVin)
  const readVin = useStore((s) => s.readVin)
  const ru = lang === 'ru'

  if (!connected) {
    const supported = KdCanSerial.isSupported()
    return (
      <button
        type="button"
        onClick={() => void connectCar()}
        disabled={!supported}
        title={supported ? undefined : ru ? 'Нужен Chrome или Edge (Web Serial)' : 'Needs Chrome or Edge (Web Serial)'}
        className={btn}
      >
        <PlugZap className="h-4 w-4 text-blue-500" />
        {ru ? 'Подключить кабель' : 'Connect cable'}
      </button>
    )
  }

  const parts = [
    adapter?.kind === 'smart' ? (ru ? 'умный' : 'smart') : ru ? 'прямой COM' : 'direct COM',
    adapter?.info.voltage !== undefined ? `${adapter.info.voltage.toFixed(1)} V` : null,
  ].filter(Boolean)

  return (
    <>
      <span className={`${chip} border-emerald-600/40 bg-emerald-500/10 text-emerald-600`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {ru ? 'Кабель' : 'Cable'} · {parts.join(' · ')}
        <button
          type="button"
          onClick={() => void disconnectCar()}
          title={ru ? 'Отключить кабель' : 'Disconnect cable'}
          className="-mr-1 ml-0.5 rounded p-0.5 text-emerald-600 transition-colors hover:bg-emerald-500/20"
        >
          <Unplug className="h-3.5 w-3.5" />
        </button>
      </span>
      {carVin ? (
        <span className={`${chip} font-mono`} title="VIN">
          {carVin}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void readVin()}
          disabled={readingVin}
          title={ru ? 'VIN из CAS (22 F1 90)' : 'VIN from CAS (22 F1 90)'}
          className={btn}
        >
          {readingVin ? (ru ? 'Чтение VIN…' : 'Reading VIN…') : ru ? 'Считать VIN' : 'Read VIN'}
        </button>
      )}
    </>
  )
}

function SpDatenStatus() {
  const lang = useStore((s) => s.lang)
  const spDaten = useStore((s) => s.spDaten)
  const status = useStore((s) => s.spDatenStatus)
  const saved = useStore((s) => s.spDatenSaved)
  const openFolder = useStore((s) => s.openSpDatenFolder)
  const openFiles = useStore((s) => s.openSpDatenFiles)
  const reconnect = useStore((s) => s.reconnectSpDaten)
  const inputRef = useRef<HTMLInputElement>(null)
  const ru = lang === 'ru'
  const hasPicker = 'showDirectoryPicker' in window

  const pick = () => {
    if (hasPicker) void openFolder()
    else inputRef.current?.click()
  }
  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) void openFiles(files)
  }

  let content
  if (status) {
    content = (
      <span className={chip}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
        SP-Daten · {status}
      </span>
    )
  } else if (spDaten) {
    content = (
      <button
        type="button"
        onClick={pick}
        title={ru ? 'Выбрать другую папку SP-Daten' : 'Choose another SP-Daten folder'}
        className={`${chip} transition-colors hover:bg-panel2`}
      >
        <Database className="h-3.5 w-3.5 text-blue-500" />
        {spDaten.folderName} · {spDaten.modules.length} {ru ? 'блоков' : 'modules'}
      </button>
    )
  } else if (saved) {
    content = (
      <button type="button" onClick={() => void reconnect()} className={btn}>
        <Database className="h-4 w-4 text-amber-500" />
        {ru ? `Открыть SP-Daten ${saved}` : `Reopen SP-Daten ${saved}`}
      </button>
    )
  } else {
    content = (
      <button type="button" onClick={pick} className={btn}>
        <Database className="h-4 w-4 text-blue-500" />
        {ru ? 'Выбрать SP-Daten' : 'Choose SP-Daten'}
      </button>
    )
  }

  return (
    <>
      {content}
      <input ref={inputRef} type="file" multiple className="hidden" onChange={onFiles} />
    </>
  )
}

function ToolsMenu() {
  const lang = useStore((s) => s.lang)
  const setView = useStore((s) => s.setView)
  const prgCount = useStore((s) => s.prgFiles.length)
  const [open, setOpen] = useState(false)
  const ru = lang === 'ru'

  const items = [
    { view: 'fa' as const, icon: <Tag className="h-4 w-4" />, label: ru ? 'Справочник опций (FA)' : 'Option codes (FA)' },
    { view: 'dict' as const, icon: <BookOpen className="h-4 w-4" />, label: ru ? 'Словарь переводов' : 'Translation dictionary' },
    {
      view: 'prg' as const,
      icon: <Cpu className="h-4 w-4" />,
      label: (ru ? 'Джобы ЭБУ (.prg)' : 'ECU jobs (.prg)') + (prgCount ? ` · ${prgCount}` : ''),
    },
  ]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>
        <Wrench className="h-4 w-4" />
        {ru ? 'Инструменты' : 'Tools'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-60 rounded-xl border border-line bg-panel p-1 shadow-2xl">
            {items.map((it) => (
              <button
                key={it.view}
                type="button"
                onClick={() => {
                  setView(it.view)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-fg2 transition-colors hover:bg-panel2 hover:text-fg"
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function TopBar() {
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const setFaqOpen = useStore((s) => s.setFaqOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const setView = useStore((s) => s.setView)
  const carError = useStore((s) => s.carError)

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel/60 px-4">
      <button
        type="button"
        onClick={() => setView('coding')}
        className="mr-3 flex items-center gap-2"
        title={lang === 'ru' ? 'К кодированию' : 'Back to coding'}
      >
        <FileCode2 className="h-5 w-5 text-blue-500" />
        <span className="font-semibold tracking-tight text-fg">NCS Studio</span>
      </button>

      <CarStatus />
      <SpDatenStatus />
      {carError && <span className="truncate text-xs text-amber-600">{carError}</span>}

      <div className="ml-auto flex items-center gap-1.5">
        <ToolsMenu />
        <button type="button" onClick={() => setFaqOpen(true)} title="FAQ" className={iconBtn}>
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          title={lang === 'ru' ? 'Language' : 'Язык'}
          className={`${iconBtn} inline-flex items-center gap-1 text-sm font-medium`}
        >
          <Languages className="h-4 w-4" />
          {lang === 'ru' ? 'RU' : 'EN'}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          className={iconBtn}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title={t(lang, 'settings')}
          className={iconBtn}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </header>
  )
}
