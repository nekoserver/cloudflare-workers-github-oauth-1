/**
 * Cloudflare Pages API ユーティリティ
 * Pages プロジェクトの GitHub リポジトリ接続情報を取得する
 */

export interface CloudflarePagesProject {
  name: string;
  subdomain: string;
  source?: {
    type?: string;
    config?: {
      owner?: string;
      repo_name?: string;
      production_branch?: string;
    };
  };
}

export interface RepoCloudflareInfo {
  projectName: string;
  subdomain: string;
  productionBranch?: string;
}

/**
 * Cloudflare Pages プロジェクト一覧を取得し、
 * GitHub リポジトリ名 → Cloudflare Pages プロジェクト情報のマップを返す
 */
export async function getCloudflarePagesRepoMap(
  apiToken: string,
  accountId: string
): Promise<Map<string, RepoCloudflareInfo>> {
  const map = new Map<string, RepoCloudflareInfo>();

  let page = 1;
  const perPage = 25;

  while (true) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects?page=${page}&per_page=${perPage}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      break;
    }

    const data = await response.json<{
      success: boolean;
      result: CloudflarePagesProject[];
      result_info?: { page: number; per_page: number; total_pages: number; total_count: number };
    }>();

    if (!data.success || !Array.isArray(data.result)) {
      break;
    }

    for (const project of data.result) {
      const repoName = project.source?.config?.repo_name;
      if (repoName) {
        map.set(repoName, {
          projectName: project.name,
          subdomain: project.subdomain,
          productionBranch: project.source?.config?.production_branch,
        });
      }
    }

    const totalPages = data.result_info?.total_pages ?? 1;
    if (page >= totalPages) {
      break;
    }
    page++;
  }

  return map;
}
