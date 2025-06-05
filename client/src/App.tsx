import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import PracticeSession from "@/pages/practice-session";
import AIConversation from "@/pages/ai-conversation";
import SessionHistory from "@/pages/session-history";
import Settings from "@/pages/settings";

function Router() {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/practice" component={PracticeSession} />
          <Route path="/ai-conversation" component={AIConversation} />
          <Route path="/history" component={SessionHistory} />
          <Route path="/settings" component={Settings} />
          <Route>
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
                <p className="text-gray-600">The requested page could not be found.</p>
              </div>
            </div>
          </Route>
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
