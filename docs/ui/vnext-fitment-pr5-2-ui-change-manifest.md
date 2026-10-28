# UI_CHANGE_MANIFEST — PR5.2

## User-visible changes

- Vehicle fields are grouped under “Основные данные” and “Дополнительные данные”; fields remain the same runtime-owned values.
- Wheel fields are grouped as identification, geometry, and configuration. PCD is visually grouped while preserving its two existing inputs.
- Staggered setup has distinct front/rear axle headings and rear fields never inherit front-wheel suggestions.
- Catalogue dependency/loading/no-data/error feedback is shown next to the relevant field, with the existing retry action.
- Vehicle candidates are inline to the matching field and omit the current value.
- Required vehicle variants form a persistent decision step; confirmed variant identity is shown in the vehicle summary with the existing reselection action.
- Wheel product URL is an in-editor disclosure. Resolver loading, success, multiple variants, inline conflicts, error, retry, and manual recovery stay in wheel context.
- Wheel summary status follows the existing server-owned per-axle setup state.
- Technical check queued, processing, completed, stale, and execution-failure states are differentiated; technical evidence is responsive and missing values display as “Нет данных”.
- Tablet layout switches summaries/evidence to a single column at 1024px; mobile controls remain at least 42–44px high and no new navigation or modal pattern is introduced.

## Added / removed elements

- Added: grouped field headings, inline catalogue field states, compact selected-variant summary, resolver conflict block adjacent to its field, per-axle field headings, responsive evidence labels.
- Removed: ungrouped flat wheel-field presentation; candidates as a separate visual concept; any UI implication that execution failure means an unknown fitment verdict.
- No server states, API fields, values, or user capabilities were removed.

## Interaction-pattern changes

- Candidate selection updates only its associated field through the existing callback.
- Parser conflict choices remain attached to the conflicting wheel field and invoke the existing resolver conflict actions.
- The product URL parser is disclosed from within the wheel editor; its failure recovery keeps the same form and entered values.
- Vehicle variant confirmation and manual vehicle recovery are mutually exclusive steps.
- Technical check retry remains available only when the existing runtime/server status allows it; “Create image” remains independent of verdict.

## Authority

- PR5.2 specification supplied by the user.
- `docs/ui/dream-wheels-application-design-code-vnext-amendment-2026-09-27.md`.
- Frozen VNext Design Code v0.1 and canonical prototype.
- Existing API/runtime state and behavior on `origin/staging` base `7fd2e2df77a18d82566701853cbfd0077e6d58bf`.

## Unspecified design decisions

```yaml
UNSPECIFIED_DESIGN_DECISIONS: NONE
```
