import { Router, Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import Home from "@/pages/Home";
import ToolsPage from "@/pages/ToolsPage";
import PricingPage from "@/pages/PricingPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Accessibility from "@/pages/Accessibility";
import Contact from "@/pages/Contact";
import About from "@/pages/About";
import FAQPage from "@/pages/FAQPage";
import Dashboard from "@/pages/Dashboard";
import ComingSoon from "@/pages/ComingSoon";
import AdminPortal from "@/pages/AdminPortal";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import TeamCheckout from "@/pages/TeamCheckout";
import InvoiceRequest from "@/pages/InvoiceRequest";
import TeamSetup from "@/pages/TeamSetup";
import KbHome from "@/pages/kb/KbHome";
import KbArticlePage from "@/pages/kb/KbArticle";
import KbAdmin from "@/pages/kb/KbAdmin";
import ScrollToTop from "@/components/ScrollToTop";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="min-h-screen bg-gray-50" />;
  if (!isSignedIn) return <RedirectToSignIn />;
  return <Component />;
}

export default function App() {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignOutUrl="/home"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      clerkJSUrl="https://clerk.remedy508.com/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
    >
      <QueryClientProvider client={queryClient}>
        <Router base="">
          <ScrollToTop />
          <Switch>
            <Route path="/" component={ComingSoon} />
            <Route path="/home" component={Home} />
            <Route path="/tools" component={ToolsPage} />
            <Route path="/tools/:tab" component={ToolsPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/login/:rest*" component={LoginPage} />
            <Route path="/signup" component={SignupPage} />
            <Route path="/signup/:rest*" component={SignupPage} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/accessibility" component={Accessibility} />
            <Route path="/contact" component={Contact} />
            <Route path="/about" component={About} />
            <Route path="/faq" component={FAQPage} />
            <Route path="/coming-soon" component={ComingSoon} />
            <Route path="/admin" component={AdminPortal} />
            <Route path="/checkout/success" component={CheckoutSuccess} />
            <Route path="/team" component={TeamCheckout} />
            <Route path="/team/checkout" component={TeamCheckout} />
            <Route path="/team/setup" component={TeamSetup} />
            <Route path="/invoice-request" component={InvoiceRequest} />
            <Route path="/kb" component={KbHome} />
            <Route path="/kb/articles/:id" component={KbArticlePage} />
            <Route path="/kb/admin" component={KbAdmin} />
          </Switch>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
