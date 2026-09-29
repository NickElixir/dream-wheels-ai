# VNext Visual System 2.0 — reference asset manifest

**Captured:** 2026-09-29  
**Status:** canonical concept references

These references preserve the visual direction discussed before the Release 1 production cutover.

They are **design references, not literal implementation screenshots**. Product architecture, runtime behavior and approved information architecture remain authoritative over any invented UI detail visible in a generated concept.

## Canonical source images

All source images are 1505×1045 PNG.

| # | Intended repo filename | Subject | Canonical source SHA-256 |
| --- | --- | --- | --- |
| 01 | `01-dashboard-b3.png` | Dashboard with full B3 garage hero vehicle | `7f9d19aec5fdfa1a7caf043a58d34ce928646a3bcad3b1ab3a58ff23911eb788` |
| 02 | `02-fitment-result-conditional.png` | Fitment conditional result, editorial table treatment | `d31396aaf034c5174033d2c376e9ab843c3d5924df99b7a9285345e939dbbd8d` |
| 03 | `03-fitment-wheel-parameters-a.png` | Wheel-parameter workspace with rear-quarter visual rail | `0c44eba98024eb9a8f307d441c7d580f23578b082ff517d7d583ea95860dfaed` |
| 04 | `04-fitment-modification-selection.png` | Modification selection with vehicle previews | `5f7e7919b65e4d89dacbecd0ed685a699e6c90e7906cc2621f981eef4196644d` |
| 05 | `05-fitment-vehicle-details.png` | Vehicle-details clarification workspace | `cad66dd742457a156cc5227166395c24897d479b7fa5ccfaeb7c812b0092d2bf` |
| 06 | `06-fitment-wheel-parameters-b.png` | Alternative wheel-parameter composition | `5a0cd8e9f52a2276ba85dee6e1ac51623d957cca7f9fdb9672df36f807c14347` |
| 07 | `07-balance.png` | Balance with stronger graphite hierarchy and automotive visual rail | `d5d52a24d5ee5638c6fd780d91c73a726608d8cb847b2b94ab531ea898e100ee` |

Preferred repository location for the binary assets:

```text
docs/references/vnext-visual-system-2.0/
```

## What is approved from the references

Approved direction:

- stronger near-white typography;
- clearer graphite surface hierarchy;
- near-white primary CTA;
- restrained green/amber semantic text;
- typography-first navigation;
- no navigation icons;
- no left active-nav accent stripe;
- no decorative status dots/circles/pills;
- large purposeful object/workspace surfaces rather than generic SaaS card grids;
- desktop B3 automotive environment as a future post-production direction;
- rear-quarter / taillight crop as a preferred future Fitment environment;
- full hero vehicle as a preferred future Dashboard direction;
- modification vehicle thumbnails as a future enhancement;
- repeated provider/reference images across modification rows are acceptable.

## What is not approved merely because it appears in a reference

Generated concepts may contain invented details.

Do not infer approval for:

- new navigation destinations;
- Favorites;
- My Vehicles;
- Pro / subscription cards;
- global Fitment navigation;
- new status semantics;
- new business actions;
- new payment behavior;
- new Fitment permissions;
- new technical fields not supported by runtime/API.

## Phase ownership

Use:

- `docs/ui/vnext-visual-system-2.0-phase1.md` for the pre-production typography/color/surface pass;
- `docs/ui/fitment-flow-contract-v2.md` for the Fitment repair;
- `docs/ui/vnext-visual-system-2.0-post-production-plan.md` for the deferred large layout/garage/image work.

## Binary preservation note

The exact source PNGs were archived at capture time with the hashes above so the references can be restored byte-for-byte and verified before future implementation work.

If a repository checkout does not yet contain the binary files at the preferred path, the hashes in this manifest remain the identity check for importing the preserved originals; do not regenerate approximations and call them the same references.
