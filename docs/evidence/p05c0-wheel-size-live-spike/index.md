# Evidence index

Every raw file is a live HTTP 200 JSON response. Params exclude credentials. `requests.jsonl` includes UTC capture times and SHA-256 hashes.

| Sample | Vehicle / market | Endpoint | Raw fixture | Why selected |
| --- | --- | --- | --- | --- |
| cayenne-generations | porsche cayenne 2021 / eudm | `generations` | [raw/cayenne-generations.json](raw/cayenne-generations.json) | hierarchy / generation filter |
| model-3-generations | tesla model-3 2023 / eudm | `generations` | [raw/model-3-generations.json](raw/model-3-generations.json) | hierarchy / generation filter |
| porsche-cayenne-2021-eudm-generations | porsche cayenne 2021 / eudm | `generations` | [raw/porsche-cayenne-2021-eudm-generations.json](raw/porsche-cayenne-2021-eudm-generations.json) | hierarchy / generation filter |
| porsche-cayenne-2021-eudm-modifications | porsche cayenne 2021 / eudm | `modifications` | [raw/porsche-cayenne-2021-eudm-modifications.json](raw/porsche-cayenne-2021-eudm-modifications.json) | variant distinction / powertrain |
| porsche-cayenne-2021-eudm-search | porsche cayenne 2021 / eudm | `search/by_model` | [raw/porsche-cayenne-2021-eudm-search.json](raw/porsche-cayenne-2021-eudm-search.json) | reference wheels / markets |
| tesla-model-3-2023-eudm-generations | tesla model-3 2023 / eudm | `generations` | [raw/tesla-model-3-2023-eudm-generations.json](raw/tesla-model-3-2023-eudm-generations.json) | hierarchy / generation filter |
| tesla-model-3-2023-eudm-modifications | tesla model-3 2023 / eudm | `modifications` | [raw/tesla-model-3-2023-eudm-modifications.json](raw/tesla-model-3-2023-eudm-modifications.json) | variant distinction / powertrain |
| tesla-model-3-2023-eudm-search | tesla model-3 2023 / eudm | `search/by_model` | [raw/tesla-model-3-2023-eudm-search.json](raw/tesla-model-3-2023-eudm-search.json) | reference wheels / markets |
| volkswagen-golf-2020-eudm-generations | volkswagen golf 2020 / eudm | `generations` | [raw/volkswagen-golf-2020-eudm-generations.json](raw/volkswagen-golf-2020-eudm-generations.json) | hierarchy / generation filter |
| volkswagen-golf-2020-eudm-modifications | volkswagen golf 2020 / eudm | `modifications` | [raw/volkswagen-golf-2020-eudm-modifications.json](raw/volkswagen-golf-2020-eudm-modifications.json) | variant distinction / powertrain |
| volkswagen-golf-2020-eudm-search | volkswagen golf 2020 / eudm | `search/by_model` | [raw/volkswagen-golf-2020-eudm-search.json](raw/volkswagen-golf-2020-eudm-search.json) | reference wheels / markets |
| toyota-rav4-2021-eudm-generations | toyota rav4 2021 / eudm | `generations` | [raw/toyota-rav4-2021-eudm-generations.json](raw/toyota-rav4-2021-eudm-generations.json) | hierarchy / generation filter |
| toyota-rav4-2021-eudm-modifications | toyota rav4 2021 / eudm | `modifications` | [raw/toyota-rav4-2021-eudm-modifications.json](raw/toyota-rav4-2021-eudm-modifications.json) | variant distinction / powertrain |
| toyota-rav4-2021-eudm-search | toyota rav4 2021 / eudm | `search/by_model` | [raw/toyota-rav4-2021-eudm-search.json](raw/toyota-rav4-2021-eudm-search.json) | reference wheels / markets |
| bmw-3-series-2020-eudm-generations | bmw 3-series 2020 / eudm | `generations` | [raw/bmw-3-series-2020-eudm-generations.json](raw/bmw-3-series-2020-eudm-generations.json) | hierarchy / generation filter |
| bmw-3-series-2020-eudm-modifications | bmw 3-series 2020 / eudm | `modifications` | [raw/bmw-3-series-2020-eudm-modifications.json](raw/bmw-3-series-2020-eudm-modifications.json) | variant distinction / powertrain |
| bmw-3-series-2020-eudm-search | bmw 3-series 2020 / eudm | `search/by_model` | [raw/bmw-3-series-2020-eudm-search.json](raw/bmw-3-series-2020-eudm-search.json) | reference wheels / markets |
| porsche-cayenne-2021-usdm-generations | porsche cayenne 2021 / usdm | `generations` | [raw/porsche-cayenne-2021-usdm-generations.json](raw/porsche-cayenne-2021-usdm-generations.json) | hierarchy / generation filter |
| porsche-cayenne-2021-usdm-modifications | porsche cayenne 2021 / usdm | `modifications` | [raw/porsche-cayenne-2021-usdm-modifications.json](raw/porsche-cayenne-2021-usdm-modifications.json) | variant distinction / powertrain |
| porsche-cayenne-2021-usdm-search | porsche cayenne 2021 / usdm | `search/by_model` | [raw/porsche-cayenne-2021-usdm-search.json](raw/porsche-cayenne-2021-usdm-search.json) | reference wheels / markets |
| porsche-cayenne-2021-eudm-modifications-repeat | porsche cayenne 2021 / eudm | `modifications` | [raw/porsche-cayenne-2021-eudm-modifications-repeat.json](raw/porsche-cayenne-2021-eudm-modifications-repeat.json) | repeat stability |
| porsche-cayenne-2021-eudm-search-repeat | porsche cayenne 2021 / eudm | `search/by_model` | [raw/porsche-cayenne-2021-eudm-search-repeat.json](raw/porsche-cayenne-2021-eudm-search-repeat.json) | repeat stability |
| porsche-cayenne-2021-eudm-exact-af284e7b2d | porsche cayenne 2021 / eudm | `search/by_model` | [raw/porsche-cayenne-2021-eudm-exact-af284e7b2d.json](raw/porsche-cayenne-2021-eudm-exact-af284e7b2d.json) | exact modification reference |
| porsche-cayenne-2021-eudm-exact-b33a1e86a6 | porsche cayenne 2021 / eudm | `search/by_model` | [raw/porsche-cayenne-2021-eudm-exact-b33a1e86a6.json](raw/porsche-cayenne-2021-eudm-exact-b33a1e86a6.json) | exact modification reference |
| porsche-cayenne-2021-eudm-generation-filter | porsche cayenne 2021 / eudm | `modifications` | [raw/porsche-cayenne-2021-eudm-generation-filter.json](raw/porsche-cayenne-2021-eudm-generation-filter.json) | hierarchy / generation filter |
| tesla-model-3-2023-eudm-modifications-repeat | tesla model-3 2023 / eudm | `modifications` | [raw/tesla-model-3-2023-eudm-modifications-repeat.json](raw/tesla-model-3-2023-eudm-modifications-repeat.json) | repeat stability |
| tesla-model-3-2023-eudm-search-repeat | tesla model-3 2023 / eudm | `search/by_model` | [raw/tesla-model-3-2023-eudm-search-repeat.json](raw/tesla-model-3-2023-eudm-search-repeat.json) | repeat stability |
| tesla-model-3-2023-eudm-exact-5a081c2f38 | tesla model-3 2023 / eudm | `search/by_model` | [raw/tesla-model-3-2023-eudm-exact-5a081c2f38.json](raw/tesla-model-3-2023-eudm-exact-5a081c2f38.json) | exact modification reference |
| tesla-model-3-2023-eudm-exact-0d7499344b | tesla model-3 2023 / eudm | `search/by_model` | [raw/tesla-model-3-2023-eudm-exact-0d7499344b.json](raw/tesla-model-3-2023-eudm-exact-0d7499344b.json) | exact modification reference |
| tesla-model-3-2023-eudm-generation-filter | tesla model-3 2023 / eudm | `modifications` | [raw/tesla-model-3-2023-eudm-generation-filter.json](raw/tesla-model-3-2023-eudm-generation-filter.json) | hierarchy / generation filter |
| volkswagen-golf-2020-eudm-modifications-repeat | volkswagen golf 2020 / eudm | `modifications` | [raw/volkswagen-golf-2020-eudm-modifications-repeat.json](raw/volkswagen-golf-2020-eudm-modifications-repeat.json) | repeat stability |
| volkswagen-golf-2020-eudm-search-repeat | volkswagen golf 2020 / eudm | `search/by_model` | [raw/volkswagen-golf-2020-eudm-search-repeat.json](raw/volkswagen-golf-2020-eudm-search-repeat.json) | repeat stability |
| volkswagen-golf-2020-eudm-exact-ddeb5989b3 | volkswagen golf 2020 / eudm | `search/by_model` | [raw/volkswagen-golf-2020-eudm-exact-ddeb5989b3.json](raw/volkswagen-golf-2020-eudm-exact-ddeb5989b3.json) | exact modification reference |
| volkswagen-golf-2020-eudm-exact-188b8a4c84 | volkswagen golf 2020 / eudm | `search/by_model` | [raw/volkswagen-golf-2020-eudm-exact-188b8a4c84.json](raw/volkswagen-golf-2020-eudm-exact-188b8a4c84.json) | exact modification reference |
| volkswagen-golf-2020-eudm-generation-filter | volkswagen golf 2020 / eudm | `modifications` | [raw/volkswagen-golf-2020-eudm-generation-filter.json](raw/volkswagen-golf-2020-eudm-generation-filter.json) | hierarchy / generation filter |
| porsche-cayenne-2021-eudm-exact-117a52c786 | porsche cayenne 2021 / eudm | `search/by_model` | [raw/porsche-cayenne-2021-eudm-exact-117a52c786.json](raw/porsche-cayenne-2021-eudm-exact-117a52c786.json) | exact modification reference |
| porsche-cayenne-2021-eudm-exact-19e5c5a357 | porsche cayenne 2021 / eudm | `search/by_model` | [raw/porsche-cayenne-2021-eudm-exact-19e5c5a357.json](raw/porsche-cayenne-2021-eudm-exact-19e5c5a357.json) | exact modification reference |
| toyota-corolla-1995-eudm-modifications | toyota corolla 1995 / eudm | `modifications` | [raw/toyota-corolla-1995-eudm-modifications.json](raw/toyota-corolla-1995-eudm-modifications.json) | variant distinction / powertrain |

## Derived evidence

- `comparison/field-inventory.json`: paths, observed types/nulls and examples; counts combine catalogue/search appearances, not distinct vehicles.
- `comparison/duplicate-pairs.json`: every observed same-name/same-generation group, first two raw objects and differences; third+ members remain in raw fixtures.
- `comparison/repeated-call-stability.json`: three cases × catalogue/search repeats.
- `comparison/market-comparison.json`: Cayenne EUDM/USDM.
- `comparison/reference-sets.json`: 83 variant/market responses, explicit axles, stock and all sizes.
- `comparison/f06-example-cases.json`: five real provider sets with hypothetical submitted diameters.
- `normalized/*current-projection.json`: local nine-field projection equivalent to current adapter; not upstream JSON.
- `normalized/*profile.json`: actual unmodified `_normalize_profile` run locally on exact live responses; injected inert cache, no network/cache/DB writes.
