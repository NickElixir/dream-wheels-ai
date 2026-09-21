# Repo Hygiene & CLAUDE.md Audit Fix

## Objective

Fix five concrete issues found during a repository audit on 2026-09-20. All are
low-risk, non-functional (docs, gitignore, migration numbering). No application
code changes required.

## Mandatory start procedure

Follow `docs/handoffs/README.md` start procedure first: `git status`,
`git branch --show-current`, `git log --oneline -n 15`. Confirm you are on
`feature/vercel-deployment-pipeline` (or a fresh branch off it) before editing.

Do not touch anything under `worktrees/` — that directory holds other agents'
active checkouts, it is not part of this task.

## Scope

### 1. Fix migration numbering collision

Current state (verified via `git log` and `git status`):

- `migrations/0026_fitment_rim_setup_schema_compat.sql` — **already committed**
  (PR #96), do not rename.
- `migrations/0028_fitment_change_event_allowlist.sql` — **already committed**,
  documented in `migrations/README.md`, do not rename.
- `migrations/0035_fitment_rim_source_state.sql` — pending migration for
  source-state fields, never applied anywhere.
- `migrations/0036_fitment_check_lifecycle.sql` — pending migration for the
  fitment-check lifecycle, never applied anywhere. The pair is sequential and
  follows the current committed migration sequence.

Action:

- Keep `migrations/0035_fitment_rim_source_state.sql` and
  `migrations/0036_fitment_check_lifecycle.sql` as the two next free numbers.
- Do not edit SQL content — only the filenames (git will track as new files
  since they are untracked; no `git mv` history to preserve).
- Grep the two files' contents for any internal self-reference to their own
  filename/number (e.g. in a header comment) and update it if present.
- Grep the rest of the repo for references to the prior WIP filenames and
  update any hits (docs, handoffs, tests).

### 2. Update `migrations/README.md`

The file list stops documenting at `0025`. Add one-line entries (matching the
existing style: `` `NNNN_name.sql` — короткое описание на русском ``) for:

- `0026_fitment_rim_setup_schema_compat.sql`
- `0028_fitment_change_event_allowlist.sql` (already referenced later in the
  file's prose section — just missing from the top file list)
- `0035_fitment_rim_source_state.sql` (post-rename)
- `0036_fitment_check_lifecycle.sql` (post-rename)

Base the description on each file's own header comment / `ALTER TABLE`
statements. Keep ordering strictly numeric.

### 3. `.gitignore` additions

Add entries to stop this from recurring:

```gitignore
# macOS
.DS_Store

# Local git worktrees (see docs/handoffs/README.md)
worktrees/
```

Add near the existing OS-agnostic sections, not inside an unrelated block.
Do not delete the already-untracked `.DS_Store` files or `worktrees/` — just
stop tracking eligibility. (They're untracked already, so no `git rm` needed.)

### 4. `CLAUDE.md` updates

Four additions to `/Users/nikolai/Documents/GitHub/dream-wheels-ai-staging/CLAUDE.md`:

**a) External services table** — add rows (same table format as existing
Reve/Render/Telegram rows):

| Сервис | Docs | Зачем |
|--------|------|-------|
| Robokassa | https://docs.robokassa.ru/ | платежи, credit top-ups |
| Wheel-Size API | https://wheel-size.com/api/ | fitment verdict, каталог модификаций |
| Telegram Login (OAuth) | https://core.telegram.org/widgets/login | website auth, `TELEGRAM_LOGIN_*` |

Verify each URL resolves before committing (fetch, don't guess).

**b) MCP troubleshooting** — under the existing "Окружение для MCP" section,
add a second failure mode distinct from the macOS env-var quirk:

> Если MCP возвращает `AUTH_HEADER_REJECTED` / `JWT could not be decoded` (а не
> `unauthorized` из-за отсутствия переменной) — токен невалиден или истёк.
> Пересоздать его в дашборде сервиса (Supabase: Project Settings → API →
> Service Role; не путать с anon key), обновить env, перезапустить Claude
> Code. Проверка "переменная вообще объявлена" здесь не поможет — токен
> присутствует, но сервер его отклоняет.

**c) New "Worktrees" section** (placeholder location: after "Коммиты и
ветки"):

> ## Worktrees
>
> Параллельная работа нескольких агентов (Codex/Claude) ведётся через
> `git worktree` в `worktrees/<name>`. Ветки внутри — не только
> `feature/fix/chore/hotfix` из CONTRIBUTING.md, но и `codex/*` (агентские
> ветки), `docs/*` (документационные handoff-ветки), `hardening/*`.
> `worktrees/` в `.gitignore` — не коммитить.
>
> Перед тем как считать директорию мусором — проверить
> `git worktree list` и дату последнего коммита ветки, не mtime папки.

**d) Branch prefixes note** — in "Коммиты и ветки", add one line acknowledging
`codex/*`, `docs/*`, `hardening/*` as prefixes seen in practice beyond
CONTRIBUTING.md's canonical four, with a note that `codex/*` branches are
agent-created and not meant for manual `git checkout -b`.

### 5. `CONTRIBUTING.md` cross-check (only if scope 4d above needs it)

If CONTRIBUTING.md's branch naming section is the canonical source (CLAUDE.md
says "не дублировать"), put the actual-prefixes note there instead of
CLAUDE.md, and have CLAUDE.md just link to it. Use judgment — don't duplicate
the same list in both files.

