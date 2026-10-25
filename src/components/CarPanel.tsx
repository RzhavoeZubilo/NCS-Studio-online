import { Cable, PlugZap, Search, Square, Unplug } from 'lucide-react'
import { useStore } from '@/state/store'

const btn =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-fg2 transition-colors hover:bg-panel2 hover:text-fg disabled:pointer-events-none disabled:opacity-40'

function hexAddr(a: number): string {
  return '0x' + a.toString(16).toUpperCase().padStart(2, '0')
}

export function CarPanel() {
  const lang = useStore((s) => s.lang)
  const connected = useStore((s) => s.carConnected)
  const adapter = useStore((s) => s.carAdapter)
  const scanning = useStore((s) => s.carScanning)
  const progress = useStore((s) => s.carScanProgress)
  const found = useStore((s) => s.carFound)
  const carError = useStore((s) => s.carError)
  const connectCar = useStore((s) => s.connectCar)
  const disconnectCar = useStore((s) => s.disconnectCar)
  const scanCar = useStore((s) => s.scanCar)
  const cancelScan = useStore((s) => s.cancelScan)
  const carVin = useStore((s) => s.carVin)
  const readingVin = useStore((s) => s.readingVin)
  const readVin = useStore((s) => s.readVin)
  const setCarOnlyModules = useStore((s) => s.setCarOnlyModules)
  const selectSpDatenModule = useStore((s) => s.selectSpDatenModule)
  const spDaten = useStore((s) => s.spDaten)

  return (
    <div className="border-b border-line bg-panel/40 px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-faint">
          <Cable className="h-4 w-4" />
          {lang === 'ru' ? 'Автомобиль' : 'Car'}
        </span>

        {!connected ? (
          <button type="button" onClick={() => void connectCar()} className={btn}>
            <PlugZap className="h-4 w-4 text-blue-500" />
            {lang === 'ru' ? 'Подключить кабель' : 'Connect cable'}
          </button>
        ) : (
          <>
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600">
              {lang === 'ru' ? 'Подключено' : 'Connected'}
            </span>
            {adapter?.kind === 'smart' && (
              <span className="rounded-md bg-panel2 px-2 py-0.5 text-xs text-mut">
                {lang === 'ru' ? 'умный адаптер' : 'smart adapter'}
                {adapter.info.type !== undefined ? ` · type ${adapter.info.type}` : ''}
              </span>
            )}
            {adapter?.kind === 'dumb' && (
              <span className="rounded-md bg-panel2 px-2 py-0.5 text-xs text-mut">
                {lang === 'ru' ? 'прямой COM-порт' : 'direct COM port'}
              </span>
            )}
            {adapter?.info.voltage !== undefined && (
              <span className="rounded-md bg-panel2 px-2 py-0.5 text-xs text-mut">
                {adapter.info.voltage.toFixed(1)} V
              </span>
            )}
            {adapter?.info.ignition !== undefined && (
              <span className="rounded-md bg-panel2 px-2 py-0.5 text-xs text-mut">
                {lang === 'ru' ? 'зажигание' : 'ignition'}: {hexAddr(adapter.info.ignition)}
              </span>
            )}
            {scanning ? (
              <button type="button" onClick={cancelScan} className={btn}>
                <Square className="h-3.5 w-3.5" /> {lang === 'ru' ? 'Стоп' : 'Stop'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const ok = confirm(
                    lang === 'ru'
                      ? 'Скан откроет диагностическую сессию на каждый адрес шины. Некоторые блоки могут зафиксировать некритичное диагностическое событие (стирается штатно).\n\nУбедитесь: машина стоит, зажигание включено, двигатель заглушен. Продолжить?'
                      : 'The scan opens a diagnostic session on every bus address. Some ECUs may log a non-critical diagnostic event (clearable later).\n\nMake sure the car is parked, ignition on, engine off. Continue?',
                  )
                  if (ok) void scanCar()
                }}
                className={btn}
              >
                <Search className="h-4 w-4" />
                {lang === 'ru' ? 'Сканировать шину' : 'Scan bus'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void readVin()}
              disabled={readingVin}
              className={btn}
              title={lang === 'ru' ? 'VIN из CAS (22 F1 90)' : 'VIN from CAS (22 F1 90)'}
            >
              {readingVin
                ? lang === 'ru'
                  ? 'Чтение VIN…'
                  : 'Reading VIN…'
                : lang === 'ru'
                  ? 'Считать VIN'
                  : 'Read VIN'}
            </button>
            {carVin && (
              <span className="rounded-md bg-sel px-2 py-0.5 font-mono text-xs text-fg">{carVin}</span>
            )}
            <button type="button" onClick={() => void disconnectCar()} className={btn} title={lang === 'ru' ? 'Отключить' : 'Disconnect'}>
              <Unplug className="h-4 w-4" />
            </button>
          </>
        )}

        {scanning && progress && (
          <span className="text-xs text-mut">
            {lang === 'ru' ? 'Сканирование' : 'Scanning'}: {progress.done}/{progress.total}
            {progress.found.length > 0 && (
              <span className="text-emerald-600">
                {' '}
                · {lang === 'ru' ? 'найдено' : 'found'}: {progress.found.length}
              </span>
            )}
          </span>
        )}
        {!scanning && found.length > 0 && (
          <span className="text-xs text-emerald-600">
            {lang === 'ru' ? `Найдено блоков: ${found.length}` : `Found ${found.length} ECUs`}
          </span>
        )}

        {carError && <span className="text-xs text-amber-600">{carError}</span>}

        {found.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {found.map((ecu) => {
              const entries = useStore.getState().spDaten?.ecuByAddress.get(ecu.address)
              const label =
                entries && entries.length > 0
                  ? `${hexAddr(ecu.address)} · ${entries[0].name}${entries[0].baureihe ? ` (${entries[0].baureihe})` : ''}`
                  : hexAddr(ecu.address)
              const title =
                entries && entries.length > 0
                  ? entries.map((e) => `${e.name} — ${e.sgbd} [${e.baureihe}]`).join('\n')
                  : (lang === 'ru' ? 'Ответ: ' : 'Response: ') +
                    ecu.response.map((b) => b.toString(16).padStart(2, '0')).join(' ')
              const openModule = () => {
                if (!ecu.variantFile || !spDaten) return
                if (spDaten.modules.some((m) => m.fileName === ecu.variantFile)) {
                  selectSpDatenModule(ecu.variantFile)
                  setCarOnlyModules(true)
                }
              }
              return (
                <button
                  key={ecu.address}
                  type="button"
                  onClick={openModule}
                  title={title}
                  className={`whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-xs transition-colors ${
                    ecu.variantFile
                      ? 'border-blue-600 bg-sel text-fg hover:border-blue-500'
                      : 'border-line bg-panel text-fg hover:bg-panel2'
                  }`}
                >
                  {label}
                  {ecu.variantFile && <span className="ml-1.5 text-blue-500">{ecu.variantFile}</span>}
                  {ecu.sgbdIndex && <span className="ml-1.5 text-faint2">[{ecu.sgbdIndex}]</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
