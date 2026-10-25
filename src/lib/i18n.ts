/**
 * Minimal two-language UI dictionary (EN/RU). Parameter translations are a
 * separate concept — they come from the loaded Translations.csv database.
 */

export type Lang = 'en' | 'ru'

const DICT = {
  // Header
  coding: ['Coding', 'Кодирование'],
  ecuJobs: ['ECU Jobs', 'Джобы ЭБУ'],
  modules: ['Modules', 'Модули'],
  open: ['Open', 'Открыть'],
  saveTrc: ['Save .trc', 'Сохранить .trc'],
  exportMan: ['Export .man', 'Экспорт .man'],
  settings: ['Settings', 'Настройки'],

  // Toolbar
  searchPlaceholder: ['Search name, value, translation…', 'Поиск по имени, значению, переводу…'],
  changedOnly: ['Changed only', 'Только изменённые'],
  ofOptions: ['options', 'опций'],
  changed: ['changed', 'изменено'],

  // Empty states
  openCodingFile: ['Open an FSW/PSW coding file', 'Откройте файл кодирования FSW/PSW'],
  dropTrc: [
    'Drop a .trc / .man file anywhere in this window, or browse.',
    'Перетащите .trc / .man в любое место окна или выберите файлом.',
  ],
  chooseFile: ['Choose file', 'Выбрать файл'],
  translationsTip: [
    'Russian parameter names use the built-in BMW term dictionary; add your own in the Dictionary view.',
    'Русские описания параметров — встроенный словарь терминов BMW; свои дополнения — в режиме «Словарь».',
  ],
  openPrgFile: ['Open an EDIABAS .prg file', 'Откройте EDIABAS .prg файл'],
  dropPrg: [
    'Drop files from EDIABAS\\Ecu anywhere in this window, or browse.',
    'Перетащите файлы из EDIABAS\\Ecu в любое место окна или выберите файлами.',
  ],
  openSpDaten: ['Open an SP-Daten chassis folder', 'Откройте папку кузова SP-Daten'],
  spDatenHint: [
    'Pick the chassis folder (e.g. E89) — its daten\\ subfolder holds all module codings.',
    'Выберите папку кузова (например E89) — подпапка daten\\ содержит кодировки всех модулей.',
  ],
  openFolder: ['Open folder', 'Открыть папку'],
  chooseFiles: ['Choose files', 'Выбрать файлы'],
  localOnly: [
    'Everything is parsed locally in your browser.',
    'Всё парсится локально в вашем браузере.',
  ],
  chooseFilesHint: [
    '“Choose files”: select all files inside daten\\ (Ctrl+A).',
    '«Выбрать файлы»: выделите все файлы внутри daten\\ (Ctrl+A).',
  ],

  // Coding table
  name: ['Name', 'Имя'],
  value: ['Value', 'Значение'],
  translation: ['Translation', 'Перевод'],
  values: ['Values', 'Значения'],
  quickSet: ['Quick set', 'Быстрый выбор'],
  addValue: ['Add value…', 'Добавить значение…'],
  removeValue: ['Remove value', 'Удалить значение'],
  revertChanges: ['Revert changes', 'Отменить правки'],
  revertAll: ['Revert all', 'Отменить все'],
  original: ['Original', 'Оригинал'],
  modified: ['modified', 'изменено'],
  changes: ['Changes', 'Правки'],

  // PRG view
  loadedEcus: ['Loaded ECUs', 'Загруженные ЭБУ'],
  addPrg: ['Add .prg', 'Добавить .prg'],
  jobs: ['Jobs', 'Джобы'],
  tables: ['Tables', 'Таблицы'],
  searchJobs: ['Search jobs…', 'Поиск джобов…'],
  disassembly: ['BEST/1 disassembly', 'Дизассемблер BEST/1'],
  instructions: ['instructions', 'инструкций'],
  selectJob: ['Select a job to view its bytecode', 'Выберите джобу, чтобы посмотреть байткод'],
  selectTable: ['Select a table to view its contents', 'Выберите таблицу, чтобы посмотреть данные'],
  rows: ['rows', 'строк'],
  cols: ['cols', 'колонок'],

  // Modules view
  modulesCount: ['Modules', 'Модули'],
  filterModules: ['Filter modules or functions…', 'Фильтр модулей или функций…'],
  functions: ['functions', 'функций'],
  searchFunctions: ['Search functions…', 'Поиск функций…'],
  noValues: ['no values', 'нет значений'],
  selectModule: ['Select a module', 'Выберите модуль'],

  // Status bar
  noFileOpen: ['No file open', 'Файл не открыт'],
  nettodataRecords: ['Nettodata records', 'Nettodata-записей'],
  translationsNotLoaded: ['Translations not loaded', 'База переводов не загружена'],
  entries: ['entries', 'записей'],
  translationsDbShort: ['Translations DB', 'База переводов'],
  fromCache: ['from cache', 'из кэша'],

  // Settings
  interfaceLanguage: ['Interface language', 'Язык интерфейса'],
  parameterTranslations: ['Parameter translations', 'Переводы параметров'],
  showTranslations: ['Show English names (revtor database)', 'Показывать английские имена (база revtor)'],
  translationsDb: ['Translations database', 'База переводов'],
  dbNotLoaded: ['Not loaded', 'Не загружена'],
  importFile: ['Import Translations.csv', 'Импортировать Translations.csv'],
  clearDb: ['Clear', 'Очистить'],
  dbStoredLocally: [
    'Stored locally in your browser, never bundled or uploaded.',
    'Хранится локально в браузере, не входит в приложение и никуда не отправляется.',
  ],

  // Drop overlay / toasts
  dropToOpen: ['Drop .trc / .man / .prg to open', 'Бросьте .trc / .man / .prg, чтобы открыть'],
  translationsLoaded: ['Translations loaded', 'База переводов загружена'],
  translationsCleared: ['Translations database cleared', 'База переводов очищена'],
  manExported: ['Exported .man (CRLF, tab-indented)', 'Экспортировано .man (CRLF, табуляция)'],
  trcSaved: ['.trc saved', '.trc сохранён'],
} as const

export type StringKey = keyof typeof DICT

export function t(lang: Lang, key: StringKey): string {
  const entry = DICT[key]
  return (lang === 'ru' ? entry[1] : entry[0]) ?? entry[0]
}
