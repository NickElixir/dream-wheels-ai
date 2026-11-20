# Предложение: VLM QA и один корректирующий проход

Статус: идея зафиксирована; не реализована, вызовы не разрешены этим документом.
Выполнять после исследования новых генераторов, не смешивать два эксперимента.

## Pipeline

1. Генератор получает original car + конкретный product reference.
2. VLM получает original, reference, result и одинаковые front/rear crops.
3. Ответ: PASS / FAIL / UNCERTAIN и структурированные наблюдаемые дефекты.
4. PASS — принять. Исправимый FAIL — ровно один корректирующий generation.
   UNCERTAIN / неисправимый FAIL — отклонение или human review, не уверенный pass.
5. Повторная VLM проверка: только оценка, без третьего prompt/generation.
   Новый контекст с original/reference; не показывать прежний диагноз как подсказку.
6. Финальный FAIL/UNCERTAIN — не выдавать как точную визуализацию товара.

Если второе изображение хуже первого, нельзя предпочесть его только потому,
что оно последнее. Первый результат тоже должен независимо проходить P0 gates.

## Структура оценки

Разделить replacement completeness, product identity, car/camera preservation,
installation geometry и photorealism. Для каждого колеса: spoke count/grouping,
split nodes, hub/lip connections, width, openings, center, finish, видимость.
Невидимое = N/A/UNCERTAIN, не PASS. Оценка должна ссылаться на видимые расхождения,
не придумывать скрытые конструктивные детали.

Diagnosis JSON -> фиксированный corrective prompt template. Не свободная
перегенерация всей сцены. VLM не должна менять обязательные preservation clauses.
Дополнительный original как третий input второго generation — отдельный вариант:
если давать только draft+reference, возможен накопительный drift.

## Главный риск и валидация

VLM может уверенно одобрить визуально похожий, но конструктивно неверный дизайн.
До автономного использования измерить false acceptance против human labels.
Нужны сложные negatives: близкий SKU с другой развилкой, неверный spoke count,
неизменённый factory rim, изменённый кузов, плохой ракурс и неоднозначные мелкие детали.
Согласованность двух прогонов одной VLM не равна независимому подтверждению.

Сравнить при сопоставимом бюджете:
- один generation;
- два независимых generation + selection;
- generation -> VLM diagnosis -> repair -> independent final QA.

Метрики: human-accepted rate, false acceptance/rejection, uncertainty rate,
repair success, introduced defects, outside preservation, полный p50/p95 latency,
стоимость принятого результата со всеми VLM/crop tokens и failed attempts.
Порог false acceptance, coverage и latency согласовать ДО эксперимента.

Стоимость: C_gen + C_QA1 + p_repair*(C_gen2 + C_QA2).
Нельзя использовать теоретическую независимость ошибок вместо измерений.
Генератор и VLM могут иметь коррелированные ошибки восприятия.

## Production ограничения

Один repair максимум, лимит полного бюджета, durable task IDs, idempotency,
safe logs, no automatic paid resubmit при uncertain submission.
QA отклоняет дефекты, но не гарантирует геометрию и не заменяет точный 3D/warp.
Новые VLM, compositing и user-facing flow — отдельный design/approval/PR.
