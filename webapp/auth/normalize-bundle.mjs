import { readFile, writeFile } from "node:fs/promises";

const bundlePath = new URL(process.argv[2] || "./harness.bundle.js", import.meta.url);
const bundle = await readFile(bundlePath, "utf8");
await writeFile(bundlePath, bundle.replace(/[ \t]+(?=\r?\n)/g, ""));
