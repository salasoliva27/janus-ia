#!/usr/bin/env node
import { startServer } from "../bridge/server.js";

const PORT = parseInt(process.env.VENTURE_OS_PORT || "3100", 10);

async function main() {
  await startServer(PORT);
  console.log(`\n  Venture OS bridge running on http://localhost:${PORT}\n`);

  // In Codespace, open in browser
  if (process.env.CODESPACES) {
    try {
      // @ts-ignore - open may not be installed
      const open = await import(/* webpackIgnore: true */ "open");
      await open.default(`http://localhost:${PORT}`);
    } catch {
      // open not installed yet, fine for Phase 1
    }
  }
}

main().catch((err) => {
  console.error("Failed to start Venture OS:", err);
  process.exit(1);
});
