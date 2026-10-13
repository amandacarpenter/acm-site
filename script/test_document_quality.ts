import assert from "node:assert/strict";
import { normalizeDocumentHeadings } from "../shared/documentHeadings";
import { readFileSync, writeFileSync } from "node:fs";
import { extractWordImages, restoreWordImages } from "../server/documentImages";

const input = '<h2>Intro</h2><h2>Term</h2><h1>A</h1><h3>B</h3><h4>C</h4><h3>D</h3><h1>E</h1><h6>F</h6>';
const fixed = normalizeDocumentHeadings(input);
assert.deepEqual(Array.from(fixed.html.matchAll(/<h(\d)>/g), m => +m[1]), [1,1,1,2,3,2,1,2]);
assert.equal(normalizeDocumentHeadings(fixed.html).html, fixed.html);
assert.equal(fixed.html.replace(/<\/?h\d>/g, ""), input.replace(/<\/?h\d>/g, ""));
assert.equal(normalizeDocumentHeadings("<p>no headings</p>").html,"<p>no headings</p>");
console.log("PASS heading hierarchy: initial H2, skipped levels, siblings, descendants, idempotence and exact text");
if (process.env.DOCX_IMAGE_FIXTURE) {
  const extracted = await extractWordImages(readFileSync(process.env.DOCX_IMAGE_FIXTURE), process.cwd()+"/server/pdf_pipelines");
  assert.equal(extracted.images.length,21);
  assert.equal(extracted.images.filter(i=>i.altSource==="decoded_qr").length,1);
  assert.ok(extracted.images[2].alt.startsWith("QR code linking to "));
  assert.ok(extracted.images[2].qrUrl?.startsWith("https://socialsci.libretexts.org/"));
  assert.ok(extracted.images.every(i=>i.alt.trim() && i.alt!=="Image description requires review"));
  const html=normalizeDocumentHeadings(restoreWordImages(extracted.html,extracted.images)).html;
  assert.equal((html.match(/<img /g)||[]).length,21);
  console.log("PASS actual syllabus: 21 pictures, decoded missing textbook QR description, existing descriptions retained");
  if(process.env.QUALITY_RESPONSE) writeFileSync(process.env.QUALITY_RESPONSE,JSON.stringify({
    structuredHtml:html,imageCount:21,fixesMade:["Recovered missing QR-code description from decoded destination"],
    issues:[],rawText:"",filename:"CDEV-syllabus.docx"
  }));
  if(process.env.QUALITY_REPLAY && process.env.QUALITY_RESPONSE) {
    const replay=JSON.parse(readFileSync(process.env.QUALITY_REPLAY,"utf8"));
    let index=0;
    replay.structuredHtml=normalizeDocumentHeadings(replay.structuredHtml.replace(/<img\b[^>]*>/g,(tag:string)=>{
      const source=extracted.images[index++];
      if(source.altSource!=="decoded_qr")return tag;
      return tag.replace(/alt="Image description requires review"/,`alt="${source.alt.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}"`);
    })).html;
    assert.equal(index,21);
    writeFileSync(process.env.QUALITY_RESPONSE,JSON.stringify(replay));
  }
}
