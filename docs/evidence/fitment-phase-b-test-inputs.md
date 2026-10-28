# Phase B real-provider input registry

Qualified 2026-10-01 UTC using the unchanged adapters from runtime `7ac81e2` and real HTTPS provider responses. This is preparation, not authenticated staging E2E. Revalidate external data at the start of Phase B. Machine-readable samples: [provider qualification](fitment-phase-b-provider-qualification.json).

| ID | Input | Observed provider shape | Purpose | Status |
|---|---|---|---|---|
| V1 | LADA / Vesta / 2020 | One market: `russia` / `Russia+`; four exact modifications | Hidden/auto-resolved Market; recognition/manual | QUALIFIED catalogue and public photo; recognition not executed |
| V2 | Lexus / RX / 2020 | 13 distinct markets; four modifications in `cdm` | Visible Market and exact choice | QUALIFIED catalogue and approved photo; recognition not executed |
| W1 | [RC Design RC36, SKU 2305308](https://jaunasriepas.lv/en/rc-design-rc36-black-gloss-polished/sku2305308/) | One product; no variant chooser. Proposals: brand RC Design, PCD 5×112, DIA 66.6, ET 35.5 | Normal URL proposal and Wheel-only Save | QUALIFIED; diameter/width/SKU not extracted |
| W2 | [KONIG Countergram public product JSON](https://konigwheels.com/products/konig-countergram.json) | 55 SKU variants; `selection_required=true`; SKU and brand only | Chooser, Cancel, A→B invalidation | QUALIFIED; remaining parameters require manual input |
| W3 | W1 URL | Resolver returns numeric `offset_et_mm=35.5` | Decimal comma/dot and exact serialization | QUALIFIED real decimal; no claim that 35.125 exists at provider |

## Vehicle photos and exact variants

V1: [2020 Lada Vesta red front.jpg](https://commons.wikimedia.org/wiki/File:2020_Lada_Vesta_red_front.jpg), Throwawayacc222, CC0. Source labels the vehicle as 2020; photographed 2025-10-25. Download original from the source page for recognition. Expected LADA Vesta; catalogue test explicitly selects 2020. Recognition may return a generation range, which the reviewer must resolve explicitly rather than assume a model year.

V1 market is `russia` / `Russia+`. Returned modification/generation IDs and labels are recorded in JSON. Examples: `e798f47a7a` / `1.6i`, generation `067a26d872` / `B/C`. Select the real intended modification explicitly; one market does not mean one modification.

V2: [2020 Lexus RX 450h Takumi CVT 3.5 Front.jpg](https://commons.wikimedia.org/wiki/File:2020_Lexus_RX_450h_Takumi_CVT_3.5_Front.jpg), Vauxford, CC BY-SA 4.0. This is already referenced by `tests/fixtures/vehicle_identity/manifest.pilot.json`. Preserve attribution when downloading/sharing. Expected Lexus RX, 2020; no recognition result is asserted.

V2 returned markets (retained without deduplication by label):

| ID | Label |
|---|---|
| cdm | Canada |
| ladm | Central & South America |
| chdm | China |
| eudm | Europe |
| jdm | Japan |
| medm | Middle East |
| nadm | North Africa |
| audm | Oceania |
| russia | Russia+ |
| sadm | South Africa |
| skdm | South Korea |
| sam | Southeast Asia |
| usdm | USA+ |

No duplicate IDs, labels or duplicate semantic geographic choices were observed in V1/V2. This observation is limited to these actual option sets. The code/data were not modified to deduplicate choices. V2's recorded exact modifications use `cdm`; to match the UK source photo, select `eudm` and obtain fresh region-specific exact variants through the application. Do not reuse Canadian IDs for Europe.

## Wheel particulars and limitations

W1/W3 source heading supplies diameter 20 and width 8.5; the resolver does **not** propose these two values. Enter them manually and confirm all five critical parameters. Do not call this a complete automatic extraction. The source product code is 2305308; resolver SKU is absent. This is a single-product URL, not a one-item variant collection.

W2 is a real public JSON document, supported by the existing HTTPS resolver. Use the `.json` URL exactly. The generic HTML URL produced misleading diameter/width proposals during preparation and is **not** a qualified input.

| Choice | Real SKU | Source display title | Source diameter / width / PCD / ET | Actual resolver values |
|---|---|---|---|---|
| A | CT8510025C | 4X100 / 15x8 \| et 25mm / HYPER CHROME / MACHINED LIP | 15 / 8 / 4×100 / 25 | SKU, brand KONIG; technical values absent |
| B | CT7510035C | See exact source title in JSON evidence | 15 / 7.5 / 4×100 / 35 | SKU, brand KONIG; technical values absent |

DIA is absent from the resolver and source option labels. Do not invent a provider-backed DIA. A→B can test invalidation of manually confirmed A fields, then require new confirmation. The chooser's displayed label may be only SKU; source titles above are not claims about UI display text.

## Failure/no-data classification

| Scenario | Classification | Preparation |
|---|---|---|
| Recognition no-data | REAL BUT NON-DETERMINISTIC | Non-sensitive photo with no car, if owner already has one; no stable recognition outcome asserted |
| Resolver empty document | CONTROLLED TEST ONLY | Existing resolver extraction tests; no mock claimed as Phase B input |
| Resolver inaccessible/unsupported page | REAL BUT NON-DETERMINISTIC | Apex VS-5RS and BBS FI-R URLs returned `rim_source_unsupported_document` locally; anti-bot/status may change |
| Resolver SSRF rejection | CONTROLLED TEST ONLY | Existing URL security tests; do not send private/local-network probes on staging |
| External provider outage/timeouts | NOT SAFELY REPRODUCIBLE | Do not alter DNS/keys/flags or disrupt provider |
| Check failed/retry | CONTROLLED TEST ONLY unless an actual failure occurs | Existing lifecycle tests; record naturally occurring failure without forcing an outage |

Qualified inputs are a starting point; authenticated staging admission, response shape and behavior remain Phase B assertions.
