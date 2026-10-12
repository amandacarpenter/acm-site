import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {Document,Packer,Paragraph,ImageRun,Table,TableRow,TableCell,Header} from "docx";
import JSZip from "jszip";
import {extractWordImages,restoreWordImages} from "../server/documentImages";

const root=process.cwd(), pipeline=path.join(root,"server/pdf_pipelines");
let checks=0;
function check(name:string,run:()=>void){run();checks++;console.log("PASS",name);}
const png=execFileSync("python3",["-c","from PIL import Image; import io,sys; im=Image.new('RGB',(80,40),'blue'); b=io.BytesIO(); im.save(b,format='PNG'); sys.stdout.buffer.write(b.getvalue())"]);
const picture=()=>new ImageRun({type:"png",data:png,transformation:{width:80,height:40},altText:{name:"square",title:"Blue rectangle",description:"Blue rectangle"}});
const input=await Packer.toBuffer(new Document({sections:[{children:[
 new Paragraph({children:[picture()]}),new Paragraph({children:[picture()]}),
 new Table({rows:[new TableRow({children:[new TableCell({children:[new Paragraph({children:[picture()]})]})]})]})
]}]}));
const extracted=await extractWordImages(input,pipeline);
check("repeated and table pictures have separate placements",()=>assert.equal(extracted.images.length,3));
check("no base64 image data reaches the text prompt",()=>assert.ok(!extracted.html.includes("base64")));
const restored=restoreWordImages(extracted.html,extracted.images);
check("all three placements restored",()=>assert.equal((restored.match(/<img /g)||[]).length,3));
check("source descriptions preserved",()=>assert.equal((restored.match(/alt="Blue rectangle"/g)||[]).length,3));
check("missing image stops processing",()=>assert.throws(()=>restoreWordImages(extracted.html.replace(`[[${extracted.images[0].token}]]`,""),extracted.images)));
check("duplicated image stops processing",()=>assert.throws(()=>restoreWordImages(extracted.html+`[[${extracted.images[0].token}]]`,extracted.images)));
check("reordered images stop processing",()=>assert.throws(()=>restoreWordImages(extracted.html.replace(extracted.images[0].token!,"SWAP").replace(extracted.images[1].token!,extracted.images[0].token!).replace("SWAP",extracted.images[1].token!),extracted.images)));
check("image markers in attributes are rejected",()=>assert.throws(()=>restoreWordImages(`<p title="[[${extracted.images[0].token}]]">bad</p>`,[extracted.images[0]])));
check("invented visible image placeholders are rejected",()=>assert.throws(()=>restoreWordImages(extracted.html+"<p>Figure 1: [Image — add alt text]</p>",extracted.images)));
const headerDoc=await Packer.toBuffer(new Document({sections:[{headers:{default:new Header({children:[new Paragraph({children:[picture()]})]})},children:[new Paragraph("Header image fixture")]}]}));
await assert.rejects(()=>extractWordImages(headerDoc,pipeline),/headers, footers/);checks++;console.log("PASS unsupported header images fail explicitly");
const broken=await JSZip.loadAsync(input);
const media=Object.keys(broken.files).find(n=>n.startsWith("word/media/")&&!broken.files[n].dir)!;
broken.remove(media);
const brokenBuffer=await broken.generateAsync({type:"nodebuffer"});
await assert.rejects(()=>extractWordImages(brokenBuffer,pipeline));checks++;console.log("PASS missing embedded image fails explicitly");
if(process.env.DOCX_IMAGE_FIXTURE){
 const source=readFileSync(process.env.DOCX_IMAGE_FIXTURE);
 const result=await extractWordImages(source,pipeline);
 const html=restoreWordImages(result.html,result.images);
 check("supplied syllabus contains 21 active pictures (not fallback duplicates)",()=>assert.equal(result.images.length,21));
 check("supplied syllabus preserves all 21 images",()=>assert.equal((html.match(/<img /g)||[]).length,21));
 check("supplied syllabus AI input contains no encoded image data",()=>assert.ok(!result.html.includes("base64")));
 const out=process.env.IMAGE_QA_OUTPUT;
 if(out){mkdirSync(out,{recursive:true});writeFileSync(path.join(out,"source-extraction.json"),JSON.stringify({html,images:result.images.map(({data,...i})=>i),imageCount:result.images.length}));}
 console.log("SYLLABUS",JSON.stringify({images:result.images.length,missingAlt:result.images.filter(i=>!i.alt).length,promptCharacters:result.html.length}));
}
console.log(`${checks} image-preservation checks passed.`);
