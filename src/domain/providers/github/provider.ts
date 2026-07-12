import { ProviderType, ProjectLinkType } from "@prisma/client";
import type { ConnectionProvider, ImportProvider, ProviderAccountMeta, StagedItemDraft } from "../types";
import type { ProjectDraft } from "@/domain/imports/target-schemas";
import { fetchGithubUser, fetchGithubRepos, type GithubRepo } from "./client";

function mapRepoToDraft(repo: GithubRepo): ProjectDraft {
  const links: ProjectDraft["links"] = [{ type: ProjectLinkType.REPOSITORY, url: repo.html_url }];
  if (repo.homepage) {
    links.push({ type: ProjectLinkType.LIVE_DEMO, url: repo.homepage });
  }

  return {
    title: repo.name,
    summary: repo.description,
    description: repo.description,
    tags: repo.language ? [repo.language, ...repo.topics] : repo.topics,
    links,
  };
}

export const githubProvider: ConnectionProvider & ImportProvider<GithubRepo> = {
  type: ProviderType.GITHUB,

  async verifyToken(token: string): Promise<ProviderAccountMeta> {
    const user = await fetchGithubUser(token);
    return { username: user.login, avatarUrl: user.avatar_url };
  },

  async listImportables(token: string): Promise<GithubRepo[]> {
    return fetchGithubRepos(token);
  },

  mapToStagedItems(repos: GithubRepo[]): StagedItemDraft[] {
    return repos.map((repo) => ({
      targetType: "PROJECT",
      externalId: String(repo.id),
      data: mapRepoToDraft(repo),
    }));
  },
};
