import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CheckCircle2, Loader2, Minus, Plus, CreditCard, FileText } from "lucide-react";

const TEAM_PRICE_ANNUAL = "price_1TqdJpAaDElV6hZx2kEMey6p";

const TEAM_FEATURES = [
  "Everything in Individual",
  "Admin dashboard for your team",
  "Invite by link or email",
  "Per-user document history",
  "Priority email support",
  "Pay by credit card or invoice/PO",
  "Annual plan (non-refundable)",
];

export default function TeamCheckout() {
  const [seats, setSeats] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "invoice">("card");
  const [loading, setLoading] = useState(false);
  const { isSignedIn, userId } = useAuth();
  const [, navigate] = useLocation();

  const total = seats * 149;

  function adjustSeats(delta: number) {
    setSeats((s) => Math.max(2, s + delta));
  }

  async function handleCheckout() {
    if (!isSignedIn) {
      navigate("/signup");
      return;
    }

    if (paymentMethod === "invoice") {
      navigate(`/invoice-request?seats=${seats}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-team-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats, clerkUserId: userId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-[#3a485b] py-16 sm:py-20" aria-labelledby="team-heading">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h1 id="team-heading" className="text-4xl font-bold text-white mb-3">
            Team Plan
          </h1>
          <p className="text-white/70 text-lg">$149/seat/year — annual only</p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {TEAM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0d9488]" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-6 mb-6">
              {/* Seat picker */}
              <label className="block text-sm font-semibold text-[#3a485b] mb-3">
                Number of seats
              </label>
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => adjustSeats(-1)}
                  disabled={seats <= 2}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  aria-label="Remove seat"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={2}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-20 text-center text-2xl font-bold text-[#3a485b] border border-gray-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                  aria-label="Seat count"
                />
                <button
                  onClick={() => adjustSeats(1)}
                  className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition"
                  aria-label="Add seat"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-1">Minimum 2 seats</p>
              <p className="text-sm text-gray-400 mb-1">
                75 documents/month per seat, pooled across your team
              </p>

              {/* Live total */}
              <div className="mt-4 rounded-xl bg-[#0d9488]/10 border border-[#0d9488]/20 px-5 py-4">
                <p className="text-lg font-bold text-[#3a485b]">
                  {seats} seat{seats !== 1 ? "s" : ""} × $149 ={" "}
                  <span className="text-[#0d9488]">${total.toLocaleString()}/year</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {seats * 75} documents/month pooled · Billed annually · Non-refundable
                </p>
              </div>
            </div>

            {/* Payment method */}
            <div className="mb-6">
              <p className="text-sm font-semibold text-[#3a485b] mb-3">Payment method</p>
              <div className="space-y-3">
                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${paymentMethod === "card" ? "border-[#0d9488] bg-[#0d9488]/5" : "border-gray-200 hover:border-gray-300"}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                    className="mt-0.5 accent-[#0d9488]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#0d9488]" aria-hidden="true" />
                      <span className="font-semibold text-sm text-[#3a485b]">Pay by credit card</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Instant access after checkout</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${paymentMethod === "invoice" ? "border-[#0d9488] bg-[#0d9488]/5" : "border-gray-200 hover:border-gray-300"}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="invoice"
                    checked={paymentMethod === "invoice"}
                    onChange={() => setPaymentMethod("invoice")}
                    className="mt-0.5 accent-[#0d9488]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0d9488]" aria-hidden="true" />
                      <span className="font-semibold text-sm text-[#3a485b]">Pay by invoice / PO</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Perfect for institutions, government agencies, and healthcare organizations</p>
                  </div>
                </label>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-base transition bg-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting…</>
              ) : paymentMethod === "invoice" ? (
                "Request Invoice →"
              ) : (
                `Pay $${total.toLocaleString()}/year →`
              )}
            </button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
