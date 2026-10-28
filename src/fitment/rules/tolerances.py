"""Версии и точность нормализованных значений CompatibilityEngine.

ET оценивается только против интервала, переданного Wheel Size. В engine нет
локальных ET bands или «безопасных» допусков: такой вывод требует отдельного
авторитетного профиля и выходит за пределы V1.
"""

# v3 records the verdict-evidence correction: an ET outside a confirmed
# provider interval is a verdict issue, not a missing rim field. The persisted
# rules version makes existing checks lazily recompute that presentation from
# their saved provider profile without another provider request.
TOLERANCES_VERSION = "v3"
ENGINE_VERSION = "v2"

PCD_TOL_MM = 0.1
CB_TOL_MM = 0.1

DIAMETER_TOL_IN = 0.1
WIDTH_TOL_IN = 0.1
