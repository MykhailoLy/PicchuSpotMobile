# PicchuSpot Mobile — аудит проекта и план выпуска

Дата: **22 сентября 2026**. Версия: 1.0, предложение для review владельцем.
Репозиторий: `MykhailoLy/PicchuSpotMobile`.
Проверенный baseline `main`: `37f9895807f6aeb73a60e1d2831608f454bab076` (после PR #20).

Связанный документ: [рынок, продукт и бюджет](02-market-and-budget.md).

## 1. Главный вывод

**Продолжать разработку разумно как мобильного входа в услуги PicchuSpot. Публично выпускать текущее приложение рано.** Готова полезная Android-основа локальной съёмки; исследовательский Balanced и compatibility probe работают в development-сборке на одном физическом S25 Ultra. Готового коммерческого цикла, production Balanced и доказанной переносимости на другие телефоны пока нет.

Не следует оценивать прогресс процентом строк кода или числом закрытых PR. Следующий бизнес-результат — оплаченный и повторённый заказ из мобильного процесса; следующий инженерный результат — воспроизводимый безопасный capture/import → сохранение → отправка без потери данных.

Предложение аудита: вести два ограниченных направления. **Коммерческий пилот Quick/import** не должен ждать идеального HDR-движка. **Balanced R&D** продолжается за отдельным флагом и не объявляется готовым клиентским режимом. Это изменение приоритета предлагается на согласование, не реализуется данным документом.

## 2. Основание и границы проверки

Проверены дерево репозитория, AGENTS, README, product/capture architecture, competitor reference, package/app configuration, локальные SQLite/filesystem helpers, Quick hook, compatibility UI/evaluator и участки native collector. Проверены состояние `main`, отсутствие открытых PR до этого аудита и открытый Issue #18. История завершённых этапов сопоставлена с имеющимися отчётами в разговоре и evidence-документами.

Три разных уровня уверенности:

- **Код:** реализация видна в pinned baseline.
- **Документированный тест:** предыдущий физический прогон описан в evidence/PR; в этом аудите не повторялся.
- **Рекомендация/риск:** вывод статического review либо предлагаемый следующий шаг; не выдаётся за воспроизведённый дефект на всех устройствах.

В этом аудите НЕ выполнялись Gradle/Xcode сборки, новый npm audit, тесты на телефоне, penetration test, аудит секретов всей git-истории, полный аудит production web/backend и бухгалтерская сверка подписок. Нельзя переносить зелёные проверки прежнего PR на будущий код. Число «11 moderate» из старых логов не является текущим результатом security audit.

Перед аудитом единственный открытый рабочий issue — **#18**. Его реализация merged, но внешняя device matrix не завершена. Оставить issue открытым. Данный документ не разрешает менять production-системы и не является merge approval.

## 3. Инвентаризация: что действительно сделано

| Область | Состояние | Что уже есть | Что это ещё не доказывает |
| --- | --- | --- | --- |
| Идентичность / development build | Код + Android evidence | `PicchuSpot`, `com.picchuspot.app`, `picchuspot`; CNG; USB/Metro workflow | Подписанный store-релиз, автономная beta без Metro |
| Shoots / import | Код + Android evidence | Создание, список, cover/count, повторное открытие, переименование, multi-import | Работа с сотнями объектов, low-storage, все форматы/Android/iOS |
| Локальные данные | Код + Android evidence | SQLite `shoots`/`shoot_assets`, WAL, FK, exclusive transactions; owned document files | Атомарность между БД и файловой системой при process kill |
| Удаление | Код + Android evidence | Ограничение shoot-owned путями, rollback обработанных ошибок; оригиналы Gallery не удаляются | Crash recovery между удалением строк и файлов |
| Quick | Код + Android evidence | Один rear-camera JPEG, shutter lock, grid, zoom/reset, count/thumbnail, permissions | Равное качество штатной камере, production quality на любом телефоне |
| Ориентация Quick | Документированный физический тест | Portrait 3:4 / оба landscape 4:3; upright JPEG; Done/Back возвращают Gallery в portrait | Полная iOS-проверка и все устройства |
| Camera2 diagnostics | Debug-only код + S25 evidence | Capabilities, physical IDs, EV/ISO/shutter, sensors, manual probes | Универсальные lens mapping / motion threshold |
| Balanced prototype | Debug-only код + S25 evidence | Реальная native preview, full-resolution JPEG sets, AE/manual comparison, metrics | Готовый HDR, безопасные CaptureSet в пользовательском Shoot |
| Bracket policy | Исследованный кандидат | Manual burst, 3 кадра `-2/0/+2`, временный positive-EV cap ~1/30 s, ISO redistribution | Финальный диапазон качества/шумов/смаза и policy для других устройств |
| Compatibility | Debug-only код + S25 evidence | Static inventory, runtime burst, JSON, FULL/LIMITED/UNSUPPORTED, inert release stubs | Device certification или физическая проверка всех false-negative paths |
| Orders / Account | Навигация/заготовки | Точки входа; dev harness в Account | Мобильные auth, order submission, checkout, выдача результата |
| iOS | Конфигурация | Bundle identifier и общая RN-основа | Сборка и физическая parity, AVFoundation Balanced |
| Автотесты / CI | Пробел | Ручные команды и документированные локальные проверки | В дереве baseline нет workflow/test suite; package scripts не содержат test |

Этапы истории: локальная база PR #2/#4; development build #6; Quick #8; refactor #10; Camera2 #12; orientation #14; Balanced #16; policy #19; compatibility #20. Это история работ, а не счётчик готовности к рынку.

### Как правильно читать измерения

В Issue #17 A P2 handheld manual bursts: **521.1 / 514.8 / 492.9 ms**. B P2: **642.6 / 647.4 / 654.9 ms**. Примерный payload — 19–20 MB против 31–32 MB. Это аргумент за более экономный трёхкадровый кандидат, но не доказательство превосходства готового изображения.

`AE baseline total` и `Manual captureBurst` — разные интервалы. Полный эксперимент, включающий подготовку, baseline, обработку метрик и интерфейс, отдельным total не сохранён. Нельзя обещать клиенту «съёмка за полсекунды» по одной native-метрике.

Новые compatibility runs дали 945.213 и 1,227.798 ms. Условия и instrumented path отличаются; данных недостаточно, чтобы объявлять это регрессией или нормой для production. Нужна отдельная метрика shutter tap → все источники надёжно сохранены и UI Ready.

В серии «dim» baseline оставался около 19.983 ms, ISO 34–74. Это ограниченная тёмная сцена, а не доказанный high-ISO stress test. JPEG luma/gradient proxies не измеряют истинный dynamic range, ghosting или perceptual sharpness. Обозначение raw/source exposures не означает, что файлы имеют формат RAW/DNG: в этих экспериментах сохранялись JPEG.

## 4. Реестр рисков и конкретных исправлений

Приоритет **P1** — до соответствующего следующего gate, а не утверждение о production-инциденте. **P2** — до масштабирования/публичного выпуска.

### A01 — P1, запуск compatibility до выбора камеры

**Видно в коде:** `balanced-compatibility-probe.tsx` начинает с `cameraId='0'`; кнопка static inspection заблокирована, пока preview не Ready. Native inventory вызывается через active preview. Поэтому устройство с неподходящим/неоткрываемым ID 0 может не добраться до выбора другой, пригодной камеры. Также отрицательный static результат блокирует runtime-кнопку, через которую формируется итоговый отчёт.

**Действие:** inventory независимо от успешной preview; сначала перечислить/выбрать камеру, затем открыть её. Получать сохраняемый отчёт и при no-camera, static fail, permission denial, open/session failure. Не объявлять transient camera contention постоянной аппаратной несовместимостью. Не менять Quick ради diagnostic UX.

**Приёмка:** fixture с rear ID не `0`; ID 0 не подходит, другой проходит; no-rear; permission denied; static fail без зависания и без попытки запрещённого burst.

### A02 — P1, преждевременный fallback при pairing

**Видно в коде:** `FrameCollector.pairAvailableImages()` при отсутствии точного timestamp забирает первый pending image. Позже правильная пара может прийти, но ранняя связь уже установлена. Probe отвергает `delivery-order-fallback`, что защищает FULL от такого результата, однако может выдавать ложный LIMITED при иной последовательности callbacks.

**Действие:** хранить results/images по детерминированным ключам и ждать соответствия до bounded timeout; не «угадывать» пару по очереди. Корректно заканчивать abort, включая result-present/image-missing, сохранять диагностику незавершённого набора.

**Приёмка:** images-before-results, results-before-images, перемешанная доставка, duplicate/missing timestamp, пропавший image, late callback после abort; ни один файл не привязывается к чужому запросу. Это алгоритмические тесты, для них не нужны десять телефонов.

### A03 — P1, FULL проверяет исполнение запроса, но не достижение всей цели EV

**Видно в коде:** evaluator проверяет candidate labels, размер/байты, association и requested-versus-actual shutter/ISO в пределах 5%. Не проверяет отдельно достижимость реальной экспозиционной разницы после ограничения диапазона/ISO. Точно исполненный, но сильно обрезанный planner request может пройти как FULL.

**Действие:** разделить «запрос выполнен» и «кандидатный bracket обеспечен». Сохранять baseline, planned/actual EV estimate, unmet EV, причину clamp. Проверять конечные положительные значения, реальные размеры, уникальные пары/кадры и фактически применённый cap. Допуски объявить экспериментальными, не придумать новый quality score. При ограничении — явный reduced/limited reason.

**Приёмка:** узкие exposure/ISO ranges, насыщение ISO, отсутствующие/NaN metadata, collapse трёх EV в одинаковые controls не создают ложный FULL.

### A04 — P1, fixed-focus и необязательные capabilities

Static contract допускает fixed-focus, но baseline engine использует AF stability/lock logic. Нужно проверить согласованность этой ветки с supported AF modes и состоянием INACTIVE. Пока нет документированного отдельного fixed-focus устройства. Аналогично отсутствие AWB lock не равно доказанной устойчивости цвета, хотя сейчас оно не static blocker.

**Действие:** режимы выбираются из capabilities, fixed-focus не должен ждать autofocus, которого нет. Разделить metadata отсутствует / не поддерживается / ошибка чтения. FULL — только исполнение конкретного engineering contract, не обещание качества. Сохранить capability-first; редкие model-specific workarounds допускать лишь для воспроизведённого HAL-дефекта с тестом и областью версии, не строить основной путь на allowlist.

### A05 — P1, целостность evidence и очистка

В UI cache clear доступен независимо от capture busy; native cleanup не использует общий capture lock. Ошибки записи JSON подавляются, поэтому UI result не гарантирует сохранённый отчёт. При чистке экспериментов были удалены сотни MB исходников; Markdown сохраняет избранные числа, но это не полный воспроизводимый архив.

**Действие:** busy guards на native/UI, явный `reportPersisted`/write error, атомарная запись отчёта, run ID + app commit + contract version + firmware + timestamps. Перед очисткой экспортировать компактные JSON; фото архивировать выборочно локально с согласия, не заливать клиентские интерьеры в публичный Git. Статус latest должен показывать возраст/ID, не скрывать возврат к старому валидному файлу.

### A06 — P1, локальная надёжность до пользовательских Balanced/массовых заказов

SQLite и filesystem операции координируются обработчиками ошибок, но транзакция SQLite не охватывает внешние файлы. Process kill между copy и DB commit способен оставить orphan; между metadata deletion и file deletion — иной разрыв. Это статический риск, не доказанная потеря уже снятого фото в текущем тесте.

**Действие:** утвердить versioned migration и state machine `capturing → sources_pending → sources_complete → ready / interrupted / failed`; восстанавливаемый manifest не должен становиться параллельной метабазой вопреки AGENTS. Предпочтительно SQLite journal/state + owned files. Старые Quick/import rows мигрируют без потери ID/порядка. Не начинать отдельно «shoot-owned draft JSON database» без architectural approval.

Тесты: kill на каждом шаге, disk full, copy/DB/delete failure, corrupted file, повторный запуск, 50–100 фото, импорт HEIC/JPEG/PNG при фактической поддержке, удаление только своих файлов, дубликат команды. Удаление приложения не считается сценарным обещанием сохранности локальной съёмки: нужна явная backup/sync policy.

### A07 — P1, автоматизация и review gate

В baseline нет tracked CI/workflow или test suite; `main` прочитан как unprotected. Ручные lint/tsc/build полезны, но не заменяют regression tests. Возможности защиты private repo зависят от GitHub тарифа и должны быть проверены перед настройкой.

Добавить по отдельному approved PR: unit tests planner/pairing/classification/ownership, test fixtures для negative paths, `npm ci`/lint/typecheck/test workflow, Android module compile для native изменений, ограниченный release gate и обязательный independent review важных путей. Отдельный reproducible Windows build helper должен выставлять cwd/JDK/temp только в процессе и сохранять логи. Не просить владельца бесконечно копировать одну Gradle-команду.

### A08 — P1, переносимый внутренний APK и первые внешние устройства

Сейчас development build обычно использует Metro; обычный release содержит inert diagnostics. Следовательно, «передать release APK в remote lab» не тестирует probe. Нужен отдельно утверждённый internal QA variant с embedded JS и нужными debug tools либо документированный безопасный remote ADB/Metro доступ. QA APK не должен иметь production secrets и попадать в публичный store.

До широкой матрицы исправить A01–A05. Начать с локального S25 + одного среднего Samsung + одного не-Samsung реального аппарата, а не устанавливать обязательную квоту десятка покупок. Эмуляторы — UI/permissions/lifecycle; camera optics, AF/AWB, timing и качество — физические устройства. Lab с закрытой/подменённой камерой не может доказать photo-quality. UNKNOWN timestamp domain допускает pairing в одной camera timebase, но не разрешает слепо вычитать camera time из другого clock domain.

### A09 — P1, коммерческий и store-контракт

До auth/upload/checkout перечитать актуальный web/backend. У нас нет доказанного native token/draft/quote/upload/finalize контракта, несмотря на существующий сайт. Зафиксировать ownership, серверную цену, versioning, upload authorization, idempotency, webhook-confirmed payment, retry, user/account switching и legal consent. Встраивание Stripe/web checkout не считать автоматически разрешённым магазином; нужен SKU/storefront policy review. См. бюджетный документ.

### A10 — P2, product/release и документация

README недостаточно отражает debug R&D; `product-architecture.md` всё ещё содержит старое предупреждение WIP о двух metadata stores. Icons/splash config содержит Expo-шаблонные цвета/assets. Отдельно запланировать актуальный docs index, EN/ES, accessibility/font scaling/contrast, store screenshots/description/support/privacy URL, signing ownership, AAB/TestFlight, release versioning, dependency/license audit, crash reporting без фото/адресов/токенов. Никакое SDK обновление или `npm audit fix --force` в рамках этого документа не разрешено.

## 5. Дорожная карта по проверяемым результатам

| Gate | Работа | Условие выхода | Чего не делать |
| --- | --- | --- | --- |
| G0 — воспроизводимость | A01–A05, минимальные fixtures, build helper, сохранение JSON | Любая конфигурация выдаёт понятный report, ошибочные пары/EV не получают FULL | Новые camera modes |
| G1 — внешняя проверка | Internal QA build; #18 local + разные hardware families | Собранные JSON и actual pass/limited/error reasons; known gaps отдельно | Покупать парк телефонов; называть один S25 Android coverage |
| G2 — iOS checkpoint | Mac/Xcode, Quick/import/SQLite/orientation на доступных iPhone | Реальная native сборка и parity; native Balanced только отдельный spike | Откладывать iOS до финального Android продукта |
| G3 — локальная надёжность | Миграции, recovery/ownership, storage UX, Photo/CaptureSet дизайн | Restart/kill/failure тесты; одна видимая Photo на набор; старые данные целы | Сразу включать debug prototype в release |
| G4 — вертикальный коммерческий сценарий | Quick/import → выбор фото → одна услуга → инструкции → existing server draft/quote/upload → заказ | Один реальный тестовый заказ без ручного переноса данных, без duplicate charge | Параллельный backend или native прайс-калькулятор |
| G5 — результат и повтор | Статус, доставка, before/after, исправления, повторный заказ | Клиент самостоятельно получает результат и делает следующий заказ | Сложные community/social функции |
| G6 — закрытая beta | Несколько агентов/фотографов, реальные объекты, support и privacy | Нулевые невосстановимые потери в тестовой выборке, контролируемая стоимость/повторы | Массовая реклама до повторного использования |
| G7 — публичный release | Store payment/legal review, signing, crash/performance, policy, phased rollout | Все launch blockers закрыты и есть пользовательские результаты | Обещать поддержку неподтверждённого Balanced |

Balanced развивается параллельно G3–G6: production native core → interruption-safe persistence → quality comparison с stock-camera/import + редактор → camera UI/level → 0.6x/lens evidence → ограниченное включение. Pro/RAW/собственное HDR слияние не входят автоматически в MVP.

### Условные сроки — не обещание

Планировочный сценарий: один основной исполнитель с AI, 25–35 продуктивных часов в неделю, владелец доступен для решений/физических тестов, существующий backend пригоден для безопасного переиспользования. Тогда узкий Android Quick/import закрытый коммерческий пилот — ориентир **6–10 недель**, ограниченный публичный Android+iOS релиз — **12–20 недель**. При обязательном production Balanced в первом релизе нужен отдельный пересчёт после recovery/quality/cross-device gates. В эти сроки не следует механически суммировать параллельные строки; внешние store/account ожидания и неопределённый backend могут сдвинуть календарь.

Оценки уточнять каждые две недели по фактически закрытым acceptance criteria и затраченным часам. AI сокращает время написания кода, но не устраняет quality review, повторные съёмки, чужие HAL и ожидания магазинов. Работа без остановки не заменяет измерения.

## 6. Что фиксировать в каждом следующем PR

Baseline/head/contract version; одна цель; source files и защищённые контракты; positive и negative tests; реальные команды и логи; device model/API/firmware; capture-stage vs end-to-end timings; JSON location/hash; что не тестировалось; rollback и migration; отсутствие production секретов в QA build; явное отсутствие merge.

Минимальный release checklist: auth isolation, signed uploads, retries/idempotency, interrupted recovery, low storage, deletion scope, permissions limited/denied, cold start без Metro, background/foreground, rotated camera, account switch/logout, offline order draft, delivered-file ownership, accessibility, privacy/store copy и billing rules.

## 7. Неизвестные данные, необходимые для следующего бюджета/решения

Точные активные подписки и счета; планы Vercel/Supabase; формат developer accounts; доступные Mac/iPhone OS; платёжные storefront/страны; месячные объёмы и средний чек; среднее время обработки/правок; цена исполнителя/API; retention policy; target audience и уже согласившиеся beta users. До получения этих данных смета остаётся сценарной, а потенциал — гипотезой, не оценкой стоимости компании.

## 8. Исходники аудита

Все repo ссылки привязаны к baseline, поэтому будущие изменения не переписывают основание выводов.

- [AGENTS / boundaries](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/AGENTS.md)
- [README](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/README.md)
- [Product architecture](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/docs/product-architecture.md)
- [Capture model](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/docs/capture-model.md)
- [Package/scripts](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/package.json)
- [Native app config](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/app.json)
- [SQLite](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/src/lib/local-shoots.ts)
- [Filesystem](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/src/lib/local-files.ts)
- [Quick hook](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/src/features/camera/use-quick-capture.ts)
- [Compatibility UI](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/src/app/balanced-compatibility-probe.tsx)
- [Native collector / planner](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/modules/PicchuSpotBalancedPrototype/android/src/debug/java/expo/modules/picchuspotbalancedprototype/BalancedCapturePreview.kt)
- [Runtime evaluator](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/modules/PicchuSpotBalancedPrototype/android/src/debug/java/expo/modules/picchuspotbalancedprototype/BalancedCompatibilityProbe.kt)
- [Bracket evidence](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/docs/camera/android-balanced-bracket-policy.md)
- [Compatibility evidence](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/docs/camera/android-balanced-compatibility-contract.md)
- [Camera2 evidence](https://github.com/MykhailoLy/PicchuSpotMobile/blob/37f9895807f6aeb73a60e1d2831608f454bab076/docs/camera/android-s25-ultra-camera2-capabilities.md)
- [Expo Android APK distribution](https://docs.expo.dev/build-reference/apk/) — external reference checked 2026-09-22.
