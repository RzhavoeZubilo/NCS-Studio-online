/** FAQ content, EN/RU. */

export interface FaqItem {
  q: { en: string; ru: string }
  a: { en: string; ru: string }
}

export const FAQ: FaqItem[] = [
  {
    q: { en: 'What is this tool?', ru: 'Что это за инструмент?' },
    a: {
      en: 'A browser-based coding companion for BMW E-series (E81–E93, incl. E60/E70 relatives): FSW/PSW trace editor (NCS Dummy role), EDIABAS job viewer (Tool32 role) and a full SP-Daten option tree. Everything is parsed locally — files never leave your computer.',
      ru: 'Браузерный помощник кодирования BMW E-серии (E81–E93, включая родню E60/E70): редактор трасс FSW/PSW (роль NCS Dummy), просмотр джобов EDIABAS (роль Tool32) и полное дерево опций SP-Daten. Всё парсится локально — файлы не покидают компьютер.',
    },
  },
  {
    q: { en: 'Is it safe for my car?', ru: 'Это безопасно для машины?' },
    a: {
      en: 'Working with files is completely safe — the car is not touched. Car connection (reading VIN/FA and reading codings via a K+DCAN cable and Web Serial) is planned next; writing codings will come after that and deserves extra care.',
      ru: 'Работа с файлами полностью безопасна — машина не затрагивается. Связь с машиной (чтение VIN/FA и кодировок через кабель K+DCAN и Web Serial) — следующий этап; запись кодировок появится после и потребует особого внимания.',
    },
  },
  {
    q: { en: 'Where do I get SP-Daten and Translations.csv?', ru: 'Где взять SP-Daten и Translations.csv?' },
    a: {
      en: 'SP-Daten sets (e.g. SP-Daten 69.0) are widely shared by the community — point the Modules view at a chassis folder (E89 covers E81–E93). Translations.csv ships with NCS Dummy; import it in Settings. The database stores locally in your browser.',
      ru: 'Наборы SP-Daten (например, SP-Daten 69.0) распространяются сообществом — укажите режиму Modules папку кузова (E89 покрывает E81–E93). Translations.csv идёт в комплекте с NCS Dummy; импортируйте его в Настройках. База хранится локально в браузере.',
    },
  },
  {
    q: { en: 'What does INDEX mean (e.g. INDEX 32)?', ru: 'Что означает INDEX (например, INDEX 32)?' },
    a: {
      en: 'The coding index selects the SGBD variant of a module: RAD22.C32 is coding index 0x32. When a module is read from the car, its reported index tells the tool which .Cxx file describes it. The index is repeated inside the file (SGID_CODIERINDEX).',
      ru: 'Индекс кодировки выбирает вариант SGBD модуля: RAD22.C32 — это индекс 0x32. Когда модуль прочитан из машины, сообщённый индекс указывает, какой .Cxx-файл его описывает. Индекс продублирован внутри файла (SGID_CODIERINDEX).',
    },
  },
  {
    q: { en: 'Why are some values not translated?', ru: 'Почему часть значений без перевода?' },
    a: {
      en: 'Values like 000, 10_kanal or 105ah_agm are technical constants — they are their own meaning. Function names are covered ~100% by the community database (revtor). Russian descriptions can be added in the Dictionary view and exported as a shareable CSV.',
      ru: 'Значения вида 000, 10_kanal, 105ah_agm — технические константы, они сами себе смысл. Имена функций покрыты базой сообщества (revtor) практически полностью. Русские описания можно добавлять в режиме «Словарь» и экспортировать в CSV.',
    },
  },
  {
    q: { en: 'How does NCS Expert know which module is which?', ru: 'Как NCS Expert понимает, какой блок где?' },
    a: {
      en: 'The FA (vehicle order) read from the CAS describes the built equipment as SA option codes. On the bus, every address is probed, and each answering ECU reports its coding index — that index selects the SGBD variant file (RAD22.C32 = index 0x32) whose description tables list every function and value. In this app the same matching runs automatically: an open trace is compared with all modules by shared function names, and the best match (shown as a percentage) provides the possible values for each option.',
      ru: 'FA (комплектация), прочитанная из CAS, описывает оборудование кодами SA. На шине опрашивается каждый адрес, и ответивший блок сообщает свой кодировочный индекс — индекс выбирает файл варианта SGBD (RAD22.C32 = индекс 0x32), таблицы которого описывают все функции и значения. Здесь то же самое работает автоматически: открытая трасса сравнивается со всеми модулями по совпадению имён функций, лучший матч (процент в тулбаре) даёт возможные значения каждой опции.',
    },
  },
  {
    q: { en: 'The bus scan logged a fault in my car. Is that bad?', ru: 'После скана в машине всплыла ошибка. Это плохо?' },
    a: {
      en: 'During a bus scan the tool opens a diagnostic session on every address from the assignment table. Some ECUs (steering, airbag) log a non-critical diagnostic event when that happens from an unknown tester. It does not affect operation and is cleared with a normal fault-code read/clear (the upcoming Fehler loeschen button will do it too).',
      ru: 'При скане шины инструмент открывает диагностическую сессию на каждый адрес из таблицы. Некоторые блоки (рейка, airbag) фиксируют некритичное диагностическое событие от неизвестного тестера. На работу это не влияет; ошибка стирается штатным чтением/очисткой ошибок (будущая кнопка Fehler loeschen тоже это сделает).',
    },
  },
  {
    q: { en: 'Can I use my own translations?', ru: 'Можно ли использовать свои переводы?' },
    a: {
      en: 'Yes. Settings imports any Translations.csv-compatible file as the base database, and the Dictionary view imports/exports a Russian overlay CSV (name;description). Your data stays in your browser.',
      ru: 'Да. В Настройках импортируется любой файл формата Translations.csv как базовая база, а в режиме «Словарь» импортируется/экспортируется русский оверлей CSV (имя;описание). Данные остаются в вашем браузере.',
    },
  },
]
