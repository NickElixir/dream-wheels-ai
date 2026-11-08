"use client";

/* eslint-disable @next/next/no-img-element -- Same-origin Basic-auth media routes must bypass the public image optimizer. */
import { useEffect, useRef, useState } from "react";

export type GalleryImage = {
  kind: string;
  title: string;
  url: string | null;
  metadata: string;
  emptyMessage: string;
};

function MediaImage({ image, onExpand }: { image: GalleryImage; onExpand?: () => void }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!image.url) return <div className="media-empty">{image.emptyMessage}</div>;
  if (failed) return <div className="media-empty" role="status">
    <span>File unavailable or could not be loaded.</span>
    <button className="admin-button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry</button>
  </div>;
  const src = `${image.url}?attempt=${attempt}`;
  return onExpand ? <button className="media-open" onClick={onExpand} aria-label={`Expand ${image.title}`}>
    <img src={src} alt={image.title} onError={() => setFailed(true)} loading="lazy" referrerPolicy="no-referrer" />
  </button> : <img src={src} alt={image.title} onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
}

export function JobGallery({ images, information }: { images: GalleryImage[]; information: React.ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const available = images.filter((image) => image.url);
  useEffect(() => {
    if (active !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [active]);
  function move(delta: number) {
    setZoom(false);
    setActive((index) => index === null ? null : (index + delta + available.length) % available.length);
  }
  function card(image: GalleryImage) {
    return <section className="admin-panel media-card" key={image.kind}>
      <h2>{image.title}</h2>
      <div className="media-frame"><MediaImage image={image} onExpand={image.url ? () => {
        setZoom(false); setActive(available.findIndex((item) => item.kind === image.kind));
      } : undefined} /></div>
      <footer><span className="muted">{image.metadata}</span>
        {image.url && <div className="media-actions">
          <button className="admin-button" onClick={() => { setZoom(false); setActive(available.findIndex((item) => item.kind === image.kind)); }}>Expand</button>
          <a className="admin-button" href={image.url} target="_blank" rel="noreferrer">Open original ↗</a>
        </div>}
      </footer>
    </section>;
  }
  return <>
    <div className="comparison-grid">{images.slice(0, 2).map(card)}</div>
    <div className="job-bottom">{images.slice(2).map(card)}{information}</div>
    <dialog className="image-dialog" ref={dialog} onClose={() => setActive(null)} onCancel={() => setActive(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      }} aria-label="Job images">
      {active !== null && available[active] && <>
        <header><strong>{available[active].title}</strong><div className="media-actions">
          <button className="admin-button" onClick={() => move(-1)} aria-label="Previous image">←</button>
          <button className="admin-button" onClick={() => move(1)} aria-label="Next image">→</button>
          <button className="admin-button" onClick={() => setZoom(!zoom)}>{zoom ? "Fit" : "Zoom 2×"}</button>
          <button className="admin-button" onClick={() => setActive(null)} autoFocus>Close</button>
        </div></header>
        <div className={`dialog-image ${zoom ? "is-zoomed" : ""}`} key={available[active].kind}>
          <MediaImage image={available[active]} />
        </div>
        <p className="muted">Arrow keys switch images · Esc closes · Scroll to explore when zoomed</p>
      </>}
    </dialog>
  </>;
}
