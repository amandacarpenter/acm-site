import assert from "node:assert/strict";
import { runDocumentProcess } from "../server/documentProcess";

const node = process.execPath;
let passed = 0;
async function check(name: string, work: () => Promise<void>) {
  await work();
  console.log("PASS", name);
  passed++;
}
await check("successful renderer consumes input", async () => {
  await runDocumentProcess(node, ["-e", "process.stdin.resume();"], "example", 5000);
});
await check("early renderer failure does not crash parent with EPIPE", async () => {
  await assert.rejects(
    runDocumentProcess(node, ["-e", "process.stderr.write('synthetic import failure'); process.exit(1)"], "x".repeat(16 * 1024 * 1024), 5000),
    /synthetic import failure/,
  );
});
await check("early success without consuming input fails safely", async () => {
  await assert.rejects(
    runDocumentProcess(node, ["-e", "process.exit(0)"], "x".repeat(16 * 1024 * 1024), 5000),
    /Document renderer failed/,
  );
});
await check("missing renderer command rejects without unhandled stream error", async () => {
  await assert.rejects(runDocumentProcess("/nonexistent-remedy-renderer", [], "x".repeat(1024 * 1024), 5000), /ENOENT/);
});
await check("renderer timeout terminates only its child process", async () => {
  await assert.rejects(runDocumentProcess(node, ["-e", "setInterval(()=>{},1000)"], "example", 100), /SIGKILL/);
});
await check("stdout is drained instead of blocking the renderer", async () => {
  await runDocumentProcess(node, ["-e", "process.stdin.resume();process.stdout.write('x'.repeat(1024*1024))"], "example", 5000);
});
await check("another render succeeds after failures", async () => {
  await runDocumentProcess(node, ["-e", "process.stdin.resume();"], "example", 5000);
});
console.log(`${passed} document subprocess checks passed.`);
