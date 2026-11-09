import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { JobPreview } from "../src/components/job-preview.tsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("a temporary preview failure can be retried after a server refresh", async () => {
  const url = "/api/jobs/test/assets/result";
  let renderer;
  try {
    await act(() => { renderer = create(createElement(JobPreview, { url })); });
    const firstImage = renderer.root.findByType("img");
    assert.equal(firstImage.props.src, url);
    await act(() => firstImage.props.onError());
    assert.equal(renderer.root.findAllByType("img").length, 0);
    // Same component identity/props: router.refresh preserves this local state.
    await act(() => renderer.update(createElement(JobPreview, { url })));
    const retry = renderer.root.findByType("button");
    assert.equal(retry.props.type, "button");
    assert.equal(retry.props["aria-label"], "Retry result preview");
    await act(() => retry.props.onClick());
    assert.equal(renderer.root.findByType("img").props.src, `${url}?attempt=1`);
    assert.equal(renderer.root.findAllByType("button").length, 0);
    await act(() => renderer.root.findByType("img").props.onError());
    await act(() => renderer.root.findByType("button").props.onClick());
    assert.equal(renderer.root.findByType("img").props.src, `${url}?attempt=2`);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test("no attached result shows a placeholder without a retry control", async () => {
  let renderer;
  try {
    await act(() => { renderer = create(createElement(JobPreview, { url: null })); });
    assert.equal(renderer.root.findByType("span").props.children, "No preview");
    assert.equal(renderer.root.findAllByType("button").length, 0);
    assert.equal(renderer.root.findAllByType("img").length, 0);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});
