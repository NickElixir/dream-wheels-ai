// Presentation shape shared by runtime and QA fixtures; inputs retain frozen validation rules.
export function buildFitmentRimReadiness({ missing = [], invalid = [], pending = [], conflicts = [], selectionRequired = false } = {}) {
  const conflictFields = conflicts.map(conflict => conflict.field);
  return {
    ready: !missing.length && !invalid.length && !pending.length && !conflictFields.length && !selectionRequired,
    missing,
    invalid,
    pending,
    conflicts: conflictFields,
  };
}
