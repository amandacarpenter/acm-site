"""Explicitly invoked production QA. Tokens stay in RAM, never in reports."""
import argparse
import json
from pathlib import Path
import time
import requests

USER = "user_3LM3EbKOkIjpM8y56WVxTFrTtSc"
BASE = "https://remedy508.com"
ROOT = Path("/tmp/remedy-large-production-qa")
ROOT.mkdir(mode=0o700, exist_ok=True)
STATE = ROOT / "state.json"
state = json.loads(STATE.read_text()) if STATE.exists() else {"jobs": {}}
clerk_http = requests.Session()  # Saved host-scoped credential proxy only for Clerk.
http = requests.Session()  # Public app traffic uses the QA user's ordinary session JWT.
http.trust_env = False
token_cache = {"value": None, "until": 0}

def save():
    STATE.write_text(json.dumps(state, indent=2))
    STATE.chmod(0o600)

def checked(response, expected=200):
    if response.status_code != expected:
        try:
            detail = response.json().get("errors", response.json().get("error", ""))
        except Exception:
            detail = "Response not JSON"
        # Auth values and headers are never included.
        raise RuntimeError(f"HTTP {response.status_code}: {str(detail)[:400]}")
    return response.json()

def token():
    if not state.get("session"):
        raise RuntimeError("Sign in the internal QA account through the normal Clerk ticket flow first.")
    if time.monotonic() >= token_cache["until"]:
        token_cache["value"] = checked(clerk_http.post(f"https://api.clerk.com/v1/sessions/{state['session']}/tokens", json={}, timeout=30))["jwt"]
        token_cache["until"] = time.monotonic() + 40
    return token_cache["value"]

def headers():
    return {"Authorization":"Bearer "+token()}

def balance():
    return checked(http.get(BASE+"/api/usage/status",params={"clerkUserId":USER},timeout=30))

def upload(mode, data=None, consent=True):
    return http.post(BASE+"/api/large-docs/jobs", headers=headers(),
        files={"file":("Remedy-Large-Production-QA.pdf",data or (ROOT/"source.pdf").read_bytes(),"application/pdf")},
        data={"mode":mode,"longProcessingAcknowledged":str(consent).lower()},timeout=90)

parser=argparse.ArgumentParser()
parser.add_argument("action",choices=["ticket","auth","prepare","run","status"])
parser.add_argument("--source")
args=parser.parse_args()
if args.action == "ticket":
    result=checked(clerk_http.post("https://api.clerk.com/v1/sign_in_tokens",json={"user_id":USER,"expires_in_seconds":900},timeout=30))
    target=ROOT/"signin-ticket.json"
    target.write_text(json.dumps({"token":result["token"],"id":result["id"]}))
    target.chmod(0o600)
    print("Short-lived QA sign-in ticket saved privately for the isolated browser; no token logged.")
elif args.action == "prepare":
    import pymupdf as fitz
    with fitz.open(args.source) as original, fitz.open() as sample:
        sample.insert_pdf(original,from_page=0,to_page=50)
        sample.save(ROOT/"source.pdf",garbage=4,deflate=True)
    print("Prepared 51 actual catalog source pages; not synthetic padding.")
elif args.action == "auth":
    response=http.get(BASE+"/api/remedy-docs/jobs/latest",headers=headers(),timeout=30)
    checked(response)
    print(json.dumps({"authenticated":True,"balance":balance(),"user":USER}))
elif args.action == "status":
    for mode,id in state["jobs"].items():
        print(json.dumps({"mode":mode,**checked(http.get(BASE+"/api/large-docs/jobs/"+id,headers=headers(),timeout=30))}))
else:
    configuration=checked(http.get(BASE+"/api/large-docs/config",headers=headers(),timeout=30))
    assert configuration["production"] and not configuration["workflowTest"]
    assert configuration["minPages"]==51 and configuration["creditsPerPage"]==1
    assert http.get(BASE+"/api/large-docs/jobs",timeout=30).status_code==401
    if not state.get("initial"):
        state["initial"]=balance()
        assert state["initial"]["creditsRemaining"]==130
        assert upload("pdf",consent=False).status_code==400
        save()
    deadline=time.monotonic()+650
    for mode in ["pdf","docx"]:
        if mode not in state["jobs"]:
            created=checked(upload(mode),202)["job"]
            assert created["totalPages"]==51
            state["jobs"][mode]=created["id"]; save()
            duplicate=checked(upload(mode),202)["job"]
            assert duplicate["id"]==created["id"]
            print(json.dumps({"started":mode,"id":created["id"],"balance":balance()}),flush=True)
        id=state["jobs"][mode]
        last_stage=None
        while True:
            job=checked(http.get(BASE+"/api/large-docs/jobs/"+id,headers=headers(),timeout=30))["job"]
            stage=(job["state"],job["completedPages"])
            if stage!=last_stage:
                print(json.dumps({"mode":mode,"state":job["state"],"pages":job["completedPages"],"stage":job["stage"]}),flush=True)
                last_stage=stage
            if job["state"]=="ready":
                response=http.get(BASE+"/api/large-docs/jobs/"+id+"/result",headers=headers(),timeout=120)
                assert response.status_code==200
                output=ROOT/("SCC-51-Pages-Production-QA."+mode)
                output.write_bytes(response.content); output.chmod(0o600)
                assert len(response.content)>1000
                current=balance()
                assert current["creditsRemaining"]==130-51*len(state["jobs"])
                print(json.dumps({"downloaded":mode,"bytes":len(response.content),"balance":current}),flush=True)
                break
            if job["state"]=="failed":
                print(json.dumps({"failed":job,"balance":balance()}),flush=True)
                raise SystemExit(2)
            if time.monotonic()>deadline:
                print("QA poll window ended. Jobs remain saved; rerun to continue.")
                raise SystemExit(3)
            time.sleep(3)
    insufficient=upload("pdf",(ROOT/"source.pdf").read_bytes()+b"\n% distinct low-credit QA attempt\n")
    assert insufficient.status_code==402,insufficient.status_code
    assert balance()["creditsRemaining"]==28
    state["checksPassed"]=True;save()
    print("PASS production: real auth, consent, 51-page PDF and Word, exact pooled credits, duplicate reuse, insufficient-credit rejection.")
