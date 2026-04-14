import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import ToolsPage from "@/pages/ToolsPage";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/tools" component={ToolsPage} />
          <Route path="/tools/:tab" component={ToolsPage} />
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
