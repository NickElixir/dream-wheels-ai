"""Deterministic extraction of rim products and variants from web documents."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any

_SPACE_RE = re.compile(r"\s+")
_KEY_RE = re.compile(r"[^a-z0-9]+")
_MARKING_SIZE_RE = re.compile(
    r"(?P<width>\d{1,2}(?:[.,]\d)?)\s*J?\s*[xх×]\s*(?P<diameter>\d{2})\b",
    re.IGNORECASE,
)
_MARKING_ET_RE = re.compile(r"\bET\s*(?P<et>-?\d{1,3})\b", re.IGNORECASE)
_MARKING_PCD_RE = re.compile(
    r"\b(?P<count>[4-6])\s*[xх×*/]\s*(?P<pcd>\d{2,3}(?:[.,]\d+)?)\b",
    re.IGNORECASE,
)
_MARKING_BORE_RE = re.compile(
    r"\b(?:CB|DIA|D)\s*[:=]?\s*(?P<bore>\d{2,3}(?:[.,]\d+)?)\b",
    re.IGNORECASE,
)
_VISIBLE_FIELD_PATTERNS = {
    "brand": re.compile(
        r"\b(?:brand|manufacturer|бренд|производитель)\s*[:\-]\s*([^\n|;]{2,80})", re.I
    ),
    "model": re.compile(r"\b(?:model|модель)\s*[:\-]\s*([^\n|;]{2,120})", re.I),
    "sku": re.compile(
        r"\b(?:sku|артикул|part\s*(?:no|number))\s*[:#\-]\s*([A-Z0-9._/ -]{2,64})",
        re.I,
    ),
}
_TECHNICAL_FIELDS = (
    "bolt_count",
    "pcd_mm",
    "center_bore_mm",
    "wheel_diameter_in",
    "wheel_width_j",
    "offset_et_mm",
)
_EMBEDDED_JSON_IDS = {
    "__next_data__",
    "__nuxt_data__",
    "__apollo_state__",
    "__redux_state__",
    "__initial_state__",
}
_PRODUCT_KEYS = {
    "product",
    "currentproduct",
    "productdata",
    "productdetail",
    "productdetails",
    "pdp",
}
_VARIANT_KEYS = {
    "variants",
    "productvariants",
    "skus",
}
_BRAND_KEYS = ("brand", "manufacturer", "vendor", "make")
_MODEL_KEYS = ("model", "modelname", "productname", "design")
_SKU_KEYS = ("sku", "mpn", "productid", "partnumber", "article", "code")
_URL_KEYS = ("url", "producturl", "canonicalurl")
_PARENT_KEYS = (
    "productgroupid",
    "parentsku",
    "parentid",
    "groupid",
    "variantof",
    "isvariantof",
)
_DIRECT_TECHNICAL_KEYS: dict[str, tuple[str, ...]] = {
    "bolt_count": ("boltcount", "holes", "holecount", "lugcount"),
    "pcd_mm": ("pcd", "pcdmm", "boltcircle", "boltpatternpcd"),
    "center_bore_mm": ("centerbore", "centerboremm", "centrebore", "hubbore", "dia"),
    "wheel_diameter_in": ("diameter", "diameterin", "rimdiameter", "wheeldiameter"),
    "wheel_width_j": ("width", "widthj", "rimwidth", "wheelwidth"),
    "offset_et_mm": ("offset", "offsetet", "offsetetmm", "et"),
}
_LABEL_ALIASES = {
    "brand": ("бренд", "производитель", "brand", "manufacturer"),
    "model": ("модель", "дизайн", "model", "design"),
    "sku": ("артикул", "код товара", "sku", "article", "part number"),
    "wheel_diameter_in": (
        "диаметр",
        "диаметр диска",
        "посадочный диаметр",
        "rim diameter",
    ),
    "wheel_width_j": ("ширина", "ширина диска", "rim width"),
    "pcd_mm": (
        "pcd",
        "сверловка",
        "разболтовка",
        "крепёж",
        "крепеж",
        "диаметр расположения отверстий",
    ),
    "bolt_count": ("количество отверстий", "крепежных отверстий", "lug count"),
    "offset_et_mm": ("et", "вылет", "вылет диска", "вылет (et)", "offset"),
    "center_bore_mm": (
        "dia",
        "цо",
        "центральное отверстие",
        "диаметр центрального отверстия",
        "диаметр центрального отверстия (dia)",
        "center bore",
    ),
}
_VOID_ELEMENTS = {"meta", "link", "img", "input", "br", "hr", "source", "wbr"}
_TECHNICAL_RANGES: dict[str, tuple[float, float]] = {
    "bolt_count": (3, 10),
    "pcd_mm": (70, 300),
    "center_bore_mm": (30, 300),
    "wheel_diameter_in": (10, 30),
    "wheel_width_j": (3, 20),
    "offset_et_mm": (-150, 200),
}


@dataclass(frozen=True, slots=True)
class ExtractedCandidate:
    field: str
    value: str | int | float
    source: str
    confidence: float
    raw_value: str | None = None
    source_url: str | None = None
    raw_label: str | None = None


@dataclass(frozen=True, slots=True)
class ExtractedVariant:
    candidates: tuple[ExtractedCandidate, ...]
    relation_sources: tuple[str, ...]
    parent_ids: tuple[str, ...] = ()
    source_url: str | None = None


@dataclass(frozen=True, slots=True)
class ExtractedPage:
    candidates: tuple[ExtractedCandidate, ...]
    variants: tuple[ExtractedVariant, ...] = ()
    product_group_ids: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class _ParsedMarking:
    bolt_count: int | None = None
    pcd_mm: float | None = None
    center_bore_mm: float | None = None
    wheel_diameter_in: float | None = None
    wheel_width_j: float | None = None
    offset_et_mm: float | None = None


@dataclass(slots=True)
class _HtmlNode:
    tag: str
    attributes: dict[str, str]
    children: list[_HtmlNode | str]


class _ProductHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.json_ld_blocks: list[str] = []
        self.embedded_json_blocks: list[tuple[str, str]] = []
        self.script_blocks: list[str] = []
        self.meta: list[tuple[str, str]] = []
        self.visible_parts: list[str] = []
        self.title_parts: list[str] = []
        self.root = _HtmlNode("document", {}, [])
        self._nodes = [self.root]
        self._script_kind: str | None = None
        self._script_source = "embedded_json"
        self._script_parts: list[str] = []
        self._ignored_depth = 0
        self._title_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {key.lower(): value or "" for key, value in attrs}
        node = _HtmlNode(tag, attributes, [])
        self._nodes[-1].children.append(node)
        if tag not in {"meta", "link", "img", "input", "br", "hr", "source", "wbr"}:
            self._nodes.append(node)
        if tag == "script":
            script_type = attributes.get("type", "").split(";", 1)[0].strip().lower()
            script_id = attributes.get("id", "").strip().lower()
            if script_type == "application/ld+json":
                self._script_kind = "json_ld"
            elif script_type == "application/json" or script_id in _EMBEDDED_JSON_IDS:
                self._script_kind = "embedded_json"
                self._script_source = script_id or "embedded_json"
            else:
                self._script_kind = "script"
            self._script_parts = []
        elif tag in {"style", "noscript", "template"}:
            self._ignored_depth += 1
        elif tag == "title":
            self._title_depth += 1
        elif tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            content = attributes.get("content")
            if key and content:
                self.meta.append((key.lower(), content))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "script":
            block = "".join(self._script_parts).strip()
            if block and self._script_kind == "json_ld":
                self.json_ld_blocks.append(block)
            elif block and self._script_kind == "embedded_json":
                self.embedded_json_blocks.append((self._script_source, block))
            elif block and self._script_kind == "script":
                self.script_blocks.append(block)
            self._script_kind = None
            self._script_source = "embedded_json"
            self._script_parts = []
        elif tag in {"style", "noscript", "template"} and self._ignored_depth:
            self._ignored_depth -= 1
        elif tag == "title" and self._title_depth:
            self._title_depth -= 1
        for index in range(len(self._nodes) - 1, 0, -1):
            if self._nodes[index].tag == tag:
                del self._nodes[index:]
                break

    def handle_data(self, data: str) -> None:
        if self._script_kind:
            self._script_parts.append(data)
        elif self._title_depth:
            self.title_parts.append(data)
            self._nodes[-1].children.append(data)
        elif not self._ignored_depth:
            self.visible_parts.append(data)
            self._nodes[-1].children.append(data)


def _normalized_key(value: Any) -> str:
    return _KEY_RE.sub("", str(value).lower())


def _normalized_label(value: str) -> str:
    without_parenthetical_note = re.sub(r"\([^)]*\)", " ", value)
    without_units_separator = re.sub(r"[,;]", " ", without_parenthetical_note)
    return _SPACE_RE.sub(" ", without_units_separator.lower().replace("ё", "е")).strip(" :.-?")


def _clean_text(value: Any, *, max_length: int = 160) -> str | None:
    if not isinstance(value, str | int | float):
        return None
    cleaned = _SPACE_RE.sub(" ", str(value)).strip(" \t\r\n|")
    return cleaned[:max_length] if cleaned else None


def _clean_sku(value: Any) -> str | None:
    cleaned = _clean_text(value, max_length=64)
    if not cleaned:
        return None
    return re.sub(r"\s+", "-", cleaned).upper()


def _clean_identifier(value: Any) -> str | None:
    if isinstance(value, dict):
        value = (
            value.get("productGroupID") or value.get("sku") or value.get("@id") or value.get("id")
        )
    return _clean_text(value, max_length=160)


def _mapping_by_normalized_key(value: dict[str, Any]) -> dict[str, Any]:
    return {_normalized_key(key): item for key, item in value.items()}


def _first_value(mapping: dict[str, Any], aliases: tuple[str, ...]) -> Any:
    for key in aliases:
        if key in mapping and mapping[key] not in (None, ""):
            return mapping[key]
    return None


def _scalar_brand(value: Any) -> Any:
    if isinstance(value, dict):
        normalized = _mapping_by_normalized_key(value)
        return _first_value(normalized, ("name", "brand", "manufacturer"))
    return value


def _float_value(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    if not isinstance(value, str):
        return None
    match = re.search(r"-?\d+(?:[.,]\d+)?", value)
    return float(match.group().replace(",", ".")) if match else None


def _int_value(value: Any) -> int | None:
    number = _float_value(value)
    if number is None or not number.is_integer():
        return None
    return int(number)


def _add_candidate(
    candidates: list[ExtractedCandidate],
    field: str,
    value: Any,
    source: str,
    confidence: float,
    *,
    source_url: str | None = None,
    raw_label: str | None = None,
) -> None:
    normalized = _clean_sku(value) if field == "sku" else _clean_text(value)
    if normalized is not None:
        candidates.append(
            ExtractedCandidate(
                field,
                normalized,
                source,
                confidence,
                raw_value=_clean_text(value, max_length=500),
                source_url=source_url,
                raw_label=raw_label,
            )
        )


def _add_numeric_candidate(
    candidates: list[ExtractedCandidate],
    field: str,
    value: Any,
    source: str,
    confidence: float,
    *,
    source_url: str | None = None,
    raw_label: str | None = None,
) -> None:
    normalized: int | float | None
    normalized = _int_value(value) if field == "bolt_count" else _float_value(value)
    limits = _TECHNICAL_RANGES.get(field)
    if normalized is not None and (limits is None or limits[0] <= normalized <= limits[1]):
        candidates.append(
            ExtractedCandidate(
                field,
                normalized,
                source,
                confidence,
                raw_value=_clean_text(value, max_length=500),
                source_url=source_url,
                raw_label=raw_label,
            )
        )


def _parse_marking(text: str) -> _ParsedMarking:
    size = _MARKING_SIZE_RE.search(text)
    pcd_text = text
    if size:
        pcd_text = text[: size.start()] + " " + text[size.end() :]
    pcd = _MARKING_PCD_RE.search(pcd_text)
    offset = _MARKING_ET_RE.search(text)
    bore = _MARKING_BORE_RE.search(text)

    def number(match: re.Match[str] | None, group: str) -> float | None:
        return float(match[group].replace(",", ".")) if match else None

    return _ParsedMarking(
        bolt_count=int(pcd["count"]) if pcd else None,
        pcd_mm=number(pcd, "pcd"),
        center_bore_mm=number(bore, "bore"),
        wheel_diameter_in=number(size, "diameter"),
        wheel_width_j=number(size, "width"),
        offset_et_mm=number(offset, "et"),
    )


def _add_marking_candidates(
    candidates: list[ExtractedCandidate],
    text: str,
    source: str,
    confidence: float,
    *,
    source_url: str | None = None,
    raw_label: str | None = None,
) -> None:
    spec = _parse_marking(text)
    for field_name in _TECHNICAL_FIELDS:
        value = getattr(spec, field_name)
        limits = _TECHNICAL_RANGES.get(field_name)
        if value is not None and (limits is None or limits[0] <= value <= limits[1]):
            candidates.append(
                ExtractedCandidate(
                    field_name,
                    value,
                    source,
                    confidence,
                    raw_value=_clean_text(text, max_length=500),
                    source_url=source_url,
                    raw_label=raw_label,
                )
            )


def _field_for_label(label: str) -> str | None:
    normalized = _normalized_label(label)
    matches: list[tuple[int, str]] = []
    for field_name, aliases in _LABEL_ALIASES.items():
        for alias in aliases:
            normalized_alias = _normalized_label(alias)
            if normalized == normalized_alias or normalized.startswith(f"{normalized_alias} "):
                matches.append((len(normalized_alias), field_name))
    return max(matches, default=(0, None))[1]


def _add_specification_candidate(
    candidates: list[ExtractedCandidate],
    label: str,
    value: str,
    source: str,
    confidence: float,
) -> None:
    field_name = _field_for_label(label)
    if field_name is None:
        return
    if field_name in {"brand", "model", "sku"}:
        _add_candidate(
            candidates,
            field_name,
            value,
            source,
            confidence,
            raw_label=label,
        )
        return
    if field_name == "pcd_mm":
        _add_marking_candidates(
            candidates,
            f"PCD {value}",
            source,
            confidence,
            raw_label=label,
        )
        return
    _add_numeric_candidate(
        candidates,
        field_name,
        value,
        source,
        confidence,
        raw_label=label,
    )


def _node_text(node: _HtmlNode) -> str:
    parts: list[str] = []

    def visit(item: _HtmlNode | str) -> None:
        if isinstance(item, str):
            parts.append(item)
        else:
            for child in item.children:
                visit(child)

    visit(node)
    return _clean_text(" ".join(parts), max_length=4_000) or ""


def _walk_nodes(node: _HtmlNode) -> list[_HtmlNode]:
    nodes = [node]
    for child in node.children:
        if isinstance(child, _HtmlNode):
            nodes.extend(_walk_nodes(child))
    return nodes


def _descendants(node: _HtmlNode, tag: str) -> list[_HtmlNode]:
    return [item for item in _walk_nodes(node) if item.tag == tag]


def _is_product_scope(node: _HtmlNode) -> bool:
    item_type = node.attributes.get("itemtype", "").lower()
    class_or_id = " ".join(
        (node.attributes.get("class", ""), node.attributes.get("id", ""))
    ).lower()
    return "product" in item_type or any(
        marker in class_or_id
        for marker in ("product-page", "product-detail", "card-product", "product-card")
    )


def _is_noise_scope(node: _HtmlNode) -> bool:
    marker = " ".join((node.attributes.get("class", ""), node.attributes.get("id", ""))).lower()
    return any(
        token in marker for token in ("recommend", "similar", "related", "catalog", "filter")
    )


def _product_contexts(root: _HtmlNode) -> list[_HtmlNode]:
    contexts = [
        node for node in _walk_nodes(root) if _is_product_scope(node) and not _is_noise_scope(node)
    ]
    return contexts[:1] or [root]


def _extract_html_specifications(root: _HtmlNode) -> list[ExtractedCandidate]:
    candidates: list[ExtractedCandidate] = []
    contexts = _product_contexts(root)
    confidence = 0.94 if contexts[0] is not root else 0.76
    for context in contexts:
        for row in _descendants(context, "tr"):
            cells = [
                node
                for node in row.children
                if isinstance(node, _HtmlNode) and node.tag in {"td", "th"}
            ]
            if len(cells) == 2:
                _add_specification_candidate(
                    candidates,
                    _node_text(cells[0]),
                    _node_text(cells[1]),
                    "html_specifications",
                    confidence,
                )

        for definition_list in _descendants(context, "dl"):
            children = [node for node in definition_list.children if isinstance(node, _HtmlNode)]
            for index, node in enumerate(children[:-1]):
                if node.tag == "dt" and children[index + 1].tag == "dd":
                    _add_specification_candidate(
                        candidates,
                        _node_text(node),
                        _node_text(children[index + 1]),
                        "html_specifications",
                        confidence,
                    )

        for node in _walk_nodes(context):
            children = [child for child in node.children if isinstance(child, _HtmlNode)]
            child_text = [(child, _node_text(child)) for child in children]
            nonempty_children = [(child, text) for child, text in child_text if text]
            if len(nonempty_children) == 2:
                _, label = nonempty_children[0]
                _, value = nonempty_children[1]
                _add_specification_candidate(
                    candidates, label, value, "html_specifications", confidence
                )
            elif (
                len(nonempty_children) >= 4
                and len(nonempty_children) % 2 == 0
                and all(len(_walk_nodes(child)) <= 2 for child, _ in nonempty_children)
            ):
                sibling_pairs = [
                    (nonempty_children[index][1], nonempty_children[index + 1][1])
                    for index in range(0, len(nonempty_children), 2)
                ]
                labels = [_field_for_label(label) for label, _ in sibling_pairs]
                if sum(label is not None for label in labels) >= 2 and not any(
                    _field_for_label(value) is not None for _, value in sibling_pairs
                ):
                    for (label, value), field_name in zip(sibling_pairs, labels, strict=True):
                        if field_name is None:
                            continue
                        _add_specification_candidate(
                            candidates, label, value, "html_specifications", confidence
                        )
            if node.tag == "li":
                text = _node_text(node)
                if ":" in text:
                    label, value = text.split(":", 1)
                    _add_specification_candidate(
                        candidates, label, value, "html_specifications", confidence
                    )
    return candidates


def _microdata_value(node: _HtmlNode) -> str:
    for attribute in ("content", "value", "href", "src"):
        if value := node.attributes.get(attribute):
            return value
    return _node_text(node)


def _extract_microdata(root: _HtmlNode) -> list[ExtractedCandidate]:
    candidates: list[ExtractedCandidate] = []
    for scope in [
        node
        for node in _walk_nodes(root)
        if "product" in node.attributes.get("itemtype", "").lower()
    ]:
        values: dict[str, Any] = {}
        for node in _walk_nodes(scope):
            item_prop = node.attributes.get("itemprop")
            if not item_prop or node is scope:
                continue
            values[item_prop] = _microdata_value(node)
        if values:
            candidates.extend(_mapping_candidates(values, "microdata", 0.93))
            for label, value in values.items():
                if isinstance(value, str):
                    _add_specification_candidate(candidates, label, value, "microdata", 0.93)
            break
    return candidates


def _extract_nuxt_assignments(script_blocks: list[str]) -> list[ExtractedPage]:
    pages: list[ExtractedPage] = []
    for block in script_blocks:
        match = re.search(r"window\.__NUXT__\s*=\s*", block)
        if not match:
            continue
        try:
            value, _ = json.JSONDecoder().raw_decode(block[match.end() :].lstrip())
        except (json.JSONDecodeError, ValueError):
            continue
        pages.append(_extract_embedded_json(value, "nuxt_state"))
    return pages


def _extract_embedded_attribute_properties(root: _HtmlNode) -> list[ExtractedCandidate]:
    candidates: list[ExtractedCandidate] = []

    def visit(value: Any, *, depth: int = 0) -> None:
        if depth > 32:
            return
        if isinstance(value, list):
            for item in value:
                visit(item, depth=depth + 1)
            return
        if not isinstance(value, dict):
            return
        normalized = _mapping_by_normalized_key(value)
        label = _first_value(normalized, ("name", "label", "title"))
        raw_value = _first_value(normalized, ("value", "displayvalue"))
        if isinstance(label, str | int | float) and isinstance(raw_value, str | int | float):
            _add_specification_candidate(
                candidates,
                str(label),
                str(raw_value),
                "embedded_properties",
                0.88,
            )
        for child in value.values():
            visit(child, depth=depth + 1)

    for node in _walk_nodes(root):
        if _is_noise_scope(node):
            continue
        for attribute_name in ("data-props", "data-product", "data-state"):
            raw = node.attributes.get(attribute_name)
            if not raw:
                continue
            try:
                value = json.loads(raw)
            except json.JSONDecodeError:
                continue
            visit(value)
    return candidates


def _mapping_url(mapping: dict[str, Any]) -> str | None:
    normalized = _mapping_by_normalized_key(mapping)
    value = _first_value(normalized, _URL_KEYS)
    if isinstance(value, list):
        value = next((item for item in value if isinstance(item, str)), None)
    return _clean_text(value, max_length=2048)


def _mapping_candidates(
    mapping: dict[str, Any],
    source: str,
    confidence: float,
    *,
    inherited_brand: Any = None,
    inherited_model: Any = None,
) -> list[ExtractedCandidate]:
    normalized = _mapping_by_normalized_key(mapping)
    source_url = _mapping_url(mapping)
    candidates: list[ExtractedCandidate] = []
    brand = _scalar_brand(_first_value(normalized, _BRAND_KEYS)) or inherited_brand
    model = _first_value(normalized, _MODEL_KEYS) or inherited_model
    sku = _first_value(normalized, _SKU_KEYS)
    _add_candidate(candidates, "brand", brand, source, confidence, source_url=source_url)
    _add_candidate(candidates, "model", model, source, confidence, source_url=source_url)
    _add_candidate(candidates, "sku", sku, source, confidence, source_url=source_url)

    for field_name, aliases in _DIRECT_TECHNICAL_KEYS.items():
        value = _first_value(normalized, aliases)
        if value is None:
            continue
        if field_name == "pcd_mm" and isinstance(value, str) and re.search(r"[xх×]", value, re.I):
            _add_marking_candidates(
                candidates,
                value,
                source,
                confidence,
                source_url=source_url,
            )
        else:
            _add_numeric_candidate(
                candidates,
                field_name,
                value,
                source,
                confidence,
                source_url=source_url,
            )

    text_values = [
        str(value)
        for key, value in mapping.items()
        if _normalized_key(key)
        in {
            "name",
            "model",
            "description",
            "sku",
            "mpn",
            "size",
            "specification",
            "specifications",
            "attributes",
        }
        and isinstance(value, str | int | float)
    ]
    additional = mapping.get("additionalProperty") or mapping.get("additionalProperties")
    if isinstance(additional, list):
        for item in additional:
            if isinstance(item, dict):
                name = item.get("name") or item.get("propertyID") or ""
                value = item.get("value") or item.get("valueReference") or ""
                if isinstance(name, str | int | float) and isinstance(value, str | int | float):
                    text_values.append(f"{name}: {value}")
                    _add_specification_candidate(
                        candidates,
                        str(name),
                        str(value),
                        source,
                        min(confidence, 0.94),
                    )
    _add_marking_candidates(
        candidates,
        " ".join(text_values),
        source,
        min(confidence, 0.9),
        source_url=source_url,
    )
    return candidates


def _types(mapping: dict[str, Any]) -> set[str]:
    value = mapping.get("@type")
    values = value if isinstance(value, list) else [value]
    return {str(item).lower() for item in values if isinstance(item, str)}


def _typed_entities(
    value: Any,
    path: tuple[str, ...] = (),
    *,
    depth: int = 0,
) -> list[tuple[dict[str, Any], tuple[str, ...]]]:
    if depth > 64:
        return []
    entities: list[tuple[dict[str, Any], tuple[str, ...]]] = []
    if isinstance(value, dict):
        if _types(value) & {"product", "productgroup"}:
            entities.append((value, path))
        for key, item in value.items():
            entities.extend(
                _typed_entities(
                    item,
                    (*path, _normalized_key(key)),
                    depth=depth + 1,
                )
            )
    elif isinstance(value, list):
        for item in value:
            entities.extend(_typed_entities(item, path, depth=depth + 1))
    return entities


def _group_identifiers(mapping: dict[str, Any]) -> set[str]:
    normalized = _mapping_by_normalized_key(mapping)
    values = [
        mapping.get("@id"),
        _first_value(normalized, ("productgroupid", "sku", "id")),
    ]
    return {identifier for value in values if (identifier := _clean_identifier(value))}


def _parent_identifiers(mapping: dict[str, Any]) -> set[str]:
    normalized = _mapping_by_normalized_key(mapping)
    identifiers: set[str] = set()
    for key in _PARENT_KEYS:
        identifier = _clean_identifier(normalized.get(key))
        if identifier:
            identifiers.add(identifier)
    return identifiers


def _as_sequence(value: Any) -> list[Any]:
    return value if isinstance(value, list) else ([] if value is None else [value])


def _extract_json_ld(data: Any) -> ExtractedPage:
    entities = _typed_entities(data)
    entities_by_id = {
        identifier: item
        for item, _ in entities
        if (identifier := _clean_identifier(item.get("@id")))
    }
    groups = [(item, path) for item, path in entities if "productgroup" in _types(item)]
    products = [(item, path) for item, path in entities if "product" in _types(item)]
    candidates: list[ExtractedCandidate] = []
    variants: list[ExtractedVariant] = []
    group_ids: set[str] = set()

    if groups:
        group, _ = min(groups, key=lambda item: len(item[1]))
        group_ids = _group_identifiers(group)
        candidates.extend(_mapping_candidates(group, "json_ld_product_group", 0.98))
        normalized_group = _mapping_by_normalized_key(group)
        inherited_brand = _scalar_brand(_first_value(normalized_group, _BRAND_KEYS))
        inherited_model = _first_value(normalized_group, _MODEL_KEYS)
        for item in _as_sequence(group.get("hasVariant")):
            reference_id = _clean_identifier(item)
            if reference_id and reference_id in entities_by_id:
                item = entities_by_id[reference_id]
            if not isinstance(item, dict):
                continue
            parents = _parent_identifiers(item) | group_ids
            variants.append(
                ExtractedVariant(
                    candidates=tuple(
                        _mapping_candidates(
                            item,
                            "json_ld_variant",
                            0.98,
                            inherited_brand=inherited_brand,
                            inherited_model=inherited_model,
                        )
                    ),
                    relation_sources=("json_ld_has_variant",),
                    parent_ids=tuple(sorted(parents)),
                    source_url=_mapping_url(item),
                )
            )

        for product, path in products:
            if "hasvariant" in path:
                continue
            parents = _parent_identifiers(product)
            if not parents or (group_ids and parents.isdisjoint(group_ids)):
                continue
            relation = (
                "json_ld_is_variant_of"
                if "isVariantOf" in product or "isvariantof" in _mapping_by_normalized_key(product)
                else "json_ld_product_group_id"
            )
            variants.append(
                ExtractedVariant(
                    candidates=tuple(
                        _mapping_candidates(
                            product,
                            "json_ld_variant",
                            0.97,
                            inherited_brand=inherited_brand,
                            inherited_model=inherited_model,
                        )
                    ),
                    relation_sources=(relation,),
                    parent_ids=tuple(sorted(parents)),
                    source_url=_mapping_url(product),
                )
            )
    elif products:
        eligible = [
            item
            for item in products
            if "itemlistelement" not in item[1] and "recommendations" not in item[1]
        ]
        product, _ = min(eligible or products, key=lambda item: len(item[1]))
        candidates.extend(_mapping_candidates(product, "json_ld", 0.95))

    return ExtractedPage(tuple(candidates), tuple(variants), tuple(sorted(group_ids)))


def _looks_like_product(mapping: dict[str, Any]) -> bool:
    normalized = _mapping_by_normalized_key(mapping)
    has_identity = any(key in normalized for key in (*_BRAND_KEYS, *_MODEL_KEYS, *_SKU_KEYS))
    technical_keys = {key for aliases in _DIRECT_TECHNICAL_KEYS.values() for key in aliases}
    has_specs = any(key in normalized for key in technical_keys)
    return has_identity and (has_specs or any(key in normalized for key in _SKU_KEYS))


def _extract_embedded_json(data: Any, source: str) -> ExtractedPage:
    primary: list[ExtractedCandidate] = []
    variants: list[ExtractedVariant] = []
    group_ids: set[str] = set()

    def walk(
        value: Any,
        *,
        key: str = "",
        parent_product: dict[str, Any] | None = None,
        in_variant_list: bool = False,
        depth: int = 0,
    ) -> None:
        if depth > 64:
            return
        if isinstance(value, list):
            for item in value:
                walk(
                    item,
                    key=key,
                    parent_product=parent_product,
                    in_variant_list=in_variant_list,
                    depth=depth + 1,
                )
            return
        if not isinstance(value, dict):
            return

        normalized_key = _normalized_key(key)
        is_product_slot = normalized_key in _PRODUCT_KEYS
        is_variant_slot = in_variant_list or normalized_key in _VARIANT_KEYS
        looks_product = _looks_like_product(value)
        current_parent = parent_product

        if (is_product_slot or (not key and not primary and looks_product)) and not is_variant_slot:
            if not primary:
                primary.extend(_mapping_candidates(value, source, 0.9))
                group_ids.update(_group_identifiers(value))
            current_parent = value
        elif is_variant_slot and looks_product:
            parent_ids = _parent_identifiers(value)
            if current_parent:
                parent_ids.update(_group_identifiers(current_parent))
                parent_normalized = _mapping_by_normalized_key(current_parent)
                inherited_brand = _scalar_brand(_first_value(parent_normalized, _BRAND_KEYS))
                inherited_model = _first_value(parent_normalized, _MODEL_KEYS)
            else:
                inherited_brand = None
                inherited_model = None
            variants.append(
                ExtractedVariant(
                    candidates=tuple(
                        _mapping_candidates(
                            value,
                            f"{source}_variant",
                            0.9,
                            inherited_brand=inherited_brand,
                            inherited_model=inherited_model,
                        )
                    ),
                    relation_sources=(f"{source}_variants",),
                    parent_ids=tuple(sorted(parent_ids)),
                    source_url=_mapping_url(value),
                )
            )

        for child_key, item in value.items():
            child_normalized = _normalized_key(child_key)
            walk(
                item,
                key=child_key,
                parent_product=current_parent,
                in_variant_list=child_normalized in _VARIANT_KEYS,
                depth=depth + 1,
            )

    walk(data)
    return ExtractedPage(tuple(primary), tuple(variants), tuple(sorted(group_ids)))


def _merge_pages(pages: list[ExtractedPage]) -> ExtractedPage:
    candidates: list[ExtractedCandidate] = []
    variants: list[ExtractedVariant] = []
    group_ids: set[str] = set()
    for page in pages:
        candidates.extend(page.candidates)
        variants.extend(page.variants)
        group_ids.update(page.product_group_ids)
    return ExtractedPage(tuple(candidates), tuple(variants), tuple(sorted(group_ids)))


def _extract_json_text(text: str, source: str) -> ExtractedPage:
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, RecursionError, TypeError):
        return ExtractedPage(())
    json_ld = _extract_json_ld(data)
    if json_ld.candidates or json_ld.variants:
        return json_ld
    return _extract_embedded_json(data, source)


def extract_rim_document(content: str, *, content_type: str = "text/html") -> ExtractedPage:
    """Extract a primary product and semantically linked variants from HTML or JSON."""
    if content_type.split(";", 1)[0].strip().lower() == "application/json":
        return _extract_json_text(content, "json_api")

    parser = _ProductHtmlParser()
    parser.feed(content)
    structured_pages = [_extract_json_text(block, "json_ld") for block in parser.json_ld_blocks]
    structured_pages.extend(
        _extract_json_text(block, source) for source, block in parser.embedded_json_blocks
    )
    structured_pages.extend(_extract_nuxt_assignments(parser.script_blocks))
    structured = _merge_pages(structured_pages)
    candidates = list(structured.candidates)
    candidates.extend(_extract_microdata(parser.root))
    candidates.extend(_extract_html_specifications(parser.root))
    candidates.extend(_extract_embedded_attribute_properties(parser.root))

    meta = dict(parser.meta)
    _add_candidate(
        candidates,
        "brand",
        meta.get("product:brand") or meta.get("og:brand"),
        "opengraph",
        0.8,
    )
    _add_candidate(
        candidates,
        "sku",
        meta.get("product:retailer_item_id") or meta.get("product:sku"),
        "opengraph",
        0.8,
    )
    meta_text = " ".join(
        value
        for key, value in parser.meta
        if key in {"og:title", "og:description", "product:description"}
    )
    _add_marking_candidates(candidates, meta_text, "opengraph", 0.75)

    contexts = _product_contexts(parser.root)
    if contexts[0] is parser.root:
        visible_text = "\n".join(
            part
            for part in (_clean_text(value, max_length=20_000) for value in parser.visible_parts)
            if part
        )
    else:
        visible_text = "\n".join(_node_text(context) for context in contexts)
    for field_name, pattern in _VISIBLE_FIELD_PATTERNS.items():
        match = pattern.search(visible_text)
        if match:
            _add_candidate(candidates, field_name, match.group(1), "visible_text", 0.65)
    _add_marking_candidates(candidates, visible_text, "visible_text", 0.6)

    if not any(candidate.field == "model" for candidate in candidates):
        title = " ".join(parser.title_parts)
        if match := _VISIBLE_FIELD_PATTERNS["model"].search(title):
            _add_candidate(candidates, "model", match.group(1), "visible_text", 0.55)
    return ExtractedPage(
        tuple(candidates),
        structured.variants,
        structured.product_group_ids,
    )


def extract_rim_product(html: str) -> ExtractedPage:
    """Backward-compatible HTML entry point."""
    return extract_rim_document(html, content_type="text/html")
