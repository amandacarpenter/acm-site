import logoUrl from "@/assets/logo.png";

export default function ComingSoon() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      {/* Logo */}
      <img
        src={logoUrl}
        alt="Remedy508"
        className="mb-10"
        style={{ height: 56, width: "auto" }}
      />

      {/* Heading */}
      <h1 className="text-4xl sm:text-5xl font-bold text-[#111827] mb-4 tracking-tight">
        Something big is coming.
      </h1>
      <p className="text-gray-500 text-lg max-w-md mb-8">
        Remedy508 is almost ready. Enter your email and we'll let you know the moment we launch.
      </p>

      {/* Zoho Form embed */}
      <div className="w-full max-w-md">
        <iframe
          aria-label="Remedy508 Launch Notification"
          frameBorder="0"
          style={{ height: "180px", width: "100%", border: "none" }}
          src="https://forms.zohopublic.com/helloreme1/form/Email/formperma/RQoS1mMAxeCWXFpdJLynieXn4CVBTqnCCjZPQ6ymHaY"
          title="Remedy508 Launch Notification"
        />
      </div>

      {/* Footer */}
      <p className="text-gray-400 text-xs mt-8">
        © {new Date().getFullYear()} Remedy508 — Left Coast Learning LLC
      </p>
    </div>
  );
}
