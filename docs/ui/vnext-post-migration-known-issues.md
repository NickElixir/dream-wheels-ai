# VNext post-migration known issues

## FITMENT-POST-PR6-01

- **Status:** OPEN
- **Severity:** functional usability / progression
- **Observed on:** staging after PR5.2

Vehicle identity can be present while the modification / vehicle-variant progression is not surfaced clearly enough to advance to technical Fitment. In the observed case, a modification was not proposed, the technical check remained blocked, and the previous modification-selection path was unavailable or not discoverable.

This is intentionally deferred from PR6. The PR5.2 parity audit records the implementation checks at the time; this staging observation is a follow-up finding, not a retrospective change to that audit. Keep vehicle-variant lookup and application, catalogue functions, manual recovery, Fitment save and resolver, check execution, and revision/currentness runtime intact until this issue is repaired.

The next task should compare the current screen with the formerly working business flow: recognized vehicle → base details → modification selection → confirmation → wheel parameters → technical check.
