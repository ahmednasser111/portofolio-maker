// Only ever calls the allowlisted Vercel API host (architecture.md §13 risk
// #8, SSRF) — never a user-supplied URL. Plain fetch, no SDK dependency.

const VERCEL_API = "https://api.vercel.com";

export type VercelUser = {
  user: { username: string; avatar: string | null };
};

export type VercelProject = {
  id: string;
  name: string;
};

async function vercelFetch(path: string, token: string): Promise<Response> {
  return fetch(`${VERCEL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export async function fetchVercelUser(token: string): Promise<VercelUser> {
  const res = await vercelFetch("/v2/user", token);
  if (!res.ok) {
    throw new Error(res.status === 403 ? "Vercel token is invalid or expired." : "Vercel API error.");
  }
  return res.json();
}

export async function fetchVercelProjects(token: string): Promise<VercelProject[]> {
  const res = await vercelFetch("/v9/projects?limit=100", token);
  if (!res.ok) {
    throw new Error(res.status === 403 ? "Vercel token is invalid or expired." : "Vercel API error.");
  }
  const body = await res.json();
  return body.projects as VercelProject[];
}

// Vercel's project object doesn't carry a stable "production URL" field
// directly — resolve it from the latest production deployment instead.
// Returns null if the project has never been deployed to production.
export async function fetchVercelProductionUrl(
  token: string,
  projectId: string,
): Promise<string | null> {
  const res = await vercelFetch(
    `/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=1`,
    token,
  );
  if (!res.ok) {
    throw new Error("Vercel API error.");
  }
  const body = await res.json();
  const deployment = body.deployments?.[0];
  return deployment?.url ? `https://${deployment.url}` : null;
}
