"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// First landed in M3 (GitHub repo browsing, import review) — the stack's
// approved slot for "interactivity demands refetching" per architecture.md
// §10. RSC still owns first paint everywhere; this only wraps the dashboard
// so client components can useQuery against server actions.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
