import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setTimeout } from "node:timers/promises";
import { LargeDocuments } from "../server/largeDocuments";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "large-queue-test-"));
const config = { root, pipeline: path.resolve("server/pdf_pipelines"), model: "offline-test", fake: true, chunkSize: 20 };
let manager = new LargeDocuments(config);
const bytes = fs.readFileSync("/tmp/remedy-large-docs-qa/61-pages.pdf");
async function until(test: () => boolean) {
  const end = Date.now() + 45000;
  while (!test()) {
    assert(Date.now() < end, "Timed out waiting for queue");
    await setTimeout(40);
  }
}
try {
  await assert.rejects(manager.create("alice", "bad.pdf", "pdf", Buffer.from("not a PDF")), /Please upload/);
  for (const filename of ["over-limit.pdf", "encrypted.pdf"]) {
    await assert.rejects(manager.create("alice", filename, "pdf", fs.readFileSync("/tmp/remedy-large-docs-qa/" + filename)));
  }
  const [a, b] = await Promise.all([
    manager.create("alice", "fixture.pdf", "pdf", bytes),
    manager.create("alice", "fixture.pdf", "pdf", bytes),
  ]);
  assert.equal(a.id, b.id, "Duplicate concurrent upload created two jobs");
  assert.equal(manager.status(a.id, "bob"), null);
  assert.equal(manager.result(a.id, "bob"), null);
  assert.equal(manager.pause(a.id, "bob"), null);
  assert.equal(manager.resume(a.id, "bob"), null);
  assert.equal(manager.remove(a.id, "bob"), false);
  assert.deepEqual(manager.list("bob"), []);
  assert.throws(() => manager.remove(a.id, "alice"), /Pause/);
  manager.pause(a.id, "alice");
  await until(() => manager.status(a.id, "alice")?.state === "paused");
  manager.resume(a.id, "alice");
  await until(() => (manager.status(a.id, "alice")?.completedPages || 0) > 0);
  manager.close();
  await setTimeout(100);
  manager = new LargeDocuments(config);
  assert.equal(manager.status(a.id, "alice")?.state, "interrupted");
  manager.resume(a.id, "alice");
  await until(() => ["ready", "failed"].includes(manager.status(a.id, "alice")!.state));
  assert.equal(manager.status(a.id, "alice")?.state, "ready", manager.status(a.id, "alice")?.error);
  assert(fs.existsSync(manager.result(a.id, "alice")!.path));
  assert.equal(manager.status("../../etc/passwd", "alice"), null);
  const publicJob = manager.status(a.id, "alice")!;
  assert(!JSON.stringify(publicJob).includes(root));
  manager.close();
  const recordPath = path.join(root, a.id, "job.json");
  const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  record.expiresAt = Date.now() - 1;
  fs.writeFileSync(recordPath, JSON.stringify(record));
  manager = new LargeDocuments(config);
  assert.equal(manager.status(a.id, "alice"), null);
  assert.equal(fs.existsSync(path.join(root, a.id)), false);
  console.log("PASS: validation, concurrent deduplication, owner isolation, pause/resume, restart recovery, one PDF result, path isolation, expiry cleanup.");
} finally {
  manager.close();
  fs.rmSync(root, { recursive: true, force: true });
}
