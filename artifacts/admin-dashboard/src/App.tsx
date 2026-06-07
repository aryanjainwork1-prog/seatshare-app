import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shell } from "@/components/layout/shell";

import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Drivers from "@/pages/drivers";
import Trips from "@/pages/trips";
import Bookings from "@/pages/bookings";
import Payments from "@/pages/payments";
import Support from "@/pages/support";
import Logs from "@/pages/logs";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/users" component={Users} />
        <Route path="/drivers" component={Drivers} />
        <Route path="/trips" component={Trips} />
        <Route path="/bookings" component={Bookings} />
        <Route path="/payments" component={Payments} />
        <Route path="/support" component={Support} />
        <Route path="/logs" component={Logs} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster theme="dark" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
