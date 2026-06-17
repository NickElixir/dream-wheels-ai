---
geometry: landscape,margin=0.35in
fontsize: 10pt
header-includes:
  - \usepackage{graphicx}
---

# GPT Image 2 vs Reve 1.1 Head-to-Head

Date: 2026-06-17

## Scope

This report compares two competing masked wheel-edit paths on a 20-case dataset curated from the repository:

- 9 `ivan-*` clean car baselines with day/night coverage.
- 3 rain stress cases.
- 8 `wheel-labeling-*` stress cases with motorcycles and auto-rickshaws.

Common setup:

- same silver wheel reference image;
- same source image + mask + reference wheel request shape;
- `gpt-image-2` via official OpenAI `/v1/images/edits` with streaming transport;
- Reve direct masked remix via `version=latest` (API responses returned backend version `reve-remix@20250915`).

## Topline

| Model | First pass | After 1 retry | Notes |
| --- | --- | --- | --- |
| `gpt-image-2` | 18/20 completed | 19/20 completed | remaining failure: `wheel-labeling-026` |
| Reve masked | 19/20 completed | 20/20 completed | all cases completed after one retry |

Transport failures were disconnects rather than structured model-side validation errors.

## Failure Summary

| Model | First-pass failures | Final failures after retry |
| --- | --- | --- |
| `gpt-image-2` | `ivan-N3, wheel-labeling-026` | `wheel-labeling-026` |
| Reve masked | `wheel-labeling-026` | `-` |

## Dataset Selection Overview

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/selection-overview-page-01.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/selection-overview-page-02.jpg}
\end{center}

\newpage

## Output Overview

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/compare-overview-page-01.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/compare-overview-page-02.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/compare-overview-page-03.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/compare-overview-page-04.jpg}
\end{center}

\newpage

## Full-Size Detail Pages

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-01-ivan-C1.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-02-ivan-C2.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-03-ivan-C3.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-04-ivan-C4.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-05-ivan-C5.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-06-ivan-N1.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-07-ivan-N2.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-08-ivan-N3.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-09-ivan-N4.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-10-rain-flood-bmw.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-11-night-heavy-rain-sedan.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-12-istock-rain-splash.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-13-wheel-labeling-004.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-14-wheel-labeling-011.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-15-wheel-labeling-014.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-16-wheel-labeling-023.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-17-wheel-labeling-026.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-18-wheel-labeling-032.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-19-wheel-labeling-040.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/gpt-image-2-vs-reve11-report/detail-page-20-wheel-labeling-045.jpg}
\end{center}

\newpage

## Output Files

- Summary CSV: `docs/assets/gpt-image-2-vs-reve11-report/gpt-image-2-vs-reve11-summary.csv`
- OpenAI raw results: `tmp/model-compare-gpt2-vs-reve11/openai-results/openai_image_edit_results.csv`
- OpenAI retry results: `tmp/model-compare-gpt2-vs-reve11/openai-retry-results/openai_image_edit_results.csv`
- Reve raw results: `tmp/model-compare-gpt2-vs-reve11/reve-results/reve_image_edit_results.csv`
- Reve retry results: `tmp/model-compare-gpt2-vs-reve11/reve-retry-results/reve_image_edit_results.csv`
