export let calls = 0;
export default class Anthropic {
  messages = {create: async (input:any) => {
    calls++;
    if (String(input.system).includes("auditing a document") && JSON.stringify(input.messages).includes("fail-audit.pdf")) throw new Error("Synthetic audit failure");
    await new Promise(resolve=>setTimeout(resolve,250));
    let text = String(input.system).includes("auditing a document")
      ? JSON.stringify({issues:[],fixesMade:["Structured headings"]})
      : '<h1>Diagnostic fixture</h1><p>This is synthetic test content for the background document workflow.</p>' +
        (String(input.system).includes("processing one page") ? '<figure data-extracted="true" data-alt="Test square"><img src="cid:img-p1-0" alt="Test square"/></figure>' : "");
    if (!String(input.system).includes("auditing a document") && JSON.stringify(input.messages).includes("image-fixture.docx")) {
      text=String(input.messages[0].content).split("Mammoth HTML:\n").pop()!;
    }
    if (String(input.system).includes("processing one page") && JSON.stringify(input.messages).includes("bad-pdf-image.pdf")) {
      text = '<h1>Diagnostic fixture</h1><figure data-alt="Unmatched image"><img src="cid:nonexistent"></figure>';
    }
    if (String(input.messages[0].content).includes("BLOCKS_JSON:\n")) {
      const blocks = JSON.parse(String(input.messages[0].content).split("BLOCKS_JSON:\n").pop()!).blocks;
      if (JSON.stringify(blocks).includes("REMEDY_IMG_") || JSON.stringify(blocks).includes("data:image/")) throw new Error("Protected pictures leaked into the AI request");
      text = JSON.stringify(input.messages).includes("dropped-image.docx")
        ? '{"blocks":[]}'
        : JSON.stringify({ blocks });
    }
    return {content:[{type:"thinking",thinking:"Synthetic non-text block"},{type:"text",text}],usage:{input_tokens:10,output_tokens:10},stop_reason:"end_turn"};
  }};
}
