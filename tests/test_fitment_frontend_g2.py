from html.parser import HTMLParser
from pathlib import Path
from typing import ClassVar

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "webapp" / "index.html").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "webapp" / "style.css").read_text(encoding="utf-8")


class _Node:
    def __init__(self, tag: str, attrs: dict[str, str], parent: "_Node | None") -> None:
        self.tag = tag
        self.attrs = attrs
        self.parent = parent
        self.children: list[_Node] = []


class _TreeParser(HTMLParser):
    _void_tags: ClassVar[set[str]] = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }

    def __init__(self) -> None:
        super().__init__()
        self.root = _Node("document", {}, None)
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = _Node(tag, {key: value or "" for key, value in attrs}, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in self._void_tags:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return


def _walk(node: _Node):
    yield node
    for child in node.children:
        yield from _walk(child)


def _fitment_view_tree() -> _Node:
    parser = _TreeParser()
    parser.feed(INDEX_HTML)
    return next(node for node in _walk(parser.root) if node.attrs.get("data-view") == "fitment")


def _scope(source: str, start: str, end: str) -> str:
    return source.split(start, 1)[1].split(end, 1)[0]


def test_vehicle_and_result_states_are_table_driven_by_server_next_action() -> None:
    helper = _scope(
        APP_JS, "function fitmentVehicleHelperLines(ui)", "function renderFitmentVehicleHelper"
    )
    state_copy = {
        "complete_vehicle_details": [
            "Автомобиль определён по фотографии",
            "Проверьте найденные данные",
            "Если всё верно, подтвердите их",
        ],
        "select_vehicle_variant": [
            "Выберите комплектацию",
            "Выберите вариант, который соответствует вашему автомобилю",
        ],
    }
    for action, copy_lines in state_copy.items():
        assert f'ui.nextAction === "{action}"' in helper
        for line in copy_lines:
            assert line in helper
    assert 'nextAction === "confirmed_ready"' not in helper
    assert "fitmentNextAction(overview)" in APP_JS


def test_complete_vehicle_details_does_not_expose_variant_picker_or_internal_provenance() -> None:
    vehicle_renderer = _scope(
        APP_JS, "function renderFitment()", "function renderFitmentRimVariants"
    )
    assert "renderFitmentVehicleHelper(ui);" in vehicle_renderer
    assert "fitmentModificationStateLabel(ui)" not in vehicle_renderer
    assert (
        'variantWorkspace.hidden = ui.nextAction !== "select_vehicle_variant"' in vehicle_renderer
    )
    assert 'variantEmpty.hidden = ui.nextAction !== "select_vehicle_variant"' in vehicle_renderer
    assert 'ui.nextAction === "complete_vehicle_details"' in vehicle_renderer
    assert "data-fitment-modification-state" not in INDEX_HTML
    assert "data-fitment-vehicle-state" not in INDEX_HTML


def test_missing_vehicle_fields_have_exact_field_level_recovery_copy() -> None:
    validation = _scope(
        APP_JS, "function renderFitmentValidation()", "function validateFitmentOverview"
    )
    for path, copy in {
        "vehicle.make": "Выберите марку автомобиля",
        "vehicle.model": "Выберите модель автомобиля",
        "vehicle.year": "Выберите год автомобиля",
        "vehicle.market": "Выберите рынок автомобиля",
    }.items():
        assert f'"{path}": "{copy}"' in validation
    assert 'input.setAttribute("aria-invalid", "true")' in validation


def test_explicit_vehicle_confirmation_sends_prefilled_vehicle_without_starting_check() -> None:
    save = _scope(APP_JS, "async function saveFitment(", "async function fetchRenderHistory")
    assert "fitmentVehicleConfirmationRequired()" in save
    assert (
        "includeVehicle: state.fitmentVehicleDirty || fitmentVehicleConfirmationRequired()" in save
    )
    assert "await runFitmentCheck();" not in save
    assert 'fitmentNextAction(overview) === "complete_vehicle_details"' in APP_JS


def test_stale_result_recovery_maps_each_server_action_to_a_focused_next_step() -> None:
    result = _scope(APP_JS, "function renderFitmentV2Result(", "function renderFitment()")
    assert "Результат больше не актуален" in result
    assert "Данные автомобиля или колесного диска изменились после последней проверки" in APP_JS
    for action, label in {
        "complete_vehicle_details": "Подтвердить данные автомобиля",
        "select_vehicle_variant": "Выбрать комплектацию",
        "complete_rim_specs": "Уточнить параметры колесного диска",
    }.items():
        assert f'{action}: locale === "ru" ? "{label}"' in result
    recovery = _scope(APP_JS, "const staleRecovery =", "const fitmentEdit =")
    assert 'action === "complete_vehicle_details"' in recovery
    assert 'action === "select_vehicle_variant"' in recovery
    assert 'action === "complete_rim_specs"' in recovery


def test_render_island_is_a_fitment_view_sibling_with_independent_copy_and_cta() -> None:
    view = _fitment_view_tree()
    panel = next(
        node for node in _walk(view) if "fitment-panel" in node.attrs.get("class", "").split()
    )
    render = next(
        node for node in _walk(view) if node.attrs.get("data-fitment-render-action") is not None
    )
    assert panel.parent is view
    assert render.parent is view
    assert render is not panel
    assert "data-fitment-render-copy>Визуальная примерка" in INDEX_HTML
    assert "Посмотрите, как выбранный диск выглядит на вашем автомобиле" in INDEX_HTML
    assert 'class="ghost-button neutral" data-fitment-create-image' in INDEX_HTML
    assert ".fitment-render-action {" in STYLE_CSS
    assert "background: rgba(255, 255, 255, 0.03);" in STYLE_CSS


def test_reload_restores_fitment_context_without_replaying_automatic_mutations() -> None:
    assert "FITMENT_NAVIGATION_CONTEXT_KEY" in APP_JS
    assert "readFitmentNavigationContext()" in APP_JS
    assert "persistFitmentNavigationContext()" in APP_JS
    assert "suppressAutomaticResolver: true" in APP_JS
    reload_flow = _scope(
        APP_JS, "const fitmentContext = readFitmentNavigationContext();", 'setView("dashboard")'
    )
    assert "openFitmentView(fitmentContext.jobId" in reload_flow
    assert "restoreSection: fitmentContext.activeSection" in reload_flow


def test_result_tab_remains_unavailable_without_current_or_historical_result() -> None:
    assert 'data-fitment-result-tab aria-selected="false" disabled' in INDEX_HTML
    assert "return Boolean(state.fitmentCheck || state.fitmentCheckHistory.length);" in APP_JS
    assert 'section === "result" && !fitmentResultAvailable()' in APP_JS
