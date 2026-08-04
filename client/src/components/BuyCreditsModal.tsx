import { useState } from "react";
import { X, ShoppingCart, Zap, ChevronRight, FileText, Image, Video, Code } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

const PACKS = [
  { id: "25", credits: 25, price: 3.0, note: "Great for a quick job", perCredit: "$0.12/credit" },
  { id: "50", credits: 50, price: 5.5, note: "Most popular", perCredit: "$0.11/credit" },
  { id: "100", credits: 100, price: 10.0, note: "Best value", perCredit: "$0.10/credit" },
];

export default function BuyCreditsModal({ open, onClose, userId }: Props) {
  const [selected, setSelected] = useState<string>("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const pack = PACKS.find((p) => p.id === selected) || PACKS[1];

  const handleBuy = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/stripe/create-credits-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: pack.id, clerkUserId: userId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Something went wrong");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-credits-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#3a485b] to-[#0d9488] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <h2 id="buy-credits-title" className="text-lg font-bold">Buy Credits</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-lg hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white text-base mt-1">One-time purchase · usable across all four tools · No expiration</p>
        </div>

        <div className="p-6">
          {/* Pack chips */}
          <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Choose a pack</p>
          <div className="grid grid-cols-1 gap-2 mb-5">
            {PACKS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`relative rounded-xl border-2 p-4 text-left transition flex items-center justify-between ${
                  selected === p.id
                    ? "border-[#0d9488] bg-teal-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div>
                  <p className={`text-sm font-bold ${selected === p.id ? "text-[#0d9488]" : "text-[#3a485b]"}`}>
                    {p.credits} Credits
                  </p>
                  <p className="text-sm text-gray-700">{p.note} · {p.perCredit}</p>
                </div>
                <p className={`text-lg font-bold ${selected === p.id ? "text-[#0d9488]" : "text-gray-700"}`}>
                  ${p.price.toFixed(2)}
                </p>
                {p.id === "50" && (
                  <span className="absolute -top-2 -right-2 bg-[#0d9488] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Live total */}
          <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#0d9488]" />
              <span className="text-sm font-semibold text-[#3a485b]">{pack.credits} Credits</span>
            </div>
            <span className="text-lg font-bold text-[#0d9488]">${pack.price.toFixed(2)}</span>
          </div>

          {/* How credits are used */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-[#3a485b] mb-0.5">How credits are used</p>
            <p className="text-xs text-gray-500 mb-2.5">Shared across all four tools, used after your monthly plan Credits run out.</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy Docs</p>
                  <p className="text-xs text-gray-500 leading-tight">1 credit / page</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
                  <Image className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy Image</p>
                  <p className="text-xs text-gray-500 leading-tight">1 credit / image</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
                  <Video className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy Video</p>
                  <p className="text-xs text-gray-500 leading-tight">1 credit / transcript</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9488] text-white">
                  <Code className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#3a485b] leading-tight">Remedy HTML</p>
                  <p className="text-xs text-gray-500 leading-tight">3 credits / fix</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2.5">
              Credits are added immediately after payment and never expire unless your account is inactive for 12+ months. Non-refundable.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleBuy}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#0d9488] text-white hover:bg-[#0f766e] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>Redirecting to checkout...</span>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Buy {pack.credits} Credits — ${pack.price.toFixed(2)}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
