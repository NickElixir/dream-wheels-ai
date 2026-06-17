---
geometry: landscape,margin=0.35in
fontsize: 10pt
header-includes:
  - \usepackage{graphicx}
---

# Skolkovo No-Mask Wheel Try-On

Date: 2026-06-17

## Scope

This report uses deduplicated Skolkovo transport photos without masks.

- input pool: 61 local photos;
- deduplicated representative transport subjects: 24;
- common wheel reference: silver multi-spoke alloy wheel;
- OpenAI path: `gpt-image-2` no-mask edit with source + reference image;
- Reve path: direct no-mask remix with source + reference image.

## Topline

| Model | Final completed | Notes |
| --- | --- | --- |
| `gpt-image-2` no-mask | 18/24 | final hard-fails: `skolkovo-white-mercedes-sedan, skolkovo-gray-audi-etron, skolkovo-blue-bus, skolkovo-black-luxury-suv, skolkovo-blue-motorcycle, skolkovo-black-motorcycle` |
| Reve no-mask | 24/24 | all deduplicated Skolkovo cases completed |

\begin{center}
\includegraphics[width=\textwidth,height=0.90\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/cover-page.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-01-skolkovo-bmw-x5-black.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-02-skolkovo-zeekr-yellow.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-03-skolkovo-range-rover-black.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-04-skolkovo-porsche-gray-sedan.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-05-skolkovo-police-crossover.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-06-skolkovo-audi-silver-crossover.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-07-skolkovo-porsche-black-red-calipers.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-08-skolkovo-white-mercedes-sedan.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-09-skolkovo-black-coupe-suv.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-10-skolkovo-white-sportback.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-11-skolkovo-white-delivery-van.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-12-skolkovo-gray-audi-etron.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-13-skolkovo-blue-bus.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-14-skolkovo-black-luxury-suv.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-15-skolkovo-black-mustang.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-16-skolkovo-black-sedan-city.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-17-skolkovo-bronze-suv-field.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-18-skolkovo-blue-motorcycle.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-19-skolkovo-black-motorcycle.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-20-skolkovo-orange-rental-bike.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-21-skolkovo-orange-scooter.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-22-skolkovo-gray-mercedes-suv.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-23-skolkovo-yellow-shuttle-van.jpg}
\end{center}

\newpage

\begin{center}
\includegraphics[width=\textwidth,height=0.94\textheight,keepaspectratio]{docs/assets/skolkovo-no-mask-report/case-page-24-skolkovo-white-compact-car.jpg}
\end{center}

\newpage

## Output Files

- Summary CSV: `docs/assets/skolkovo-no-mask-report/skolkovo-no-mask-summary.csv`
- Archive root: `/Users/nikolai/Documents/Dream Wheel AI/images/virtual_tryon_archive/skolkovo-no-mask-2026-06-17`
