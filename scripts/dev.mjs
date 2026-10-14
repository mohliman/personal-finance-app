import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const port = process.env.PORT ?? "4200";
const commands = [
  spawn(process.execPath, ["server/dist/index.mjs"], {
    stdio: "inherit",
    env: { ...process.env, PORT: port },
  }),
  spawn(
    process.execPath,
    [
      resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js"),
      "--host",
      "127.0.0.1",
    ],
    { stdio: "inherit" },
  ),
];
function stop() {
  for (const command of commands) command.kill();
}
for (const command of commands)
  command.on("exit", (code) => {
    stop();
    process.exit(code ?? 0);
  });
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
