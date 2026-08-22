"""Версии и точность нормализованных значений CompatibilityEngine.

ET оценивается только против интервала, переданного Wheel Size. В engine нет
локальных ET bands или «безопасных» допусков: такой вывод требует отдельного
авторитетного профиля и выходит за пределы V1.
"""

TOLERANCES_VERSION = "v1"
ENGINE_VERSION = "v1"

PCD_TOL_MM = 0.1
CB_TOL_MM = 0.1

DIAMETER_TOL_IN = 0.1
WIDTH_TOL_IN = 0.1
