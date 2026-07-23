import { SignIn, useAuth } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function LoginPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isSignedIn) navigate("/dashboard");
  }, [isSignedIn]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/signup"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: "#0d9488",
              colorText: "#3a485b",
              borderRadius: "0.75rem",
            }
          }}
        />
      </div>
      <SiteFooter />
    </div>
  );
}
