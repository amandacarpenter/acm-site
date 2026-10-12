import express from "express";
import {createServer} from "node:http";
import {execFileSync} from "node:child_process";
import {readFileSync, writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import {PDFDocument, StandardFonts} from "pdf-lib";
import {registerRoutes} from "../../server/routes";
import {trialLedger, documentTaskStore} from "../../server/storage";
import {calls} from "./mock-anthropic";
import {Document,Packer,Paragraph,ImageRun} from "docx";

const app=express(); app.use(express.json());
const server=createServer(app); registerRoutes(server,app);
await new Promise<void>(resolve=>server.listen(5184,"127.0.0.1",resolve));
const base="http://127.0.0.1:5184";
const pdf=await PDFDocument.create(); const font=await pdf.embedFont(StandardFonts.Helvetica);
pdf.addPage().drawText("Diagnostic fixture. This paragraph contains more than fifty characters for extraction.",{x:40,y:700,font,size:10});
const bytes=await pdf.save();
const headers=(who="owner")=>({Authorization:`Bearer ${who}`});
function upload(mode="pdf",name="fixture.pdf",content:Uint8Array=bytes){const form=new FormData();form.append("file",new Blob([content],{type:"application/pdf"}),name);form.append("mode",mode);return form;}
async function ready(id:string){for(let i=0;i<300;i++){const r=await fetch(`${base}/api/remedy-docs/jobs/${id}`,{headers:headers()});const {job}=await r.json() as any;if(["ready","failed"].includes(job.state))return job;await new Promise(r=>setTimeout(r,100));}throw new Error("Test timed out");}
try{
  const denied=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",body:upload()});
  assert.equal(denied.status,401);
  const t=Date.now();const admission=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload()});
  assert.equal(admission.status,202);const {job}=await admission.json() as any;
  assert.ok(Date.now()-t<2000);console.log("PASS actual routes: 202 before document processing",Date.now()-t,"ms");
  const hidden=await fetch(`${base}/api/remedy-docs/jobs/${job.id}`,{headers:headers("other")});assert.equal(hidden.status,404);
  assert.equal((await fetch(`${base}/api/remedy-docs/jobs/${job.id}/result`,{headers:headers("other")})).status,404);
  const duplicate=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload()});assert.equal((await duplicate.json() as any).job.id,job.id);
  const result=await ready(job.id);console.log("Terminal job:",result);assert.equal(result.state,"ready",result.error);
  const first=await fetch(`${base}/api/remedy-docs/jobs/${job.id}/result`,{headers:headers()});
  assert.equal(first.status,200);assert.equal(first.headers.get("content-type"),"application/pdf");
  assert.ok(Buffer.from(await first.arrayBuffer()).subarray(0,5).toString()==="%PDF-");
  assert.equal(first.headers.get("cache-control"),"no-store");
  const callsBefore=calls, balanceBefore=trialLedger.balance("owner",140).remaining;
  const second=await fetch(`${base}/api/remedy-docs/jobs/${job.id}/result`,{headers:headers()});assert.equal(second.status,200);
  assert.equal(calls,callsBefore);assert.equal(trialLedger.balance("owner",140).remaining,balanceBefore);assert.equal(balanceBefore,139);
  const latest=await fetch(`${base}/api/remedy-docs/jobs/latest`,{headers:headers()});assert.equal((await latest.json() as any).job.id,job.id);
  console.log("PASS actual routes: PDF render, status, owner isolation, duplicate-upload reuse, refresh discovery, repeated download, exactly-one trial debit");
  // Second format exercises the unchanged HTML response / browser Word path.
  const word=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload("docx")});
  const wordJob=(await word.json() as any).job;assert.equal((await ready(wordJob.id)).state,"ready");
  const wordResult=await fetch(`${base}/api/remedy-docs/jobs/${wordJob.id}/result`,{headers:headers()});
  assert.ok(wordResult.headers.get("content-type")?.includes("application/json"));
  assert.ok((await wordResult.json() as any).structuredHtml.includes("Diagnostic fixture"));
  assert.equal(trialLedger.balance("owner",140).remaining,138);
  console.log("PASS actual routes: Word semantic-HTML response and one trial debit");
  const png=execFileSync("python3",["-c","from PIL import Image, ImageDraw; import io, sys; im=Image.new('RGB',(200,200),'white'); d=ImageDraw.Draw(im); d.rectangle((20,20,180,180),fill='blue'); d.line((20,180,180,20),fill='red',width=12); out=io.BytesIO(); im.save(out,format='PNG'); sys.stdout.buffer.write(out.getvalue())"]);
  const imagePdf=await PDFDocument.load(bytes);
  const image=await imagePdf.embedPng(png);
  imagePdf.getPages()[0].drawImage(image,{x:100,y:200,width:150,height:150});
  const visionBytes=await imagePdf.save();
  assert.equal(execFileSync("python3",["-c","import fitz,sys; d=fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf'); p=d[0]; print(sum(len(p.get_image_rects(i[0])) for i in p.get_images(full=True)))"],{input:visionBytes}).toString().trim(),"1");
  const vision=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload("pdf","vision.pdf",visionBytes)});
  const visionJob=(await vision.json() as any).job;const visionDone=await ready(visionJob.id);
  assert.equal(visionDone.state,"ready",visionDone.error);
  const visionPdf=await fetch(`${base}/api/remedy-docs/jobs/${visionJob.id}/result`,{headers:headers()});
  assert.equal(visionPdf.status,200);assert.equal(visionPdf.headers.get("x-remedy-docs-route"),"vision");
  const renderedVision=Buffer.from(await visionPdf.arrayBuffer());
  assert.ok(Number(execFileSync("python3",["-c","import fitz,sys; d=fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf'); print(sum(len(p.get_images()) for p in d))"],{input:renderedVision}).toString().trim())>=1,"Vision output must contain an embedded image");
  assert.equal(trialLedger.balance("owner",140).remaining,137);
  console.log("PASS actual routes: vision extraction + PDF renderer through job transport; one trial debit");
  const failure=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload("pdf","fail-audit.pdf",Buffer.concat([bytes,Buffer.from('\\n')]))});
  const failureJob=(await failure.json() as any).job;const failed=await ready(failureJob.id);
  assert.equal(failed.state,"failed");assert.match(failed.error,/Synthetic audit failure/);
  assert.equal(trialLedger.balance("owner",140).remaining,137);
  assert.equal((await fetch(`${base}/api/health`)).status,200);
  console.log("PASS actual routes: early audit failure does not crash server; trial reservation restored");
  const imageDoc=await Packer.toBuffer(new Document({sections:[{children:[
    new Paragraph("Shared image preservation route fixture."),
    new Paragraph({children:[new ImageRun({type:"png",data:png,transformation:{width:150,height:150},altText:{name:"Fixture",title:"Blue square with red diagonal",description:"Blue square with red diagonal"}})]})
  ]}]}));
  for (const mode of ["docx","pdf"]){
    const submitted=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload(mode,"image-fixture.docx",imageDoc)});
    assert.equal(submitted.status,202);
    const task=(await submitted.json() as any).job,done=await ready(task.id);
    assert.equal(done.state,"ready",done.error);
    const download=await fetch(`${base}/api/remedy-docs/jobs/${task.id}/result`,{headers:headers()});
    if(mode==="docx"){
      const data=await download.json() as any;
      assert.equal(data.imageCount,1);assert.match(data.structuredHtml,/<img /);
      assert.ok(!data.structuredHtml.includes("[[REMEDY_IMG_"));
      assert.ok(!data.htmlContent.includes("base64"));
    }else{
      const result=Buffer.from(await download.arrayBuffer());
      assert.equal(execFileSync("python3",["-c","import fitz,sys; d=fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf'); print(sum(len(p.get_image_info()) for p in d))"],{input:result}).toString().trim(),"1");
    }
    console.log("PASS actual routes: Word-input image preserved for",mode,"output");
  }
  const balanceBeforeLoss=trialLedger.balance("owner",140).remaining;
  const loss=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload("docx","dropped-image.docx",imageDoc)});
  const lossJob=(await loss.json() as any).job,lossResult=await ready(lossJob.id);
  assert.equal(lossResult.state,"failed");assert.match(lossResult.error,/Image-preservation check failed/);
  assert.equal(trialLedger.balance("owner",140).remaining,balanceBeforeLoss);
  console.log("PASS actual routes: dropped image blocks result and restores trial credits");
  // The harness copies this renderer into an isolated temporary directory.
  // Simulate an import-time renderer failure without altering source or production.
  const renderer = new URL("./pdf_pipelines/text_pdf_tag.py", import.meta.url);
  assert.ok(renderer.pathname.includes("/remedy-docs-integration-"));
  const rendererSource = readFileSync(renderer);
  const beforeRendererFailure = trialLedger.balance("owner",140).remaining;
  try {
    writeFileSync(renderer, "import sys\nsys.stderr.write('Synthetic renderer startup failure')\nsys.exit(1)\n");
    const admission=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload("pdf","renderer-failure-image-fixture.docx",imageDoc)});
    const task=(await admission.json() as any).job, result=await ready(task.id);
    assert.equal(result.state,"failed");
    assert.match(result.error,/Synthetic renderer startup failure/);
    assert.equal((await fetch(`${base}/api/health`)).status,200);
    assert.equal(trialLedger.balance("owner",140).remaining,beforeRendererFailure);
    assert.notEqual((await fetch(`${base}/api/remedy-docs/jobs/${task.id}/result`,{headers:headers()})).status,200);
    console.log("PASS actual routes: renderer startup failure stays contained, blocks output and restores trial credits");
  } finally {
    writeFileSync(renderer, rendererSource);
  }
  const recovered=await fetch(`${base}/api/remedy-docs/jobs`,{method:"POST",headers:headers(),body:upload("pdf","recovered-image-fixture.docx",imageDoc)});
  const recoveredTask=(await recovered.json() as any).job;
  assert.equal((await ready(recoveredTask.id)).state,"ready");
  console.log("PASS actual routes: next PDF succeeds after a renderer failure without restarting server");
}finally{documentTaskStore.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