## Constraints

- No destructive git operations (no `git reset --hard`, no force-push, no
  deleting other branches/worktrees).
- No `.env` or secret values in any diff.
- Keep commits atomic: one commit for migration renumbering, one for
  `.gitignore`, one for `CLAUDE.md`/`CONTRIBUTING.md` docs. Conventional
  commits (`chore:`, `docs:`).
- Do not push to `main`. Target branch: `feature/vercel-deployment-pipeline`
  or a new `chore/repo-hygiene-audit-fix` branch off it — confirm with the
  user which before pushing.
- Run `ruff check .` and `ruff format --check .` after changes (should be a
  no-op impact, but confirm nothing broke).

## Definition of done

- [ ] No duplicate migration numbers in `migrations/`
- [ ] `migrations/README.md` lists every file present in `migrations/`
- [ ] `git status` is clean of `.DS_Store` / `worktrees/` after adding
      `.gitignore` entries (untracked-but-ignored, not deleted)
- [ ] `CLAUDE.md` external services table includes Robokassa, Wheel-Size,
      Telegram Login with verified working doc URLs
- [ ] `CLAUDE.md` has the MCP auth-vs-missing-env troubleshooting split
- [ ] `CLAUDE.md` (or `CONTRIBUTING.md`, per judgment call in 5) documents the
      `worktrees/` convention and non-canonical branch prefixes
- [ ] `ruff check .` and `ruff format --check .` pass
- [ ] Handoff updated per `docs/handoffs/README.md` completion procedure
      (branch, commit, PR link, what's done, what's left)

## Mandatory completion procedure

Per `docs/handoffs/README.md`: update this file's bottom with final branch,
latest commit SHA, PR link if opened, and any deviations from the plan above
with reasoning.

## Completion record — 2026-09-21

- **Branch:** `chore/repo-hygiene-audit-fix`, created from current
  `origin/staging` (`29415ac`), for a PR back into `staging`.
- **Latest completed implementation commit:** `a8f1d2c` — `docs: record
  repository hygiene conventions`.
- **PR:** [#177](https://github.com/NickElixir/dream-wheels-ai/pull/177) to
  `staging`.
- **Completed:** renamed the two pending migrations, refreshed their
  repository references and the migration index, added local-artifact ignores,
  and documented the verified external-service links, MCP token failure mode,
  worktree convention and branch-prefix policy.
- **URL verification:** Robokassa and Telegram Login returned HTTP 200 after
  redirects. Wheel-Size API resolved to its documented endpoint and returned
  HTTP 403 to the unauthenticated fetch, so the URL is reachable but protected
  from that client.
- **Tests:** `ruff check .` and `ruff format --check .` are run after the
  final documentation commit; browser/runtime testing is not applicable to
  this documentation and repository-hygiene change.
- **Deviation:** the original audit assumed `0028` was the latest committed
  migration. Current `staging` already contains `0029`–`0033`, so the pending
  files were safely assigned `0035` and `0036` instead; using `0029`/`0030`
  would have recreated the collision. The audit also named the already-merged
  `feature/vercel-deployment-pipeline` as its base; this branch instead starts
  from its current integration destination, `origin/staging`.
- **Next step:** review and merge PR #177 into `staging` after CI passes.
