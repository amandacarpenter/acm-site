import { SignIn, useAuth } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useClerkAutocomplete } from "@/hooks/use-clerk-autocomplete";

export default function LoginPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  useDocumentTitle("Log in | Remedy508");
  useClerkAutocomplete("current-password");

  useEffect(() => {
    if (isSignedIn) navigate("/");
  }, [isSignedIn]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <h1 className="sr-only">Log in to Remedy508</h1>
        <SignIn
          routing="virtual"
          signUpUrl="/signup"
          afterSignInUrl="/"
          appearance={{
            variables: {
              colorPrimary: "#0f766e",
              colorText: "#3a485b",
              colorTextSecondary: "#566373",
              borderRadius: "0.75rem",
            }
          }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
