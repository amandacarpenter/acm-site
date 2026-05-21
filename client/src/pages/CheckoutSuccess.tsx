import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function CheckoutSuccess() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <CheckCircle2 className="w-16 h-16 text-[#0d9488] mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-[#3a485b] mb-3">You're all set.</h1>
        <p className="text-gray-500 text-lg mb-2">Welcome to Remedy508 Individual.</p>
        <p className="text-gray-400 text-sm mb-10 max-w-sm">
          A confirmation email is on its way. Head to your dashboard to start remediating.
        </p>
        <Link href="/dashboard">
          <span className="inline-flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-base bg-[#0d9488] text-white hover:bg-[#0f766e] transition cursor-pointer">
            Go to Dashboard
          </span>
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
