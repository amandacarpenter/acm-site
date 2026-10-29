// Preview-only response fixtures. No request reaches a production API.
let state = new URLSearchParams(location.search).get("qaUser")==="paid" ? "ineligible" : new URLSearchParams(location.search).get("qaState") || "eligible";
let remaining=30;
const startsAt=Date.now(),expiresAt=startsAt+14*86400000;
const realFetch=window.fetch.bind(window);
window.fetch=async (input,init) => {
  const url=String(input);
  if (!url.startsWith("/api/")) return realFetch(input,init);
  const json=(value:any,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}}));
  if (url==="/api/incident-status") return json({active:false});
  if (url==="/api/large-docs/config") return json({minPages:51,maxPages:400,maxMegabytes:25,retentionHours:24,creditsPerPage:1,production:true});
  if (url==="/api/large-docs/jobs" && (!init?.method || init.method==="GET")) return json({jobs:[]});
  if (url==="/api/large-docs/jobs") return json({error:"Preview only: this document needs 61 credits; the sample account has 30. No processing or charge was made."},402);
  if (url.startsWith("/api/free-trial")) {
    if (state==="error") return json({error:"Preview of a temporary service problem. Please try again."},503);
    if (url.endsWith("/start")) state="active";
    const active=["active","expired","exhausted"].includes(state);
    return json({state,allocated:30,remaining:state==="expired"||state==="exhausted"?0:remaining,
      startsAt:active?startsAt:null,expiresAt:active?expiresAt:null,
      message:state==="expired"?"Your 14-day trial has ended. No charge was made.":state==="exhausted"?"Your trial Credits are used up.":state==="verification_required"?"Verify your primary email address before starting your trial.":"Sample trial account."});
  }
  if (url.startsWith("/api/usage/status")) return json({plan:"trial",monthlyUsed:30-remaining,monthlyLimit:30,purchasedCredits:0,creditsRemaining:state==="expired"?0:remaining,resetDate:null,creditPeriod:"one_time",trialExpiresAt:expiresAt,trialExpired:state==="expired"});
  if (url.startsWith("/api/jobs/recent")) return json({jobs:[]});
  if (url.startsWith("/api/kb/sections") || url.startsWith("/api/kb/search")) return json([]);
  if (url.includes("/usage") || url.includes("/analytics")) return json({ok:true});
  return json({error:"This is a preview. Uploads, payments, messaging, and administration are disabled."},403);
};
const banner=document.createElement("div");
banner.textContent="DESIGN PREVIEW ONLY · Sample account · No real signup, payments, or processing";
banner.setAttribute("role","note");
banner.style.cssText="background:#111827;color:white;padding:10px 20px;text-align:center;font:13px/1.5 system-ui";
document.body.prepend(banner);
