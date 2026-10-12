import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import * as mammoth from "mammoth";

export type PreservedImage = { sourceHash: string; data: string; mime: string; width: number; height: number; alt: string; transformed: boolean; token?: string };
const escape = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

export async function extractWordImages(buffer: Buffer, pipelineDir: string) {
  const manifest = await new Promise<PreservedImage[]>((resolve,reject) => {
    const p=spawn(existsSync("/opt/venv/bin/python3") ? "/opt/venv/bin/python3" : "python3",
      [path.join(pipelineDir,"docx_image_manifest.py")],{timeout:60000,killSignal:"SIGKILL"});
    const chunks: Buffer[]=[]; let error="";
    p.stdout.on("data",(b:Buffer)=>chunks.push(b)); p.stderr.on("data",(b:Buffer)=>error+=b);
    p.on("error",reject); p.stdin.on("error",reject);
    p.on("close",code=>{if(code!==0)reject(new Error(error.trim()||"Word image inventory failed."));
      else {try{resolve(JSON.parse(Buffer.concat(chunks).toString()));}catch(e){reject(e);}}});
    p.stdin.end(buffer);
  });
  const unused = [...manifest], images: PreservedImage[]=[];
  const prefix=randomUUID().replace(/-/g,"");
  const result=await mammoth.convertToHtml({buffer},{convertImage:mammoth.images.imgElement(async image=>{
    const bytes=await image.read();
    const hash=createHash("sha256").update(bytes).digest("hex");
    const index=unused.findIndex(i=>i.sourceHash===hash);
    if(index<0)throw new Error("A Word image could not be matched to its original. Processing stopped to prevent image loss.");
    const item=unused.splice(index,1)[0];
    item.token=`REMEDY_IMG_${prefix}_${images.length+1}`;
    const sourceAlt = (image as typeof image & { altText?: string }).altText;
    if(!item.alt && sourceAlt)item.alt=sourceAlt;
    images.push(item);
    return {src:item.token};
  })});
  if(unused.length || result.messages.some(m=>/could not|unsupported image/i.test(m.message)))
    throw new Error("Some Word images could not be extracted. No image-preserving output was generated.");
  // Replace the whole tag with a short text marker; no image bytes go to AI.
  const html=result.value.replace(/<img\b[^>]*\bsrc="(REMEDY_IMG_[^"]+)"[^>]*>/gi,(_tag,id)=>`[[${id}]]`);
  const ordered=Array.from(html.matchAll(/\[\[(REMEDY_IMG_[\w]+)\]\]/g)).map(m=>images.find(i=>i.token===m[1])!);
  if(ordered.length!==manifest.length || ordered.some(i=>!i))throw new Error("Word image marker inventory mismatch.");
  return {html, images:ordered};
}

export function restoreWordImages(html: string, images: PreservedImage[]) {
  if (/<(?:img|svg|object|embed)\b/i.test(html))
    throw new Error("Image-preservation check failed: unexpected image markup was generated instead of a verified marker.");
  const found=Array.from(html.matchAll(/\[\[(REMEDY_IMG_[\w]+)\]\]/g));
  if(found.length!==images.length || found.some((m,i)=>m[1]!==images[i].token))
    throw new Error("Image-preservation check failed: an image was missing, duplicated, or moved out of sequence. No output was generated; please report this attempt.");
  if(images.length && /(?:Figure[^<\n]{0,30})?\[Image\s*[—–-]/i.test(html))
    throw new Error("Image-preservation check failed: generated placeholder text was detected.");
  return html.replace(/\[\[(REMEDY_IMG_[\w]+)\]\]/g,(marker,id,offset)=>{
    if(html.lastIndexOf("<",offset)>html.lastIndexOf(">",offset))
      throw new Error("An image marker was moved into an HTML attribute. Processing stopped.");
    const image=images.find(i=>i.token===id)!;
    return `<img data-remedy-image="${id}" src="data:${image.mime};base64,${image.data}" width="${image.width}" height="${image.height}" alt="${escape(image.alt || "Image description requires review")}" />`;
  });
}
