# PicchuSpot Mobile — аудит 2026-09-22

Baseline: `37f9895807f6aeb73a60e1d2831608f454bab076`.

1. [Текущая готовность, реестр рисков A01–A10, дорожная карта G0–G7](01-project-audit.md)
2. [Рынок, приоритеты функций, экономика и бюджет](02-market-and-budget.md)

Статус: **предложение для review**. Документы различают проверенный код, ранее документированные device tests, актуальные публичные источники и сценарные оценки. Это не новое физическое испытание, не security certification и не утверждённый pricing.

Предлагаемый ближайший маршрут: исправить diagnostic bootstrap/pairing/negative paths; подготовить воспроизводимые тесты и internal QA build; продолжить внешнюю device matrix в Issue #18. Параллельно провести ранний iOS Quick checkpoint и подготовить узкий Quick/import → заказ → результат пилот. Production Balanced, backend/payment изменения и новые подписки требуют отдельных решений.

Issue #18 остаётся открытым. Этот docs-only PR не разрешает merge, не включает код, не меняет production-системы и не закрывает cross-device acceptance.
