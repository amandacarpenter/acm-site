import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { Shield, CreditCard, CheckCircle2, Lock } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3a485b]/10 border border-[#3a485b]/20 text-sm font-medium text-[#3a485b] mb-6">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            Get started today
          </div>
          <h1 className="text-3xl font-bold text-[#3a485b] mb-2">Create your account</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Get started with Remedy508 — accessible content tools built for educators.
          </p>
        </div>

        {/* Value props */}
        <div className="flex flex-col gap-2 mb-8">
          {[
            "Unlimited document fixes (Word or PDF)",
            "Unlimited video transcriptions",
            "Canvas HTML fixer & Alt text generator",
            "Cancel Individual plan anytime",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-[#0d9488] shrink-0" aria-hidden="true" />
              {item}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#3a485b]" htmlFor="first-name">First name</label>
              <input
                id="first-name"
                type="text"
                placeholder="Jane"
                autoComplete="given-name"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#3a485b]" htmlFor="last-name">Last name</label>
              <input
                id="last-name"
                type="text"
                placeholder="Smith"
                autoComplete="family-name"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#3a485b]" htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              placeholder="jane@college.edu"
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#3a485b]" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
            />
          </div>

          {/* Credit card section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-[#3a485b]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#3a485b]">Payment info</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                <Lock className="w-3 h-3" aria-hidden="true" />
                Secured by Stripe
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Your card is required to activate your account. You will be charged based on your selected plan.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#3a485b]" htmlFor="card-number">Card number</label>
                <input
                  id="card-number"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  inputMode="numeric"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#3a485b]" htmlFor="card-expiry">Expiration</label>
                  <input
                    id="card-expiry"
                    type="text"
                    placeholder="MM / YY"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#3a485b]" htmlFor="card-cvc">CVC</label>
                  <input
                    id="card-cvc"
                    type="text"
                    placeholder="123"
                    inputMode="numeric"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition shadow-sm"
          >
            Create Account
          </button>

          <p className="text-center text-xs text-gray-400 leading-relaxed">
            By creating an account you agree to our{" "}
            <Link href="/terms"><span className="underline hover:text-[#0d9488] cursor-pointer">Terms of Service</span></Link>{" "}
            and{" "}
            <Link href="/privacy"><span className="underline hover:text-[#0d9488] cursor-pointer">Privacy Policy</span></Link>.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login">
            <span className="text-[#0d9488] font-medium hover:underline cursor-pointer">Log in</span>
          </Link>
        </p>
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
