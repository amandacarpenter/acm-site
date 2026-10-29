import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setTimeout } from "node:timers/promises";
import express from "express";
import { registerLargeDocuments, LargeDocuments } from "../server/largeDocuments";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "large-access-"));
const bytes = fs.readFileSync("/tmp/remedy-large-docs-qa/61-pages.pdf");
const small = fs.readFileSync("/tmp/remedy-large-docs-qa/catalog-cover-portrait-map.pdf");
const balances = new Map([["alice",122], ["low",30]]);
const charges = new Map<string, {owner: string; pages: number; refunded: boolean}>();
let writes = 0, refunds = 0;
const billing = {
  async charge(id: string, owner: string, pages: number) {
    const prior = charges.get(id);
    if (prior) { assert(!prior.refunded); return; }
    if ((balances.get(owner) || 0) < pages) throw Object.assign(new Error("Not enough credits"), {status:402});
    balances.set(owner, balances.get(owner)! - pages);
    charges.set(id, {owner,pages,refunded:false}); writes++;
  },
  async refund(id: string, owner: string) {
    const charge = charges.get(id);
    if (!charge || charge.refunded) return;
    assert.equal(charge.owner, owner);
    charge.refunded = true; refunds++;
    balances.set(owner, (balances.get(owner) || 0) + charge.pages);
  },
};
const app = express();
const config = {root, pipeline:path.resolve("server/pdf_pipelines"), model:"offline-test", fake:true, production:true, minPages:51, billing};
const manager = registerLargeDocuments(app, config, (req,res,next) => {
  const owner = req.headers.authorization?.replace(/^Bearer /,"");
  if (!owner) return void res.sendStatus(401);
  res.locals.largeDocumentOwner=owner; next();
});
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(r=>server.once("listening",r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api/large-docs`;
const headers = (owner="alice") => ({Authorization:`Bearer ${owner}`});
function upload(mode="pdf", content=bytes, ack=true) {
  const form = new FormData();
  form.append("file",new Blob([content]),"fixture.pdf"); form.append("mode",mode);
  if (ack) form.append("longProcessingAcknowledged","true"); return form;
}
async function ready(id: string) {
  const end=Date.now()+60000;
  while(Date.now()<end) {
    const job = manager.status(id,"alice")!;
    if (["ready","failed"].includes(job.state)) return job;
    await setTimeout(80);
  }
  throw new Error("Timed out");
}
try {
  assert.equal((await fetch(base+"/jobs")).status,401);
  assert.equal((await fetch(base+"/jobs",{method:"POST",headers:headers(),body:upload("pdf",bytes,false)})).status,400);
  assert.equal((await fetch(base+"/jobs",{method:"POST",headers:headers(),body:upload("pdf",small)})).status,400);
  assert.equal(writes,0);
  assert.equal((await fetch(base+"/jobs",{method:"POST",headers:headers("low"),body:upload()})).status,402);
  assert.equal(writes,0);
  assert.equal(manager.list("low").length,0,"Definitive credit rejection leaves no retained upload");
  for (const mode of ["pdf","docx"]) {
    const response = await fetch(base+"/jobs",{method:"POST",headers:headers(),body:upload(mode)});
    assert.equal(response.status,202);
    const {job} = await response.json() as any;
    const duplicate = await fetch(base+"/jobs",{method:"POST",headers:headers(),body:upload(mode)});
    assert.equal((await duplicate.json() as any).job.id,job.id);
    for (const suffix of ["", "/result"]) assert.equal((await fetch(base+"/jobs/"+job.id+suffix,{headers:headers("bob")})).status,404);
    for (const action of ["pause","resume"]) assert.equal((await fetch(base+"/jobs/"+job.id+"/"+action,{method:"POST",headers:headers("bob")})).status,404);
    assert.equal((await fetch(base+"/jobs/"+job.id,{method:"DELETE",headers:headers("bob")})).status,404);
    const completed = await ready(job.id);
    assert.equal(completed.state,"ready",completed.error);
    const output = await fetch(base+"/jobs/"+job.id+"/result",{headers:headers()});
    assert.equal(output.status,200);
    assert((await output.arrayBuffer()).byteLength>100);
  }
  assert.equal(writes,2); assert.equal(refunds,0); assert.equal(balances.get("alice"),0);
  // Fresh manager loads both paid results and serves them without new credits.
  manager.close();
  const restarted = new LargeDocuments(config);
  assert.equal(restarted.list("alice").filter(j=>j.state==="ready").length,2);
  for (const job of restarted.list("alice")) assert(restarted.result(job.id,"alice"));
  restarted.close();
  console.log("PASS: signed-in endpoints, consent, source-page minimum, insufficient credits before processing, duplicate uploads, ownership on every action, one PDF and one DOCX, restart and zero-credit downloads.");
} finally { manager.close(); await new Promise<void>(r=>server.close(()=>r())); fs.rmSync(root,{recursive:true,force:true}); }

const failureRoot=fs.mkdtempSync(path.join(os.tmpdir(),"large-failure-"));
balances.set("alice",122);
const failed = new LargeDocuments({...config,root:failureRoot,pipeline:path.resolve("script/large-docs-qa/failing-worker")});
try {
  const job = await failed.create("alice","failure.pdf","pdf",bytes);
  async function refunded(count:number) {
    const end=Date.now()+5000;
    while (refunds<count && Date.now()<end) await setTimeout(30);
    assert.equal(refunds,count);
    // Let the terminal job-save complete after the refund hook.
    await setTimeout(30);
  }
  await refunded(1);
  assert.equal(balances.get("alice"),122);
  await failed.resumeAuthorized(job.id,"alice"); await refunded(2);
  assert.equal(balances.get("alice"),122);
  await failed.removeAuthorized(job.id,"alice");
  assert.equal(refunds,2);
  console.log("PASS: processing failure refund, fresh reservation on refunded retry, repeated failure, no extra refund on deletion.");
} finally { failed.close(); fs.rmSync(failureRoot,{recursive:true,force:true}); }
