import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planWordRemediation, assembleWordRemediation } from "../server/wordRemediation";
import { extractWordImages, restoreWordImages } from "../server/documentImages";
import { documentProgress } from "../client/src/lib/documentProgress";

const source='<p>First paragraph</p><p>Before [[REMEDY_IMG_test_1]] after</p><table><tr><td>Cell [[REMEDY_IMG_test_2]] text</td></tr></table><p>Last paragraph</p>';
const plan=planWordRemediation(source);
assert.equal(plan.blocks.filter(block=>block.locked).length,2);
assert.equal(plan.lockedTables,1);
assert.ok(!JSON.stringify(plan.batches).includes("REMEDY_IMG"));
let checks=3;
for(const [label,responses] of [
  ["empty response",['{"blocks":[]}']],
  ["invalid JSON",["not JSON"]],
  ["invented image",['{"blocks":[{"id":"b0","html":"<img src=\\"bad\\">"},{"id":"b3","html":"<p>Last paragraph</p>"}]}']],
  ["duplicate id",['{"blocks":[{"id":"b0","html":"<p>First paragraph</p>"},{"id":"b0","html":"<p>First paragraph</p>"}]}']],
  ["missing text",['{"blocks":[{"id":"b0","html":"<p>First</p>"}]}']],
] as [string,string[]][]){
 const result=assembleWordRemediation(plan,responses);
 for(const block of plan.blocks.filter(block=>block.locked)) assert.ok(result.html.includes(block.html));
 assert.ok(result.html.includes("First paragraph") && result.html.includes("Last paragraph"));
 assert.equal((result.html.match(/REMEDY_IMG/g)||[]).length,2);
 assert.ok(result.retainedBlocks>0);
 console.log("PASS protected pictures and source text retained:",label);checks++;
}
const reversed=JSON.stringify({blocks:plan.batches[0].map(block=>({id:block.id,html:block.html.replace(/<p>/g,"<h2>").replace(/<\/p>/g,"</h2>")})).reverse()});
const result=assembleWordRemediation(plan,[reversed]);
assert.equal(result.retainedBlocks,0);
assert.ok(result.html.indexOf("First paragraph")<result.html.indexOf("REMEDY_IMG_test_1"));
assert.ok(result.html.indexOf("REMEDY_IMG_test_2")<result.html.indexOf("Last paragraph"));
checks++;
for(const [stage,percent] of [["Uploading your document",3],["Applying accessibility structure: section 1 of 7",15],["Applying accessibility structure: section 7 of 7",71],["Checking images and assembling your document",85],["Building the accessible PDF",90],["Ready to download",98]] as [string,number][]){
 const progress=documentProgress(stage);assert.equal(progress.percent,percent);assert.ok(!/section|of 7/i.test(progress.label));checks++;
}
if(process.env.DOCX_IMAGE_FIXTURE){
 const extracted=await extractWordImages(readFileSync(process.env.DOCX_IMAGE_FIXTURE),process.cwd()+"/server/pdf_pipelines");
 const syllabus=planWordRemediation(extracted.html);
 assert.ok(!JSON.stringify(syllabus.batches).includes("REMEDY_IMG_"));
 for(const replies of [syllabus.batches.map(batch=>JSON.stringify({blocks:batch})),syllabus.batches.map(()=> '{"blocks":[]}')]){
  const assembled=assembleWordRemediation(syllabus,replies);
  const restored=restoreWordImages(assembled.html,extracted.images);
  assert.equal((restored.match(/<img /g)||[]).length,21);checks++;
 }
 console.log("SYLLABUS",JSON.stringify({blocks:syllabus.blocks.length,protected:syllabus.blocks.filter(b=>b.locked).length,batches:syllabus.batches.length,protectedTables:syllabus.lockedTables}));
}
console.log(`${checks} protected-block and progress checks passed.`);
