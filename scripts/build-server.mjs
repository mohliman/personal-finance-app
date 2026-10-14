import { build } from "esbuild";
await build({
  entryPoints: ["server/index.mjs"],
  outfile: "server/dist/index.mjs",
  bundle: true,
  external: ["libsql"],
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
});
