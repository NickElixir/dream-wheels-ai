"""Версии и точность нормализованных значений CompatibilityEngine.

ET оценивается только против интервала, переданного Wheel Size. В engine нет
локальных ET bands или «безопасных» допусков: такой вывод требует отдельного
авторитетного профиля и выходит за пределы V1.
"""

# v2 records the frozen Standard V1 ruleset correction: ET outside the exact
# provider interval is unknown, and fastener/load rules are excluded from
# Standard execution. `TOLERANCES_VERSION` is persisted as `rules_version` by
# the existing check API, so both identifiers are deliberately bumped.
TOLERANCES_VERSION = "v2"
ENGINE_VERSION = "v2"

PCD_TOL_MM = 0.1
CB_TOL_MM = 0.1

DIAMETER_TOL_IN = 0.1
WIDTH_TOL_IN = 0.1
