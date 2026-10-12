// Offline integration: actual routes, SQLite ledger and Python renderers;
// only authentication/provider replies are mocked. Never uses the app database.
import {build} from "esbuild";
import {mkdtemp, cp, rm, symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const root=fileURLToPath(new URL("../",import.meta.url));
// storage.ts prefers /data when present. Refuse rather than touch a mounted DB.
import {existsSync} from "node:fs";
if(existsSync("/data")) throw new Error("Run this offline test outside the production /data environment.");
const dir=await mkdtemp(join(tmpdir(),"remedy-docs-integration-"));
try {
  await symlink(join(root,"node_modules"),join(dir,"node_modules"),"dir");
  await cp(join(root,"server/pdf_pipelines"),join(dir,"pdf_pipelines"),{recursive:true});
  await build({
    entryPoints:[join(root,"script/docs-qa/integration.ts")],
    outfile:join(dir,"integration.mjs"),bundle:true,platform:"node",format:"esm",packages:"external",
    alias:{"@shared":join(root,"shared"),"@clerk/backend":join(root,"script/docs-qa/mock-clerk.ts"),"@anthropic-ai/sdk":join(root,"script/docs-qa/mock-anthropic.ts")},
    banner:{js:"import {createRequire as _cr} from 'node:module'; import {fileURLToPath as _fu} from 'node:url'; const require=_cr(import.meta.url); const __dirname=_fu(new URL('.',import.meta.url));"},
  });
  const result=spawnSync(process.execPath,[join(dir,"integration.mjs")],{
    cwd:dir,stdio:"inherit",timeout:120000,
    env:{...process.env,STRIPE_SECRET_KEY:"",CLERK_SECRET_KEY:"",ANTHROPIC_API_KEY:"",RESEND_API_KEY:""},
  });
  if(result.error) throw result.error;
  process.exitCode=result.status ?? 1;
} finally {
  await rm(dir,{recursive:true,force:true});
}
