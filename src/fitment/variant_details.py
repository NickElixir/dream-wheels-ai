"""Optional Wheel-Size presentation snapshot, independent of selection identity."""

import math

from pydantic import BaseModel, Field, field_validator, model_serializer


class VariantDisplayDetails(BaseModel):
    production_year_from: int | None = None
    production_year_to: int | None = None
    engine_code: str | None = None
    engine_capacity_l: float | None = None
    engine_type: str | None = None
    power_kw: float | None = None
    power_hp: float | None = None
    power_ps: float | None = None
    fuel_code: str | None = None
    electrification_level: str | None = None
    trim_attributes: list[str] = Field(default_factory=list)
    trim_body_types: list[str] = Field(default_factory=list)

    @model_serializer(mode="wrap")
    def omit_unavailable_details(self, handler):
        data = handler(self)
        for key in VariantDisplayDetails.model_fields:
            if data.get(key) is None or data.get(key) == []:
                data.pop(key, None)
        return data

    @field_validator(
        "engine_code", "engine_type", "fuel_code", "electrification_level", mode="before"
    )
    @classmethod
    def optional_text(cls, value: object) -> str | None:
        return value.strip() or None if isinstance(value, str) else None

    @field_validator("engine_capacity_l", "power_kw", "power_hp", "power_ps", mode="before")
    @classmethod
    def optional_number(cls, value: object) -> float | None:
        if isinstance(value, bool) or not isinstance(value, str | int | float):
            return None
        try:
            parsed = float(value)
        except (ValueError, OverflowError):
            return None
        return parsed if math.isfinite(parsed) and parsed > 0 else None

    @field_validator("production_year_from", "production_year_to", mode="before")
    @classmethod
    def optional_year(cls, value: object) -> int | None:
        parsed = cls.optional_number(value)
        return int(parsed) if parsed and parsed.is_integer() and 1886 <= parsed <= 2200 else None

    @field_validator("trim_attributes", "trim_body_types", mode="before")
    @classmethod
    def optional_list(cls, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        return list(dict.fromkeys(x.strip() for x in value if isinstance(x, str) and x.strip()))


def wheel_size_display_details(raw: dict) -> dict:
    engine = raw.get("engine")
    engine = engine if isinstance(engine, dict) else {}
    power = engine.get("power")
    power = power if isinstance(power, dict) else {}
    powertrain = raw.get("powertrain")
    powertrain = powertrain if isinstance(powertrain, dict) else {}
    fuel = powertrain.get("primary_fuel")
    fuel = fuel if isinstance(fuel, dict) else {}
    return VariantDisplayDetails(
        production_year_from=raw.get("start_year"),
        production_year_to=raw.get("end_year"),
        engine_code=engine.get("code"),
        engine_capacity_l=engine.get("capacity"),
        engine_type=engine.get("type"),
        power_kw=power.get("kW"),
        power_hp=power.get("hp"),
        power_ps=power.get("PS"),
        fuel_code=fuel.get("code"),
        electrification_level=powertrain.get("electrification_level"),
        trim_attributes=raw.get("trim_attributes"),
        trim_body_types=raw.get("trim_body_types"),
    ).model_dump()
