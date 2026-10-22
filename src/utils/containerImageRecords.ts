export interface ContainerImageRecord {
  schemaVersion: 1;
  kind: 'build-timing' | 'runtime-analysis' | 'image-manifest';
  build: { buildUuid: string; [key: string]: unknown };
  measuredAt: string | null;
  [key: string]: unknown;
}
export async function imageRecordHash(json: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function prepareImageRecord(db: D1Database, record: ContainerImageRecord) {
  if (record.schemaVersion !== 1 || !['build-timing','runtime-analysis','image-manifest'].includes(record.kind) || typeof record.build?.buildUuid !== 'string' || !record.build.buildUuid || record.build.buildUuid.length > 200 || (record.measuredAt !== null && !Number.isFinite(Date.parse(record.measuredAt)))) throw new Error('Invalid image record');
  const json=JSON.stringify(record);
  if (new TextEncoder().encode(json).length > 512*1024) throw new Error('Image record exceeds 512 KiB');
  const hash=await imageRecordHash(json);
  return {hash,statement:db.prepare('INSERT OR IGNORE INTO cf_container_image_records (record_hash,build_uuid,kind,measured_at,record_json) VALUES (?,?,?,?,?)').bind(hash,record.build.buildUuid,record.kind,record.measuredAt,json)};
}
export async function loadImageRecords(db: D1Database) {
  const {results}=await db.prepare('SELECT record_hash,build_uuid,kind,measured_at,recorded_at,record_json FROM cf_container_image_records ORDER BY recorded_at DESC,record_hash DESC LIMIT 30').all<{record_hash:string;build_uuid:string;kind:string;measured_at:string|null;recorded_at:string;record_json:string}>();
  for(const row of results ?? []) {
    if(await imageRecordHash(row.record_json)!==row.record_hash) throw new Error('Image record checksum mismatch');
    const record=JSON.parse(row.record_json) as ContainerImageRecord;
    if(record.build?.buildUuid!==row.build_uuid || record.kind!==row.kind || record.measuredAt!==row.measured_at) throw new Error('Image record metadata mismatch');
  }
  return results ?? [];
}
