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
      en: 'SP-Daten sets (e.g. “BMW SP-Daten 74”) are widely shared by the community. Download and unpack the set, then choose its folder as it is with the SP-Daten button in the top bar — no EDIABAS or NCS Expert installation is needed. The app finds the chassis folders inside (E89 covers E81–E93; switch the chassis next to the button), reads only the coding data and the ECU table and never touches the firmware. Translations.csv ships with NCS Dummy and is optional; import it in Settings. Everything stays in your browser.',
      ru: 'Наборы SP-Daten (например, «BMW SP-Daten 74») распространяются сообществом. Скачайте и распакуйте набор, затем выберите его папку как есть кнопкой SP-Daten в верхней панели — устанавливать EDIABAS или NCS Expert не нужно. Приложение само найдёт внутри папки кузовов (E89 покрывает E81–E93, кузов переключается рядом с кнопкой), прочитает только данные кодировки и таблицу блоков и не трогает прошивки. Translations.csv идёт в комплекте с NCS Dummy и необязателен; импортируется в Настройках. Всё хранится в вашем браузере.',
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
      en: 'Values like 000, 10_kanal or 105ah_agm are technical constants — they are their own meaning. Function names are covered ~100% by the community database (revtor). Russian descriptions can be added in Tools → Translation dictionary and exported as a shareable CSV.',
      ru: 'Значения вида 000, 10_kanal, 105ah_agm — технические константы, они сами себе смысл. Имена функций покрыты базой сообщества (revtor) практически полностью. Русские описания можно добавлять в «Инструменты → Словарь переводов» и экспортировать в CSV.',
    },
  },
  {
    q: { en: 'How does NCS Expert know which module is which?', ru: 'Как NCS Expert понимает, какой блок где?' },
    a: {
      en: 'The FA (vehicle order) read from the CAS describes the built equipment as SA option codes. On the bus, every address is probed, and each answering ECU reports its coding index — that index selects the SGBD variant file (RAD22.C32 = index 0x32) whose description tables list every function and value. In this app the same matching runs automatically: an open trace is compared with all modules by shared function names, and the best match (shown as a percentage in the ECU header) provides the possible values for each option.',
      ru: 'FA (комплектация), прочитанная из CAS, описывает оборудование кодами SA. На шине опрашивается каждый адрес, и ответивший блок сообщает свой кодировочный индекс — индекс выбирает файл варианта SGBD (RAD22.C32 = индекс 0x32), таблицы которого описывают все функции и значения. Здесь то же самое работает автоматически: открытая трасса сравнивается со всеми модулями по совпадению имён функций, лучший матч (процент в шапке блока) даёт возможные значения каждой опции.',
    },
  },
  {
    q: { en: 'The bus scan logged a fault in my car. Is that bad?', ru: 'После скана в машине всплыла ошибка. Это плохо?' },
    a: {
      en: 'The bus scan only sends TesterPresent (3E 01) to each address and reads the identification (1A 80) of the ECUs that answer; it opens no diagnostic session, so it should not log faults. Versions before this fix requested the programming session (10 85), which made some ECUs (steering, airbag) log a diagnostic event. Such an entry does not affect operation and is cleared with a normal fault-code read/clear.',
      ru: 'Скан шины посылает на каждый адрес только TesterPresent (3E 01) и читает идентификацию (1A 80) ответивших блоков; диагностическую сессию он не открывает, поэтому ошибок оставлять не должен. Версии до этого исправления запрашивали сессию программирования (10 85), из-за чего некоторые блоки (рейка, airbag) записывали диагностическое событие. На работу такая запись не влияет и стирается штатным чтением/очисткой ошибок.',
    },
  },
  {
    q: { en: 'Can I use my own translations?', ru: 'Можно ли использовать свои переводы?' },
    a: {
      en: 'Yes. Settings imports any Translations.csv-compatible file as the base database, and Tools → Translation dictionary imports/exports a Russian overlay CSV (name;description). Your data stays in your browser.',
      ru: 'Да. В Настройках импортируется любой файл формата Translations.csv как базовая база, а в «Инструменты → Словарь переводов» импортируется/экспортируется русский оверлей CSV (имя;описание). Данные остаются в вашем браузере.',
    },
  },
]
