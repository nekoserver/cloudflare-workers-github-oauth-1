export interface SqlcIrField {
  name: string;
  source?: string | null;
  databaseType: string;
  nullable: boolean | null;
}

export interface SqlcIrQuery {
  name: string;
  command: string;
  cardinality: { minimum: number | null; maximum: number | null };
  filename: string | null;
  parameters: SqlcIrField[];
  resultColumns: SqlcIrField[];
}

export interface SqlcIr {
  version: 1;
  source: 'sqlc-codegen-request';
  engine: string | null;
  queries: SqlcIrQuery[];
}

export interface SqlcIrFinding {
  code: string;
  query: string;
  detail: string;
}

export interface SqlcIrDiff {
  breaking: SqlcIrFinding[];
  nonBreaking: SqlcIrFinding[];
}

export function buildSqlcIr(request: unknown): SqlcIr;
export function compareSqlcIr(baseline: SqlcIr, current: SqlcIr): SqlcIrDiff;
export function formatSqlcIrMarkdown(ir: SqlcIr): string;
export function runCli(argv: string[]): number;
