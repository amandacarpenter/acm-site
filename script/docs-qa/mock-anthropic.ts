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
    return {content:[{type:"thinking",thinking:"Synthetic non-text block"},{type:"text",text}],usage:{input_tokens:10,output_tokens:10},stop_reason:"end_turn"};
  }};
}
