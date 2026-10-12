import type * as Docx from "docx";

// Used by paragraphs, headings and table cells, not a separate image-only export.
export function wordContent(docx: typeof Docx, root: Element, expected: number) {
  const all=Array.from(root.querySelectorAll("img"));
  if(all.length!==expected)throw new Error("Word image inventory does not match the processed document.");
  const rendered=new Set<Element>();
  const inline=(node: Node, options: {bold?:boolean;italics?:boolean;size?:number}={}, maxWidth=624): Docx.ParagraphChild[]=>{
    if(node.nodeType===3)return [new docx.TextRun({text:node.textContent||"",...options})];
    if(node.nodeType!==1)return [];
    const e=node as Element, tag=e.tagName.toLowerCase();
    if(tag==="img"){
      if(rendered.has(e))throw new Error("Word image was rendered twice.");
      const match=(e.getAttribute("src")||"").match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/);
      if(!match)throw new Error("Word output encountered an unsupported or external image.");
      const width=Number(e.getAttribute("width")),height=Number(e.getAttribute("height"));
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error("Word image dimensions are missing.");
      const scale=Math.min(1,maxWidth/width,720/height);
      rendered.add(e);
      const alt=e.getAttribute("alt")||"Image description requires review";
      return [new docx.ImageRun({type:match[1]==="jpeg"?"jpg":"png",
        data:Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0)),
        transformation:{width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))},
        altText:{name:`Document image ${rendered.size}`,title:alt,description:alt}})];
    }
    if(["script","style"].includes(tag))return [];
    if(tag==="br")return [new docx.TextRun({break:1})];
    const style={...options,...(["strong","b"].includes(tag)?{bold:true}:{}),...(["em","i"].includes(tag)?{italics:true}:{})};
    return Array.from(e.childNodes).flatMap(c=>inline(c,style,maxWidth));
  };
  return {inline,assertComplete:()=>{if(rendered.size!==expected)throw new Error("Word export stopped because an image was omitted.");}};
}
