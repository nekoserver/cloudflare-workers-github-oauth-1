/**
 * Cloudflare REST API 経由で D1 データベース情報を取得するユーティリティ
 */

export type CfD1Database = {
  uuid: string;
  name: string;
  created_at: string;
  file_size: number | null;
  num_tables: number | null;
};

export type CfD1TableInfo = {
  name: string;
  row_count: number | null;
};

type CfApiResponse<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ message: string }>;
};

async function cfFetch<T>(
  token: string,
  url: string,
  options?: RequestInit
): Promise<CfApiResponse<T>> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Cloudflare API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<CfApiResponse<T>>;
}

export async function listD1Databases(
  token: string,
  accountId: string
): Promise<CfD1Database[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database?per_page=100`;
  const data = await cfFetch<CfD1Database[]>(token, url);
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message ?? 'D1 database list failed');
  }
  return data.result ?? [];
}

export async function queryD1Database(
  token: string,
  accountId: string,
  databaseId: string,
  sql: string
): Promise<Array<Record<string, unknown>>> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const data = await cfFetch<Array<{ results: Array<Record<string, unknown>> }>>(token, url, {
    method: 'POST',
    body: JSON.stringify({ sql }),
  });
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message ?? 'D1 query failed');
  }
  return data.result?.[0]?.results ?? [];
}

export async function getD1Tables(
  token: string,
  accountId: string,
  databaseId: string
): Promise<CfD1TableInfo[]> {
  const rows = await queryD1Database(
    token,
    accountId,
    databaseId,
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`
  );
  const tables: CfD1TableInfo[] = [];
  for (const row of rows) {
    const name = String(row['name'] ?? '');
    if (!name) continue;
    let rowCount: number | null = null;
    try {
      const countRows = await queryD1Database(
        token,
        accountId,
        databaseId,
        `SELECT COUNT(*) as cnt FROM "${name}"`
      );
      const cnt = countRows[0]?.['cnt'];
      rowCount = typeof cnt === 'number' ? cnt : null;
    } catch {
      rowCount = null;
    }
    tables.push({ name, row_count: rowCount });
  }
  return tables;
}
