import { readFile, writeFile } from "node:fs/promises";

const bundlePath = new URL("./harness.bundle.js", import.meta.url);
const bundle = await readFile(bundlePath, "utf8");
await writeFile(bundlePath, bundle.replace(/[ \t]+(?=\r?\n)/g, ""));
