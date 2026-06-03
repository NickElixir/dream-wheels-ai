---
geometry: landscape,margin=0.35in
fontsize: 10pt
header-includes:
  - \usepackage{graphicx}
---

# Masked Wheel Generation Regression

Date: 2026-06-02

Test case: `ivan-C1`

## Branch Scope

This branch started as a Stage 2 mask-quality experiment:

```text
detected wheel candidates -> VLM keep/reject filter -> cleaner wheel mask
```

After the mask filter looked useful, the scope expanded to a generation eval:

```text
source car + target wheel reference + generated/filtered mask
  -> wheel replacement model
```

That means the branch now contains two related but separate questions:

1. Does the VLM filter improve the wheel mask?
2. If we pass that mask into generation/inpaint models, which model produces the
   best wheel replacement?

The pages below answer the second question for the current corrected rerun.

## Corrected Rerun

The previous frontier page included outputs generated with an old prompt that
asked for a matte-black wheel while the actual reference image was silver. That
made several rows visually misleading. The rerun below uses the corrected silver
prompt:

```text
Use the exact wheel design, color, finish, spoke pattern, center cap, and material from the reference image.
Preserve original scene lighting.
Do not alter car body, car color, background, road, tires, or unmasked pixels.
```

Cases:

- `ivan-C1`: daylight control case.
- `ivan-N1`: night case.
- `ivan-N2`: night wet-looking case. There is no explicit rain metadata in the
  local dataset, so this is not labeled as confirmed rain.

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/aitunnel-gpt-image-regression/corrected-rerun-c1-n1-n2-page-01.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/aitunnel-gpt-image-regression/corrected-rerun-c1-n1-n2-page-02.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/aitunnel-gpt-image-regression/corrected-rerun-c1-n1-n2-page-03.jpg}
\end{center}

\newpage

Corrected rerun status:

| Model | Cases | Status | Read |
| --- | --- | --- | --- |
| `gpt-image-1.5` via AITUNNEL | `C1`, `N1`, `N2` | 3/3 completed after one `N2` retry | best current OpenAI-compatible fallback through AITUNNEL |
| Gemini 3 Pro Image Edit via fal.ai | `C1`, `N1`, `N2` | 3/3 completed | no longer black, but often fails the edit task by cropping or generating product-wheel style outputs |
| Reve Direct masked corrected | `C1`, `N1`, `N2` | 3/3 completed | stable masked baseline |

`gpt-image-1.5` note: the first `N2` request failed with
`Server disconnected without sending a response`; a single retry completed.
This means AITUNNEL edits are usable but still have transport-level instability.

\newpage

## Rain Stress Cases

Additional user-provided images were tested with the same corrected silver
prompt and manually prepared wheel masks.

Cases:

- `rain-flood-bmw`: flooded road / water splash.
- `night-heavy-rain-sedan`: night heavy rain.
- `istock-rain-splash`: rain splash with visible stock watermark; this is a
  stress-test only, not a presentation-quality source.

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/aitunnel-gpt-image-regression/rain-rerun-page-01.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/aitunnel-gpt-image-regression/rain-rerun-page-02.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/aitunnel-gpt-image-regression/rain-rerun-page-03.jpg}
\end{center}

\newpage

Rain stress status:

| Model | Cases | Status | Read |
| --- | --- | --- | --- |
| `gpt-image-1.5` via AITUNNEL | `rain-flood-bmw`, `night-heavy-rain-sedan`, `istock-rain-splash` | 2/3 completed; `night-heavy-rain-sedan` failed twice | useful when it completes, but transport instability remains |
| Gemini 3 Pro Image Edit via fal.ai | all 3 rain cases | 3/3 completed | still inconsistent as masked car editor |
| Reve Direct masked corrected | all 3 rain cases | 3/3 completed | most stable under these stress cases |

\newpage

## Status Summary

Current corrected rerun:

