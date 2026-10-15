import { Link } from "wouter";
import { ArrowRight, AudioLines, Presentation, SearchCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
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
        <section className="bg-[#3a485b] py-14 sm:py-20" aria-labelledby="remedy-tools-heading">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/80 mb-4">Meet your accessibility toolkit</p>
            <h1 id="remedy-tools-heading" className="text-4xl sm:text-5xl font-bold text-white mb-5">Remedy Tools</h1>
            <p className="text-lg leading-relaxed text-white max-w-2xl">
              Check your content, hear how it may sound with a screen reader, and choose the right tool to help fix it. Here is what each Remedy508 tool does.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16" aria-labelledby="remediation-tools-heading">
          <div className="mb-8">
            <h2 id="remediation-tools-heading" className="text-2xl sm:text-3xl font-bold text-[#111827] mb-3">Choose the tool for your content</h2>
            <p className="max-w-3xl leading-relaxed">All four tools are included with Individual and Team plans and use Remedy508 Credits. Choose a tool below to open its workspace.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <article key={tool.name} className="rounded-xl border border-gray-200 p-6 sm:p-8 flex flex-col" aria-labelledby={`title-${tool.href.split("/").pop()}`}>
                <div className="flex items-center gap-4 mb-5">
                  <img src={tool.icon} alt="" width={48} height={48} className="w-12 h-12 object-contain" />
                  <h3 id={`title-${tool.href.split("/").pop()}`} className="text-2xl font-bold text-[#111827]">{tool.name}</h3>
                </div>
                <p className="font-semibold text-[#111827] mb-2">{tool.purpose}</p>
                <p className="leading-relaxed mb-5">{tool.description}</p>
                <dl className="space-y-3 text-base mb-5">
                  <div><dt className="font-semibold text-[#111827]">Start with</dt><dd className="leading-relaxed">{tool.input}</dd></div>
                  <div><dt className="font-semibold text-[#111827]">Get back</dt><dd className="leading-relaxed">{tool.result}</dd></div>
                  <div><dt className="font-semibold text-[#111827]">Useful for</dt><dd className="leading-relaxed">{tool.example}</dd></div>
                </dl>
                <Link href={tool.href} className={`${textLink} mt-auto self-start`}>Open {tool.name}<ArrowRight size={16} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#f0f7f6] py-12 sm:py-16" aria-labelledby="free-tools-heading">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <h2 id="free-tools-heading" className="text-2xl sm:text-3xl font-bold text-[#111827] mb-3">Two free ways to get started</h2>
            <p className="mb-8 leading-relaxed">No account or Remedy508 Credits required. These tools help you review a document; they do not change it.</p>
            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              <article aria-labelledby="free-checker-title">
                <SearchCheck size={28} className="text-[#0f766e] mb-4" aria-hidden="true" />
                <h3 id="free-checker-title" className="text-xl font-bold text-[#111827] mb-3">Free Document Accessibility Checker</h3>
                <p className="leading-relaxed mb-4">Check a PDF or Word document for machine-detectable issues with tags, headings, tables, alt text and language. Use the results to identify areas that need attention.</p>
                <Link href="/accessibility-checker" className={textLink}>Try the Free Checker<ArrowRight size={16} aria-hidden="true" /></Link>
              </article>
              <article aria-labelledby="simulation-title">
                <AudioLines size={28} className="text-[#0f766e] mb-4" aria-hidden="true" />
                <h3 id="simulation-title" className="text-xl font-bold text-[#111827] mb-3">Free Screen Reader Simulation</h3>
                <p className="leading-relaxed mb-4">Listen to your PDF or Word document and follow its headings, lists, tables, links and image descriptions in reading order. Notice missing descriptions or confusing structure before you share it.</p>
                <Link href="/screen-reader-simulation" className={textLink}>Try the Screen Reader Simulation<ArrowRight size={16} aria-hidden="true" /></Link>
              </article>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16" aria-labelledby="layout-title">
          <div className="flex flex-col sm:flex-row gap-5 border-b border-gray-200 pb-10">
            <Presentation size={32} className="text-[#0f766e] shrink-0" aria-hidden="true" />
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-[#0f766e] mb-2">Coming soon</p>
              <h2 id="layout-title" className="text-2xl font-bold text-[#111827] mb-3">Remedy Layout</h2>
              <p className="leading-relaxed">Planned for presentations, flyers and other visually designed documents, with a focus on improving accessibility while preserving their layout and appearance. This tool is not available yet.</p>
            </div>
          </div>
          <div className="pt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-[#111827] mb-2">Ready to get started?</h2>
              <p>Compare plans or start with one of the free tools above.</p>
            </div>
            <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-lg bg-[#0f766e] px-6 py-3 font-semibold text-white hover:bg-[#0b5c5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0f766e]">
              See Plans &amp; Pricing<ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <p className="text-sm leading-relaxed mt-8 max-w-3xl">Always review your results before sharing. Automated checks, fixes and simulations do not guarantee accessibility or replace testing with assistive technology.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
