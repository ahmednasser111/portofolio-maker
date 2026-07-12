import { ProviderType } from "@prisma/client";
import type { ConnectionProvider, ImportProvider } from "./types";
import { githubProvider } from "./github/provider";
import { vercelProvider } from "./vercel/provider";

// Adding a provider means adding one entry here — the integrations UI and
// import pipeline read from this registry, never a hardcoded provider list
// (architecture.md §12). RESUME is absent until M4 (no connection step, and
// its "import" is a one-off upload handled outside this registry).
type RegistryEntry = {
  label: string;
  connection: ConnectionProvider;
  // Absent for linking-only providers (Vercel).
  import?: ImportProvider;
};

export const providerRegistry: Partial<Record<ProviderType, RegistryEntry>> = {
  [ProviderType.GITHUB]: {
    label: "GitHub",
    connection: githubProvider,
    import: githubProvider,
  },
  [ProviderType.VERCEL]: {
    label: "Vercel",
    connection: vercelProvider,
  },
};

export function getConnectionProvider(type: ProviderType): ConnectionProvider {
  const entry = providerRegistry[type];
  if (!entry) throw new Error(`No connection provider registered for ${type}.`);
  return entry.connection;
}

export function getImportProvider(type: ProviderType): ImportProvider {
  const entry = providerRegistry[type];
  if (!entry?.import) throw new Error(`No import provider registered for ${type}.`);
  return entry.import;
}
