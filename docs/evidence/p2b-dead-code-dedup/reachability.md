# Reachability proof

All locations refer to BASE recorded in inventory.md. `app.js` is loaded as `type="module"` by index.html; the removed function declarations are private lexical bindings. No eval/new Function/string timer/window[name] lookup exposes those bindings. Explicit bridge/Legacy exports, handler maps, delegated data-actions and imports do not mention them. HTML and runtime-module searches contain no calls. AST references include callbacks and object shorthand values, so an indirect function-valued handler would appear in the owner graph. This is a scoped proof for these symbols, not a universal dead-code detector.

Checked entry points: DOMContentLoaded; setView/rerenderActiveView; renderFitment; openFitmentView; demo/forced-preview mode; auth restore/resumeFitmentAfterLogin; catalogue reload; mutations/save/check polling; bindEvents and VNext bridges. Current renderFitment is reachable and retained. Module syntax already determines browser compatibility; there is no separate old-browser dispatch to the removed root.

## renderFitmentLegacy

Symbol: `renderFitmentLegacy`. File: `webapp/app.js:4585`–`4979` (BASE).

Repository references:

```text
webapp/app.js:4585:function renderFitmentLegacy() {
tests/test_fitment_vehicle_catalogue_state_machine.py:170:    controls = _scope(APP_JS, "function renderFitmentControls", "function renderFitmentLegacy")
```

Runtime entry points: checked above; no caller.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: private unreferenced root, absent from all external/dynamic dispatch mechanisms.

## fitmentSourceValue

Symbol: `fitmentSourceValue`. File: `webapp/app.js:3214`–`3219` (BASE).

Repository references:

```text
webapp/app.js:3214:function fitmentSourceValue(overview) {
```

Runtime entry points: checked above; no caller.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: private unreferenced root, absent from all external/dynamic dispatch mechanisms.

## fitmentNextStep

Symbol: `fitmentNextStep`. File: `webapp/app.js:3845`–`3877` (BASE).

Repository references:

```text
webapp/app.js:3845:function fitmentNextStep(overview) {
```

Runtime entry points: checked above; no caller.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: private unreferenced root, absent from all external/dynamic dispatch mechanisms.

## fitmentCatalogueErrorMessage

Symbol: `fitmentCatalogueErrorMessage`. File: `webapp/app.js:5944`–`5948` (BASE).

Repository references:

```text
webapp/app.js:5944:function fitmentCatalogueErrorMessage() {
```

Runtime entry points: checked above; no caller.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: private unreferenced root, absent from all external/dynamic dispatch mechanisms.

## fitmentCatalogueQueryValue

Symbol: `fitmentCatalogueQueryValue`. File: `webapp/app.js:5976`–`5989` (BASE).

Repository references:

```text
webapp/app.js:5976:function fitmentCatalogueQueryValue(kind, value) {
webapp/auth/vnext-fitment.test.js:90:    + app.slice(app.indexOf("function fitmentCatalogueSelectionItem("), app.indexOf("function fitmentCatalogueQueryValue("));
webapp/auth/vnext-fitment.test.js:531:    app.slice(app.indexOf("function fitmentCatalogueSelectionItem("), app.indexOf("function fitmentCatalogueQueryValue(")),
```

Runtime entry points: checked above; no caller.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: private unreferenced root, absent from all external/dynamic dispatch mechanisms.

## formatPcd

Symbol: `formatPcd`. File: `webapp/app.js:9766`–`9770` (BASE).

Repository references:

```text
webapp/app.js:9766:function formatPcd(rim) {
```

Runtime entry points: checked above; no caller.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: private unreferenced root, absent from all external/dynamic dispatch mechanisms.

## fitmentVehicleMeta

Symbol: `fitmentVehicleMeta`. File: `webapp/app.js:3203`–`3205` (BASE).

Repository references:

