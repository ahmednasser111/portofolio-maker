// Only ever calls the allowlisted GitHub API host (architecture.md §13 risk
// #8, SSRF) — never a user-supplied URL. Plain fetch, no SDK dependency:
// the surface used here (2 read-only endpoints) doesn't earn one.

const GITHUB_API = "https://api.github.com";

export type GithubUser = {
  login: string;
  avatar_url: string | null;
};

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  topics: string[];
  language: string | null;
  fork: boolean;
  private: boolean;
  updated_at: string;
};

async function githubFetch(path: string, token: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
}

export async function fetchGithubUser(token: string): Promise<GithubUser> {
  const res = await githubFetch("/user", token);
  if (!res.ok) {
    throw new Error(res.status === 401 ? "GitHub token is invalid or expired." : "GitHub API error.");
  }
  return res.json();
}

export async function fetchGithubRepos(token: string): Promise<GithubRepo[]> {
  const res = await githubFetch("/user/repos?per_page=100&sort=updated&affiliation=owner", token);
  if (!res.ok) {
    throw new Error(res.status === 401 ? "GitHub token is invalid or expired." : "GitHub API error.");
  }
  return res.json();
}
