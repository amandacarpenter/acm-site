import { Link } from "wouter";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CheckCircle2, Target, Lightbulb, Heart, Info } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-[#3a485b] py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            About
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Not Accessible,<br />Not Acceptable™
          </h1>
          <p className="text-lg text-white leading-relaxed max-w-2xl mx-auto">
            Remedy508 was built because the gap between "technically compliant" and "actually accessible" costs real students their education every day. We're here to close it.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-[#3a485b] mb-6">The Problem</h2>
          <p className="text-gray-600 leading-relaxed mb-4 text-lg">
            Higher education is drowning in inaccessible course materials. PDFs without tags. Videos without captions. Canvas pages that screen readers can't parse. Images with no alt text.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4 text-lg">
            Instructional designers and faculty know this is a problem. They want to fix it. But manual remediation is slow, technical, and time-consuming — and most institutions don't have the staff to keep up with the volume.
          </p>
          <p className="text-gray-600 leading-relaxed text-lg">
            Meanwhile, the DOJ's ADA Title II rule is setting hard deadlines: April 2027 for larger universities, April 2028 for smaller colleges. The clock is ticking, and the backlog is enormous.
          </p>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-[#3a485b] mb-6">What We Built</h2>
          <p className="text-gray-600 leading-relaxed mb-8 text-lg">
            Remedy508 automates the remediation work that used to take hours and turns it into seconds. Upload a PDF, paste Canvas HTML, submit a video — and get back content that meets WCAG 2.1 Level AA standards.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: <Target className="w-5 h-5 text-[#0d9488]" />, title: "Precision", desc: "Remedy508 understands accessibility standards — not just formatting rules." },
              { icon: <Lightbulb className="w-5 h-5 text-[#0d9488]" />, title: "Built for Higher Ed", desc: "Designed specifically for the tools and workflows instructional designers actually use." },
              { icon: <CheckCircle2 className="w-5 h-5 text-[#0d9488]" />, title: "WCAG 2.1 AA", desc: "Every output targets the standard that ADA Title II compliance requires." },
              { icon: <Heart className="w-5 h-5 text-[#0d9488]" />, title: "Student-Centered", desc: "Every accessible document is a student who can actually access their education." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-5 bg-white rounded-xl border border-gray-200">
                <div className="flex-shrink-0 mt-0.5">{icon}</div>
                <div>
                  <p className="font-semibold text-[#3a485b] mb-1">{title}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-[#3a485b]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
          <p className="text-lg text-gray-300 leading-relaxed mb-6">
            Accessibility shouldn't require a specialist for every document. Every faculty member, every instructional designer, every institution should have the tools to make their materials accessible — without it taking all day.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed">
            Remedy508 is operated by <a href="https://leftcoastlearningllc.com" target="_blank" rel="noopener" className="text-white font-semibold underline underline-offset-2 hover:text-teal-400 transition-colors">Left Coast Learning LLC</a>, a California company focused on building practical accessibility tools for higher education.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-[#3a485b] mb-10 text-center">Why It Matters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { value: "26%", label: "of US adults have a disability", source: "CDC" },
              { value: "97%", label: "of websites have WCAG failures", source: "WebAIM 2025" },
              { value: "1 in 4", label: "college students has a disability", source: "NCES" },
            ].map(({ value, label, source }) => (
              <div key={value} className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
                <p className="text-4xl font-bold text-[#0d9488] mb-2">{value}</p>
                <p className="text-gray-600 text-sm mb-1">{label}</p>
                <p className="text-gray-400 text-xs">{source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-[#3a485b] mb-4">Ready to make your materials accessible?</h2>
          <p className="text-gray-500 mb-8">Try the tools, explore the pricing, or reach out with questions.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/pricing">
              <span className="inline-block bg-[#0d9488] hover:bg-[#0b7a6e] text-white font-semibold px-8 py-3 rounded-lg transition cursor-pointer">View Pricing</span>
            </Link>
            <Link href="/contact">
              <span className="inline-block border border-[#3a485b] text-[#3a485b] hover:bg-[#3a485b] hover:text-white font-semibold px-8 py-3 rounded-lg transition cursor-pointer">Contact Us</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
