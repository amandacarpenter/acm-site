import { SignUp } from "@clerk/clerk-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <SignUp
          routing="hash"
          signInUrl="/#/login"
          fallbackRedirectUrl="/#/dashboard"
          appearance={{
            variables: {
              colorPrimary: "#0d9488",
              colorText: "#3a485b",
              borderRadius: "0.75rem",
              fontFamily: "inherit",
            },
            elements: {
              card: "shadow-sm border border-gray-200",
              headerTitle: "text-[#3a485b] font-bold",
              headerSubtitle: "text-gray-500",
              formButtonPrimary: "bg-[#0d9488] hover:bg-[#0f766e]",
              footerActionLink: "text-[#0d9488] hover:text-[#0f766e]",
            },
          }}
        />
      </div>
      <SiteFooter />
    </div>
  );
}
