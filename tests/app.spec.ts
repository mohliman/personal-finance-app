import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
test("authenticated finance workflows, database persistence, accessibility, and mobile layout", async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["scripts/fullstack-verify.mjs"],
    { cwd: process.cwd(), timeout: 80000 },
  );
  const report = JSON.parse(stdout.trim());
  expect(report.passed).toBe(9);
});
