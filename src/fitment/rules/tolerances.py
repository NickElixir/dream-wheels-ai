"""Версионируемые допуски rule engine.

Числа менять ТОЛЬКО вместе с TOLERANCES_VERSION: версия пишется в каждый
вердикт, без неё нельзя сравнивать результаты между релизами.

Обоснование значений (индустриальные ориентиры, см.
docs/fitment-verdict-pipeline-implementation-guide.md §6.4):
- bolt pattern: только точное совпадение;
- center bore: меньше ступицы — не сядет; больше — центровочные кольца;
- ET: |dET| <= 5 безопасно; наружу (меньше ET) допустимо больше, чем внутрь
  (больше ET, к подвеске); |dET| > 25 — трактуем как несовместимость.
"""

TOLERANCES_VERSION = "v1"
ENGINE_VERSION = "v1"

PCD_TOL_MM = 0.1
CB_TOL_MM = 0.1

ET_OK_BAND_MM = 5.0
ET_INWARD_MAX_MM = 5.0  # ET выше OEM (колесо к подвеске) сверх OK-полосы
ET_OUTWARD_MAX_MM = 15.0  # ET ниже OEM (колесо наружу, к арке)
ET_HARD_LIMIT_MM = 25.0

DIAMETER_TOL_IN = 0.1
WIDTH_TOL_IN = 0.1
DIAMETER_PLUS_MINUS_IN = 1.0  # ±1" от approved → условие, дальше — несовместимо
WIDTH_CONDITION_IN = 1.0
