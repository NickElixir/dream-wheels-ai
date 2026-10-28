# DW-30 Implementation

```text
Role: implementation agent.

Goal:
<GOAL>

Branch/base:
<BRANCH_BASE>

Read first:
- AGENTS.md
- CONTRIBUTING.md
- docs/agent-skills/<PRIMARY_SKILL_NAME>/SKILL.md
- <RELEVANT_FILES>

Scope:
- May change: <ALLOWED_FILES_OR_MODULES>
- Must not change: <EXCLUDED_FILES_OR_MODULES>

Constraints:
- Preserve: <DOMAIN_INVARIANTS>
- Meet: <ACCEPTANCE_CRITERIA>
- Do not touch secrets or .env.
- Do not apply migrations or call production APIs.
- Do not perform unrelated refactoring.
- Add/update tests for changed behavior.

Verification:
- ruff check .
- ruff format --check .
- <RELEVANT_PYTEST_COMMANDS>
- If a command cannot run, report why.

Output:
1. Summary
2. Changed files
3. Tests and results
4. Assumptions
5. Residual risks
6. For user-visible UI/UX work: UI_CHANGE_MANIFEST and exact-HEAD browser evidence/limitations

Review handoff for user-visible UI/UX PR:
- After implementation/tests, create a fresh reviewer subagent using `docs/agent-workflows/prompts/ui-reviewer.md`.
- Give it `docs/agent-workflows/vnext-independent-ui-reviewer.md`, the approved PR spec, exact PR/base/head, UI_CHANGE_MANIFEST, tests/CI, and exact-HEAD browser evidence or explicit limitations.
- The reviewer must not edit code or merge the PR.
- Return reviewer findings to Coordinator/Architect first. Do not automatically implement reviewer suggestions before Architect/Coordinator classification.
- For migration/payments/auth/credits/Fitment/destructive cleanup or disputed UX, expect an additional independent reviewer chat if Coordinator/Architect requests it.
```
