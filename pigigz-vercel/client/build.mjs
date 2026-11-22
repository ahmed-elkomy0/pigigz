// Client bundle for PiGigz — standalone build.
//
// This replicates the canonical @hatch/space-sdk/build configuration
// (entrypoint, outdir, production NODE_ENV define, asset naming, Tailwind
// plugin, bare-asset-URL fix-up) so the exact same production bundle is
// produced everywhere — including a plain `bun install && bun run build`
// on Vercel from GitHub, with no Hatch-internal paths or build driver.
// The platform version compiled in as __HATCH_SPACE_PLATFORM_VERSION__
// is read from space.json when present (the SDK client runtime checks it).

import { cp, readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindPlugin from "bun-plugin-tailwind";

const ENTRY = "./client/index.html";
const OUTDIR = "./client/dist";
const PDFJS_ASSET_ROOT = "./assets/pdfjs/";

if (typeof Bun === "undefined" || typeof Bun.build !== "function") {
  throw new Error("build.mjs must run under Bun");
}

await rm(OUTDIR, { force: true, recursive: true });

const platformVersion = await readFile("./space.json", "utf8")
  .then((text) => JSON.parse(text).platformVersion)
  .catch(() => undefined);

const result = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUTDIR,
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    __HATCH_SPACE_PLATFORM_VERSION__: JSON.stringify(
      typeof platformVersion === "number" ? platformVersion : 0,
    ),
  },
  naming: {
    asset: "assets/[name]-[hash].[ext]",
    chunk: "assets/[name]-[hash].[ext]",
    entry: "[name].[ext]",
  },
  plugins: [tailwindPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  throw new Error("client build failed; see logged diagnostics");
}

// Bun writes imported assets to `assets/<name>-<hash>.<ext>` but emits the
// JS/CSS import URL as a bare `./<name>-<hash>.<ext>` — without the `assets/`
// prefix. Re-prefix only the bare imported-asset URLs to `./assets/...` so
// they resolve both on the spaces daemon route and on static hosting.
const assetFiles = result.outputs
  .filter((output) => output.kind === "asset")
  .map((output) => basename(output.path));
let needsPdfjsAssets = false;
for (const output of result.outputs) {
  if (!/\.(js|css|html)$/.test(output.path)) {
    continue;
  }
  let text = await output.text();
  needsPdfjsAssets ||= text.includes(PDFJS_ASSET_ROOT);
  let changed = false;
  for (const name of assetFiles) {
    const bare = `./${name}`;
    if (text.includes(bare)) {
      text = text.split(bare).join(`./assets/${name}`);
      changed = true;
    }
  }
  if (changed) {
    await Bun.write(output.path, text);
  }
}

if (needsPdfjsAssets) {
  // The pdf.js assets ship inside the @hatch/space-sdk package; locate them
  // relative to its installed build module so this works from node_modules
  // wherever the package was installed from (vendored tarball included).
  const sdkBuildPath = fileURLToPath(
    import.meta.resolve("@hatch/space-sdk/build"),
  );
  await cp(join(dirname(sdkBuildPath), "pdfjs-assets"), join(OUTDIR, "assets", "pdfjs"), {
    recursive: true,
  });
}