| Model | Cases | Status | Result |
| --- | --- | --- | --- |
| `gpt-image-1.5` via AITUNNEL | `C1`, `N1`, `N2` | completed after one `N2` retry | usable OpenAI-compatible fallback |
| Gemini 3 Pro Image Edit via fal.ai | `C1`, `N1`, `N2` | completed | still not reliable for masked car edits |
| Reve Direct masked | `C1`, `N1`, `N2` | completed | stable masked baseline |
| `gpt-image-1.5` via AITUNNEL | rain stress cases | 2/3 completed; one case failed twice | transport instability remains |
| Gemini 3 Pro Image Edit via fal.ai | rain stress cases | completed | visually inconsistent |
| Reve Direct masked | rain stress cases | completed | stable |

AITUNNEL endpoint diagnostics:

| Model | Endpoint | Status |
| --- | --- | --- |
| `gpt-image-2` | `/v1/images/generations` | works |
| `gpt-image-2` | `/v1/images/edits` | fails: `Server disconnected without sending a response.` |
| `gpt-image-1.5` | `/v1/images/edits` with `image[] + image[] + mask` | works, but one transient disconnect on `N2` |
| `gpt-image-1-mini` | `/v1/images/edits` with `image[] + image[] + mask` | works |
| `gpt-image-1` | `/v1/images/edits` | fails: `Server disconnected without sending a response.` |

Conclusion:

- AITUNNEL now supports the required `image[] + mask` request shape for
  `gpt-image-1.5` and `gpt-image-1-mini`.
- `gpt-image-2` still fails on `/v1/images/edits`, including simpler edit
  control requests.
- For the current wheel-copy eval, `gpt-image-1.5` is the usable AITUNNEL model.

## GPT Image 2 Decision

`gpt-image-2` remains the main candidate to test as a potential Reve replacement
because it should support the exact request shape required by this product:

```text
source car + target wheel reference + alpha mask
```

Current AITUNNEL status:

- `gpt-image-2` is visible in `/v1/models`.
- `gpt-image-2` works for `/v1/images/generations`.
- `gpt-image-2` still fails for `/v1/images/edits`.
- The failure is transport-level disconnect, not a JSON validation error.

Operational decision:

- Do not block the report on `gpt-image-2`.
- Use AITUNNEL `gpt-image-1.5` as the current OpenAI-compatible fallback for
  demos and regression checks.
- Do not call `gpt-image-1.5` a full Reve replacement yet; it needs more cases
  and stability checks.
- Keep asking AITUNNEL support to fix `/v1/images/edits` for `gpt-image-2`.

## Next Steps

- Run the fine-tuned real/fake wheel classification model on generated outputs
  to separate true wheel-copy results from visually plausible but incorrect
  wheel generations.
- Improve wheel masking quality before the next model comparison; current manual
  and filtered masks are good enough for stress testing, but mask edge quality
  still affects rain, splash, and night cases.

## Output Files

- Corrected rerun summary CSV:
  `docs/assets/aitunnel-gpt-image-regression/corrected-rerun-c1-n1-n2-summary.csv`
- Rain stress summary CSV:
  `docs/assets/aitunnel-gpt-image-regression/rain-rerun-summary.csv`

## Raw Results

- `tmp/openai-image-edit-eval/results-aitunnel-gpt-image-15-corrected-c1-n1-n2/openai_image_edit_results.csv`
- `tmp/openai-image-edit-eval/results-aitunnel-gpt-image-15-corrected-n2-retry/openai_image_edit_results.csv`
- `tmp/fal-inpaint-eval/results-corrected-silver-gemini-c1-n1-n2/fal_inpaint_results.csv`
- `tmp/reve-image-edit-eval/results-corrected-silver-masked-c1-n1-n2/reve_image_edit_results.csv`
- `tmp/rain-wheel-eval/results-aitunnel-gpt-image-15/openai_image_edit_results.csv`
- `tmp/rain-wheel-eval/results-aitunnel-gpt-image-15-night-heavy-rain-retry/openai_image_edit_results.csv`
- `tmp/rain-wheel-eval/results-gemini/fal_inpaint_results.csv`
- `tmp/rain-wheel-eval/results-reve-masked/reve_image_edit_results.csv`
