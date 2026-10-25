import { useRef } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import {
  BookOpen,
  FileCode2,
  FileDown,
  FolderOpen,
  HelpCircle,
  Languages,
  Tag,
  Save,
  Cpu,
  Database,
  Settings,
  Sun,
  Moon,
} from 'lucide-react'
import { useStore } from '@/state/store'
import { saveTextFile } from '@/lib/fileio'
import { serializeMan, serializeTrc } from '@/lib/trc'
import { t } from '@/lib/i18n'
import { SettingsPanel } from '@/components/SettingsPanel'

function Btn({
  onClick,
  icon,
  label,
  disabled,
  variant,
  title,
}: {
  onClick: () => void
  icon: ReactNode
  label: string
  disabled?: boolean
  variant?: 'primary'
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        variant === 'primary'
          ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-40'
          : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg2 transition-colors hover:bg-panel2 hover:text-fg disabled:pointer-events-none disabled:opacity-40'
      }
    >
      {icon}
      {label}
    </button>
  )
}

export function Header() {
  const doc = useStore((s) => s.doc)
  const openFile = useStore((s) => s.openFile)
  const translations = useStore((s) => s.translations)
  const showToast = useStore((s) => s.showToast)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const prgCount = useStore((s) => s.prgFiles.length)
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const setFaqOpen = useStore((s) => s.setFaqOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const docInput = useRef<HTMLInputElement>(null)

  const onDocPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void openFile(file)
  }

  const saveTrc = async () => {
    if (!doc) return
    await saveTextFile(doc.fileName, serializeTrc(doc))
    showToast(t(lang, 'trcSaved'))
  }

  const exportMan = async () => {
    if (!doc) return
    const base = doc.fileName.replace(/\.[^.]+$/, '')
    await saveTextFile(`${base}.man`, serializeMan(doc))
    showToast(t(lang, 'manExported'))
  }

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel/60 px-4">
      <div className="flex items-center gap-2">
        <FileCode2 className="h-5 w-5 text-blue-500" />
        <span className="font-semibold tracking-tight text-fg">NCS Studio</span>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-mut">
          web
        </span>
      </div>

      <div className="ml-4 flex items-center rounded-lg border border-line bg-panel p-0.5">
        <button
          type="button"
          onClick={() => setView('coding')}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
            view === 'coding'
              ? 'bg-panel2 font-medium text-fg'
              : 'text-mut hover:text-fg'
          }`}
        >
          <FileCode2 className="h-4 w-4" /> {t(lang, 'coding')}
        </button>
        <button
          type="button"
          onClick={() => setView('prg')}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
            view === 'prg'
              ? 'bg-panel2 font-medium text-fg'
              : 'text-mut hover:text-fg'
          }`}
        >
          <Cpu className="h-4 w-4" /> {t(lang, 'ecuJobs')}
          {prgCount > 0 && (
            <span className="rounded-full bg-sel px-1.5 text-xs text-blue-500">{prgCount}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setView('modules')}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
            view === 'modules'
              ? 'bg-panel2 font-medium text-fg'
              : 'text-mut hover:text-fg'
          }`}
        >
          <Database className="h-4 w-4" /> {t(lang, 'modules')}
        </button>
        <button
          type="button"
          onClick={() => setView('dict')}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
            view === 'dict'
              ? 'bg-panel2 font-medium text-fg'
              : 'text-mut hover:text-fg'
          }`}
        >
          <BookOpen className="h-4 w-4" /> {lang === 'ru' ? 'Словарь' : 'Dictionary'}
        </button>
        <button
          type="button"
          onClick={() => setView('fa')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            view === 'fa'
              ? 'bg-panel2 font-medium text-fg'
              : 'text-mut hover:text-fg'
          }`}
        >
          <Tag className="h-4 w-4" /> {lang === 'ru' ? 'Опции' : 'Options'}
        </button>
      </div>

      <div className="ml-2 flex items-center gap-2">
        {(view === 'coding' || view === 'prg') && (
          <Btn
            onClick={() => docInput.current?.click()}
            icon={<FolderOpen className="h-4 w-4" />}
            label={t(lang, 'open')}
          />
        )}
        {view === 'coding' && (
          <>
            <div className="mx-1 h-6 w-px bg-panel2" />
            <Btn
              onClick={() => void saveTrc()}
              icon={<Save className="h-4 w-4" />}
              label={t(lang, 'saveTrc')}
              disabled={!doc}
            />
            <Btn
              onClick={() => void exportMan()}
              icon={<FileDown className="h-4 w-4" />}
              label={t(lang, 'exportMan')}
              variant="primary"
              disabled={!doc}
            />
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFaqOpen(true)}
          title="FAQ"
          className="rounded-lg p-2 text-mut transition-colors hover:bg-panel2 hover:text-fg"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          title={lang === 'ru' ? 'Language' : 'Язык'}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-2.5 py-1.5 text-sm font-medium text-fg2 transition-colors hover:bg-panel2 hover:text-fg"
        >
          <Languages className="h-4 w-4 text-blue-500" />
          {lang === 'ru' ? 'RU' : 'EN'}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          className="rounded-lg p-2 text-mut transition-colors hover:bg-panel2 hover:text-fg"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title={t(lang, 'settings')}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg2 transition-colors hover:bg-panel2 hover:text-fg"
        >
          <Settings className="h-4 w-4" />
          {translations && (
            <span className="rounded-full bg-emerald-500/15 px-1.5 text-xs text-emerald-600">
              {translations.size}
            </span>
          )}
        </button>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      <input
        ref={docInput}
        type="file"
        accept=".trc,.man,.txt,.prg"
        className="hidden"
        onChange={(e) => void onDocPicked(e)}
      />
    </header>
  )
}
