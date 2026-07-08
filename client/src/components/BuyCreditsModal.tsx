import { useState } from "react";
import { X, ShoppingCart, Zap, ChevronRight } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

const PRESETS = [
  { qty: 10, label: "10 docs", note: "Great for a project" },
  { qty: 25, label: "25 docs", note: "Most popular" },
  { qty: 50, label: "50 docs", note: "Best per-doc value" },
  { qty: 100, label: "100 docs", note: "Power user pack" },
];

const PRICE_PER_DOC = 0.30;

export default function BuyCreditsModal({ open, onClose, userId }: Props) {
  const [selected, setSelected] = useState<number | null>(25);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const qty = custom ? parseInt(custom) || 0 : (selected ?? 0);
  const total = (qty * PRICE_PER_DOC).toFixed(2);
  const isValid = qty >= 10 && qty <= 10000;

  const handleBuy = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/stripe/create-credits-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty, clerkUserId: userId }),
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
              <h2 id="buy-credits-title" className="text-lg font-bold">Buy More Docs</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-lg hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/80 text-sm mt-1">One-time purchase · $0.30 per document · No expiration</p>
        </div>

        <div className="p-6">
          {/* Preset chips */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Choose a pack</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.qty}
                onClick={() => { setSelected(p.qty); setCustom(""); }}
                className={`relative rounded-xl border-2 p-3 text-left transition ${
                  selected === p.qty && !custom
                    ? "border-[#0d9488] bg-teal-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <p className={`text-sm font-bold ${selected === p.qty && !custom ? "text-[#0d9488]" : "text-[#3a485b]"}`}>
                  {p.label}
                </p>
                <p className="text-xs text-gray-400">{p.note}</p>
                <p className={`text-xs font-semibold mt-1 ${selected === p.qty && !custom ? "text-[#0d9488]" : "text-gray-500"}`}>
                  ${(p.qty * PRICE_PER_DOC).toFixed(2)}
                </p>
                {p.qty === 25 && (
                  <span className="absolute -top-2 -right-2 bg-[#0d9488] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="mb-5">
            <label htmlFor="custom-qty" className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Or enter a custom amount (min 10)
            </label>
            <div className="relative">
              <input
                id="custom-qty"
                type="number"
                min={10}
                max={10000}
                placeholder="e.g. 75"
                value={custom}
                onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent"
              />
              {custom && parseInt(custom) >= 10 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#0d9488]">
                  ${(parseInt(custom) * PRICE_PER_DOC).toFixed(2)}
                </span>
              )}
            </div>
            {custom && (parseInt(custom) < 10 || isNaN(parseInt(custom))) && (
              <p className="text-xs text-red-500 mt-1">Minimum purchase is 10 documents.</p>
            )}
          </div>

          {/* Live total */}
          {isValid && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0d9488]" />
                <span className="text-sm font-semibold text-[#3a485b]">{qty} documents</span>
              </div>
              <span className="text-lg font-bold text-[#0d9488]">${total}</span>
            </div>
          )}

          {/* Policy note */}
          <p className="text-xs text-gray-400 mb-4">
            Credits are added to your account immediately after payment. They never expire unless your account is inactive for 12+ months. Non-refundable.
          </p>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleBuy}
            disabled={!isValid || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#0d9488] text-white hover:bg-[#0f766e] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>Redirecting to checkout...</span>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Buy {isValid ? qty : ""} Docs{isValid ? ` — $${total}` : ""}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
