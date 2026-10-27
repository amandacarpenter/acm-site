import assert from "node:assert/strict";
import { once } from "node:events";
import Database from "better-sqlite3";
import express from "express";
import { TrialLedger, createCreditAccessMiddleware, reserveTrialCredits, trialDeduction } from "../server/trialCredits";
import { registerFreeTrialRoutes, hashTrialEmail } from "../server/freeTrial";
import { FREE_TRIAL_MS } from "../shared/trial";

// Isolated, in-memory database; no Clerk, Stripe, email, AI, or production calls.
const db = new Database(":memory:");
const ledger = new TrialLedger(db);
const users: Record<string, any> = {};
for (const id of ["free","second","unverified","legacy","paid","team","comp","cancelled","outage","org","expire","over","fail","race"]) {
  users[id] = { publicMetadata:{}, primaryEmailAddress:{emailAddress:`${id}@example.test`,verification:{status:"verified"}} };
}
users.second.primaryEmailAddress.emailAddress = "FREE@EXAMPLE.TEST";
users.unverified.primaryEmailAddress.verification.status = "unverified";
users.legacy.publicMetadata = { plan:"trial",subscribed:true,trialCreditLimit:140 };
users.paid.publicMetadata = { plan:"individual",subscribed:true };
users.team.publicMetadata = { plan:"team",subscribed:true };
users.comp.publicMetadata = { subscribed:true };
users.cancelled.publicMetadata = { plan:"individual",subscribed:false,stripeCustomerId:"cus_example" };
const teamIds = new Set(["org"]);
const deps = {
  ledger,
  verify: async (token:string) => { if (!users[token]) throw Error("Invalid session"); return {sub:token}; },
  getUser: async (id:string) => { if (id==="outage") throw Error("Provider unavailable"); return users[id]; },
  hasTeam: async (id:string) => teamIds.has(id),
};
const app=express(); app.use(express.json());
registerFreeTrialRoutes(app,deps);
app.use("/process",createCreditAccessMiddleware(deps));
app.post("/process",async(req,res)=>{
  try {
    reserveTrialCredits(req.body.cost);
    if (req.body.fail) return res.status(500).json({error:"Simulated failure"});
    res.json({userId:res.locals.creditUserId,...trialDeduction(res.locals.creditUserId,req.body.cost)});
  } catch (e:any) { res.status(e.status || 500).json({error:e.message}); }
});
const server=app.listen(0,"127.0.0.1"); await once(server,"listening");
const base=`http://127.0.0.1:${(server.address() as any).port}`;
let passed=0;
function check(name:string,fn:()=>void) { fn();passed++;console.log("PASS",name); }
async function request(token:string|null,path="/api/free-trial",body?:any) {
  const res=await fetch(base+path,{
    method:body ? "POST":"GET",
    headers:{"Content-Type":"application/json",...(token ? {Authorization:`Bearer ${token}`}:{})},
    ...(body ? {body:JSON.stringify(body)}:{}),
  });
  return {status:res.status,data:await res.json()};
}
const start=(id:string)=>request(id,"/api/free-trial/start",{acceptTerms:true,clerkUserId:"paid",credits:999,duration:999});
try {
  const anon=await request(null); const bad=await request("bad");
  check("authenticated subject required",()=>{assert.equal(anon.status,401);assert.equal(bad.status,401);});
  const eligible=await request("free");
  check("reading eligibility grants nothing",()=>{assert.equal(eligible.data.state,"eligible");assert.equal(ledger.hasGrant("free"),false);});
  const noConsent=await request("free","/api/free-trial/start",{acceptTerms:false});
  check("explicit activation and terms required",()=>assert.equal(noConsent.status,400));
  const first=await start("free");
  check("verified activation grants exactly 30 for exactly 14 days",()=>{
    assert.equal(first.status,200);assert.equal(first.data.state,"active");assert.equal(first.data.remaining,30);
    assert.equal(first.data.expiresAt-first.data.startsAt,FREE_TRIAL_MS);
    assert.equal(ledger.hasGrant("paid"),false);
  });
  check("activation never modifies subscription metadata",()=>assert.deepEqual(users.free.publicMetadata,{}));
  const repeat=await start("free");
  check("repeat clicks preserve grant and clock",()=>assert.deepEqual(repeat.data,first.data));
  const duplicate=await start("second");
  check("case-insensitive verified email cannot get a second grant",()=>{assert.equal(duplicate.status,403);assert.equal(ledger.hasGrant("second"),false);});
  check("no raw email stored in trial table",()=>assert.equal((db.prepare("SELECT email_hash FROM free_trial_activations WHERE user_id='free'").get() as any).email_hash,hashTrialEmail("free@example.test")));
  for (const id of ["unverified","legacy","paid","team","comp","cancelled","org"]) {
    const result=await start(id);
    check(`${id} activation blocked without creating a grant`,()=>{assert.equal(result.status,403);assert.equal(ledger.hasGrant(id),false);});
  }
  const outage=await start("outage");
  check("identity service outage fails closed",()=>assert.equal(outage.status,503));
  const concurrent=await Promise.all(Array.from({length:8},()=>start("race")));
  check("simultaneous activations still one allowance",()=>{assert.equal(concurrent.every(r=>r.status===200),true);assert.equal(ledger.balance("race",30).allocated,30);});
  check("grant and expiry survive a database snapshot/reopen",()=>{
    const restored = new Database(db.serialize());
    const restoredLedger = new TrialLedger(restored);
    assert.deepEqual(restoredLedger.activation("free"),ledger.activation("free"));
    assert.deepEqual(restoredLedger.balance("free",30),ledger.balance("free",30));
    restored.close();
  });
  const debit=await request("free","/process",{cost:3,clerkUserId:"paid"});
  check("trial can process; posted identity ignored",()=>{assert.equal(debit.status,200);assert.equal(debit.data.userId,"free");assert.equal(debit.data.creditsRemaining,27);});
  await start("fail");
  const failure=await request("fail","/process",{cost:4,fail:true});
  check("failed processing restores original Credits",()=>{assert.equal(failure.status,500);assert.equal(ledger.balance("fail",30).remaining,30);});
  await start("over");
  const jobs=await Promise.all(Array.from({length:8},()=>request("over","/process",{cost:10})));
  check("simultaneous jobs cannot exceed 30 Credits",()=>{assert.equal(jobs.filter(r=>r.status===200).length,3);assert.equal(ledger.balance("over",30).remaining,0);});
  const exhausted=await request("over");
  check("exhausted status and processing lock",()=>assert.equal(exhausted.data.state,"exhausted"));
  const exp=await start("expire");
  ledger.reserve("expire","already-accepted",2);
  const clock=Date.now;
  Date.now=()=>exp.data.expiresAt;
  try {
    const expired=await request("expire");const blocked=await request("expire","/process",{cost:1});
    check("exact expiry cutoff blocks new processing and shows zero available",()=>{assert.equal(expired.data.state,"expired");assert.equal(expired.data.remaining,0);assert.equal(blocked.status,402);});
    const retry=await start("expire");
    check("expired activation cannot restart clock",()=>assert.equal(retry.data.expiresAt,exp.data.expiresAt));
    check("ledger also rejects a new debit after expiry",()=>assert.throws(()=>ledger.reserve("expire","late",1)));
    check("accepted reservation can finish after expiry",()=>assert.equal(ledger.reserve("expire","already-accepted",2).remaining,28));
    ledger.refund("already-accepted","expire");
    const refunded=await request("expire");
    check("refund after expiry does not reopen trial",()=>{assert.equal(refunded.data.state,"expired");assert.equal(refunded.data.remaining,0);});
  } finally {Date.now=clock;}
  users.free.publicMetadata={plan:"individual",subscribed:true,stripeCustomerId:"cus_upgraded"};
  const upgraded=await request("free","/process",{cost:100});
  const upgradeStatus=await request("free");
  check("paid plan overrides trial without consuming its remaining Credits",()=>{assert.equal(upgraded.status,200);assert.equal(upgradeStatus.data.state,"ineligible");assert.equal(ledger.balance("free",30).remaining,27);});
  const legacy=await request("legacy","/process",{cost:1});
  check("legacy trial keeps original allocation and no expiry",()=>{assert.equal(legacy.status,200);assert.equal(ledger.balance("legacy",140).remaining,139);assert.equal(ledger.activation("legacy"),null);});
  teamIds.add("race");
  const joined=await request("race","/process",{cost:1});
  check("joining a team cannot keep using public trial entitlement",()=>assert.equal(joined.status,403));
  console.log(`\n${passed} public-trial checks passed. No external service calls.`);
} finally {await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