```text
webapp/app.js:3203:function fitmentVehicleMeta(overview) {
webapp/app.js:4926:        document.createTextNode(fitmentVehicleMeta(overview))
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## fitmentRimMeta

Symbol: `fitmentRimMeta`. File: `webapp/app.js:3207`–`3212` (BASE).

Repository references:

```text
webapp/app.js:3207:function fitmentRimMeta(overview) {
webapp/app.js:4939:        document.createTextNode(fitmentRimMeta(overview))
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## fitmentSourceBrand

Symbol: `fitmentSourceBrand`. File: `webapp/app.js:3221`–`3231` (BASE).

Repository references:

```text
webapp/app.js:3221:function fitmentSourceBrand(overview) {
webapp/app.js:4942:        document.createTextNode(fitmentSourceBrand(overview))
tests/test_cabinet_dashboard_static.py:276:    assert "function fitmentSourceBrand(overview)" in APP_JS
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## fitmentSourceSku

Symbol: `fitmentSourceSku`. File: `webapp/app.js:3233`–`3235` (BASE).

Repository references:

```text
webapp/app.js:3233:function fitmentSourceSku(overview) {
webapp/app.js:4946:        sourceSku.textContent = fitmentSourceSku(overview);
webapp/app.js:4947:        sourceSku.hidden = !fitmentSourceSku(overview);
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## setFitmentOverviewCollapsed

Symbol: `setFitmentOverviewCollapsed`. File: `webapp/app.js:3237`–`3250` (BASE).

Repository references:

```text
webapp/app.js:3237:function setFitmentOverviewCollapsed(collapsed) {
webapp/app.js:4857:    setFitmentOverviewCollapsed(state.fitmentOverviewCollapsed);
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## renderFitmentCandidates

Symbol: `renderFitmentCandidates`. File: `webapp/app.js:3265`–`3293` (BASE).

Repository references:

```text
webapp/app.js:3265:function renderFitmentCandidates() {
webapp/app.js:4978:    renderFitmentCandidates();
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## fitmentCandidatesFor

Symbol: `fitmentCandidatesFor`. File: `webapp/app.js:3195`–`3201` (BASE).

Repository references:

```text
webapp/app.js:3195:function fitmentCandidatesFor(path) {
webapp/app.js:3272:        const candidates = fitmentCandidatesFor(path);
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentCandidates.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## fitmentCandidateLabel

Symbol: `fitmentCandidateLabel`. File: `webapp/app.js:3252`–`3263` (BASE).

Repository references:

```text
webapp/app.js:3252:function fitmentCandidateLabel(candidate, path = "") {
webapp/app.js:3278:            const candidateLabel = fitmentCandidateLabel(candidate, path);
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentCandidates.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## fitmentModificationStateLabel

Symbol: `fitmentModificationStateLabel`. File: `webapp/app.js:4051`–`4062` (BASE).

Repository references:

```text
webapp/app.js:4051:function fitmentModificationStateLabel(ui) {
webapp/app.js:4871:        modificationState.textContent = fitmentModificationStateLabel(ui);
tests/test_fitment_frontend_g2.py:102:    assert "fitmentModificationStateLabel(ui)" not in vehicle_renderer
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.

## fitmentRetryMessage

Symbol: `fitmentRetryMessage`. File: `webapp/app.js:4064`–`4075` (BASE).

Repository references:

```text
webapp/app.js:4064:function fitmentRetryMessage(check) {
webapp/app.js:4813:        const retryMessage = fitmentRetryMessage(check);
tests/test_fitment_frontend_slice6.py:99:    assert "fitmentRetryMessage" in APP_JS
```

Runtime entry points: checked above; only owners in the closed removed subgraph: renderFitmentLegacy.
HTML/data-action references: none. Window/global exports: none. Runtime imports/bridge usage: none.
Tests: repository matches above are static strings/slicing boundaries, never production dispatch. Any affected assertion is replaced by coverage of the surviving path; historical evidence is not rewritten.
Classification: DEAD.
Reason safe to remove: every caller is exclusively in the proven unreachable subgraph; shared dependencies with live callers are retained.
