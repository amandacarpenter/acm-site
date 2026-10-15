import { Link } from "wouter";
import { ArrowRight, Presentation } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroWatermark from "@/components/HeroWatermark";
import { useDocumentTitle } from "@/hooks/use-document-title";
import iconDocument from "@/assets/icon-document.png";
import iconVideo from "@/assets/icon-video.png";
import iconCanvas from "@/assets/icon-canvas.png";
import iconAlttext from "@/assets/icon-alttext.png";

const tools = [
  {
    name: "Remedy Docs",
    icon: iconDocument,
    href: "/tools/document",
    purpose: "Make your documents easier to read and navigate.",
    description: "Upload a Word document or PDF to address accessibility issues such as heading structure, image descriptions and tables.",
    input: "Word documents (.docx) and PDFs",
    result: "A remediated Word document or PDF to download and review",
    example: "Course syllabi, handouts, reports and resource guides",
  },
  {
    name: "Remedy Video",
    icon: iconVideo,
    href: "/tools/video",
    purpose: "Turn spoken content into text.",
    description: "Upload video or audio to generate a timecoded transcript. Review the wording and timing before using it for captions.",
    input: "Video or audio files, including MP4, MOV and MP3",
    result: "A timecoded, VTT-style transcript",
    example: "Recorded lectures, training videos and interviews",
  },
  {
    name: "Remedy HTML",
    icon: iconCanvas,
    href: "/tools/canvas",
    purpose: "Clean up the structure of your Canvas content.",
    description: "Paste your Canvas page HTML to address issues with headings, color contrast, image alt text and tables.",
    input: "HTML copied from the Canvas HTML editor",
    result: "Updated HTML to review and paste back into Canvas",
    example: "Course pages, assignment instructions and learning resources",
  },
  {
    name: "Remedy Image",
    icon: iconAlttext,
    href: "/tools/alttext",
    purpose: "Describe the information in your images.",
    description: "Upload an image or provide its URL to generate alt text. Get longer descriptions for more complex visuals, such as charts and diagrams.",
    input: "An image file or image URL",
    result: "Suggested alt text and, when needed, a longer description",
    example: "Photos, instructional images, charts and diagrams",
  },
  {
    name: "Remedy Layout",
    icon: null,
    href: null,
    comingSoon: true,
    purpose: "Improve accessibility without losing your visual design.",
    description: "Planned for visually designed documents, with a focus on improving accessibility while preserving their layout and appearance.",
    input: "Presentations, flyers and other visually designed documents",
    result: "Planned: a remediated document that retains its visual layout",
    example: "Slide decks, event flyers and designed learning materials",
  },
];

const textLink = "inline-flex min-h-11 items-center gap-2 font-semibold text-[#0f766e] underline underline-offset-4 hover:text-[#0b5c5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f766e]";

export default function RemedyTools() {
  useDocumentTitle("Remedy Tools | Document, Video, HTML & Image Accessibility");

  return (
    <div className="min-h-screen bg-white text-[#3a485b]">
      <a href="#remedy-tools-main" className="fixed left-3 top-[-80px] z-[100] rounded-lg bg-[#0f766e] px-4 py-3 font-semibold text-white focus:top-3">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="remedy-tools-main" tabIndex={-1}>
        <section className="relative overflow-hidden bg-[#3a485b] py-20 sm:py-24" aria-labelledby="remedy-tools-heading">
          <HeroWatermark corner="right" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <p className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">Meet your accessibility toolkit</p>
            <h1 id="remedy-tools-heading" className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">Remedy Tools</h1>
            <p className="text-lg leading-relaxed text-white max-w-2xl mx-auto">
              Find the right tool to improve the accessibility of your documents, video, Canvas content and images. Here is what each Remedy508 tool does.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16" aria-label="Remedy tools">
          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <article key={tool.name} className="rounded-xl border border-gray-200 p-6 sm:p-8 flex flex-col" aria-labelledby={`title-${tool.href?.split("/").pop() ?? "layout"}`}>
                <div className="flex items-center gap-4 mb-5">
                  {tool.icon ? (
                    <img src={tool.icon} alt="" width={48} height={48} className="w-12 h-12 object-contain shrink-0" />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center shrink-0" aria-hidden="true">
                      <span className="w-8 h-8 rounded-full bg-[#0f766e] text-white flex items-center justify-center">
                        <Presentation className="w-4 h-4" />
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 id={`title-${tool.href?.split("/").pop() ?? "layout"}`} className="text-2xl font-bold text-[#111827]">{tool.name}</h2>
                    {tool.comingSoon && <span className="inline-block mt-2 rounded-full bg-[#e6f4f3] px-3 py-1 text-sm font-semibold text-[#0b5c5a]">Coming soon</span>}
                  </div>
                </div>
                <p className="font-semibold text-[#111827] mb-2">{tool.purpose}</p>
                <p className="leading-relaxed mb-5">{tool.description}</p>
                <dl className="space-y-3 text-base mb-5">
                  <div><dt className="font-semibold text-[#111827]">Start with</dt><dd className="leading-relaxed">{tool.input}</dd></div>
                  <div><dt className="font-semibold text-[#111827]">Get back</dt><dd className="leading-relaxed">{tool.result}</dd></div>
                  <div><dt className="font-semibold text-[#111827]">Useful for</dt><dd className="leading-relaxed">{tool.example}</dd></div>
                </dl>
                {tool.href && <Link href={tool.href} className={`${textLink} mt-auto self-start`}>Open {tool.name}<ArrowRight size={16} aria-hidden="true" /></Link>}
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
