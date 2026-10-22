-- Multi-container aggregation. Work targets are optional; revenue and cost allocation are deferred.
-- Apply after 0185. 0186 supports the legacy operation-log/session-note UI.
-- All timestamps supplied below are ISO 8601 UTC (Z), not client-local dates.

CREATE TABLE IF NOT EXISTS cf_container_resources (
  container_id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  account_ref TEXT NOT NULL,
  application_ref TEXT NOT NULL,
  instance_ref TEXT NOT NULL,
  display_name TEXT NOT NULL,
  parent_container_id TEXT REFERENCES cf_container_resources(container_id),
  created_at TEXT NOT NULL CHECK(julianday(created_at) IS NOT NULL AND substr(created_at,-1)='Z'),
  CHECK(parent_container_id IS NULL OR parent_container_id <> container_id),
  UNIQUE(provider, account_ref, application_ref, instance_ref)
);

CREATE TABLE IF NOT EXISTS cf_container_runtime_sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  container_id TEXT NOT NULL REFERENCES cf_container_resources(container_id),
  image_record_hash TEXT REFERENCES cf_container_image_records(record_hash),
  started_at TEXT NOT NULL CHECK(julianday(started_at) IS NOT NULL AND substr(started_at,-1)='Z'),
  ended_at TEXT CHECK(ended_at IS NULL OR (julianday(ended_at) IS NOT NULL AND substr(ended_at,-1)='Z' AND julianday(ended_at)>=julianday(started_at))),
  state TEXT NOT NULL CHECK(state IN ('running','ended','incomplete')),
  evidence TEXT NOT NULL CHECK(evidence IN ('observed','inferred','imported')),
  configuration_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(configuration_json)),
  created_at TEXT NOT NULL CHECK(julianday(created_at) IS NOT NULL AND substr(created_at,-1)='Z'),
  CHECK((state='ended' AND ended_at IS NOT NULL) OR (state IN ('running','incomplete') AND ended_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_container_one_running_session
  ON cf_container_runtime_sessions(container_id) WHERE state='running';
CREATE INDEX IF NOT EXISTS idx_container_sessions_interval
  ON cf_container_runtime_sessions(container_id,started_at,ended_at);

CREATE TABLE IF NOT EXISTS cf_container_runtime_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  container_id TEXT REFERENCES cf_container_resources(container_id),
  session_id TEXT REFERENCES cf_container_runtime_sessions(session_id),
  source TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL CHECK(julianday(occurred_at) IS NOT NULL AND substr(occurred_at,-1)='Z'),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  event_type TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('success','failure','unknown')),
  actor TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail_json)),
  CHECK(session_id IS NULL OR container_id IS NOT NULL),
  UNIQUE(source,source_event_id)
);
CREATE INDEX IF NOT EXISTS idx_container_runtime_events_time
  ON cf_container_runtime_events(container_id,occurred_at);
CREATE TRIGGER IF NOT EXISTS container_event_identity_insert
BEFORE INSERT ON cf_container_runtime_events WHEN NEW.session_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM cf_container_runtime_sessions s
    WHERE s.session_id=NEW.session_id AND s.container_id=NEW.container_id
  ) THEN RAISE(ABORT,'event/session container mismatch') END;
END;

CREATE TABLE IF NOT EXISTS cf_container_work_targets (
  target_id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK(length(trim(kind))>0), -- project, task, research, analysis, product, etc.; extensible
  display_name TEXT NOT NULL,
  parent_target_id TEXT REFERENCES cf_container_work_targets(target_id),
  state TEXT NOT NULL CHECK(state IN ('active','paused','completed','archived')),
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL CHECK(julianday(created_at) IS NOT NULL AND substr(created_at,-1)='Z'),
  CHECK(parent_target_id IS NULL OR parent_target_id<>target_id)
);

-- Optional labels only. An empty association set is valid and never blocks statistics.
CREATE TABLE IF NOT EXISTS cf_container_session_targets (
  session_id TEXT NOT NULL REFERENCES cf_container_runtime_sessions(session_id),
  target_id TEXT NOT NULL REFERENCES cf_container_work_targets(target_id),
  PRIMARY KEY(session_id,target_id)
);
CREATE TABLE IF NOT EXISTS cf_container_runtime_notes (
  note_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES cf_container_runtime_sessions(session_id),
  entry_key TEXT NOT NULL DEFAULT 'session-summary' CHECK(length(trim(entry_key))>0),
  revision INTEGER NOT NULL CHECK(revision>0),
  content TEXT NOT NULL CHECK(length(content)<=8000),
  work_category TEXT CHECK(work_category IS NULL OR length(trim(work_category))>0),
  purpose TEXT,
  outcome TEXT,
  tools_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tools_json) AND json_type(tools_json)='array'),
  classification_source TEXT NOT NULL DEFAULT 'unknown' CHECK(classification_source IN ('manual','rule','ai','unknown')),
  evidence_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(evidence_json) AND json_type(evidence_json)='array'),
  work_started_at TEXT CHECK(work_started_at IS NULL OR (julianday(work_started_at) IS NOT NULL AND substr(work_started_at,-1)='Z')),
  work_ended_at TEXT CHECK(work_ended_at IS NULL OR (work_started_at IS NOT NULL AND julianday(work_ended_at) IS NOT NULL AND substr(work_ended_at,-1)='Z' AND julianday(work_ended_at)>=julianday(work_started_at))),
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL CHECK(julianday(recorded_at) IS NOT NULL AND substr(recorded_at,-1)='Z'),
  UNIQUE(session_id,entry_key,revision)
);

-- Monetary amounts use integer millionths of the named currency; NULL is unknown.
-- Each cost_key identifies ONE charge component. A new revision replaces its estimate.
CREATE TABLE IF NOT EXISTS cf_container_cost_observations (
  cost_record_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES cf_container_runtime_sessions(session_id),
  cost_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0),
  category TEXT NOT NULL CHECK(category IN ('cpu','memory','disk','network','build','model','other')),
  currency TEXT NOT NULL CHECK(currency GLOB '[A-Z][A-Z][A-Z]'),
  amount_micros INTEGER CHECK(amount_micros IS NULL OR (typeof(amount_micros)='integer' AND amount_micros>=0 AND amount_micros<=9007199254740991)),
  basis TEXT NOT NULL CHECK(basis IN ('actual','estimate','upper_bound','unknown')),
  voided INTEGER NOT NULL DEFAULT 0 CHECK(voided IN (0,1)),
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  measured_at TEXT NOT NULL CHECK(julianday(measured_at) IS NOT NULL AND substr(measured_at,-1)='Z'),
  recorded_by TEXT NOT NULL,
  calculation_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(calculation_json)),
  CHECK((basis='unknown' AND amount_micros IS NULL) OR (basis<>'unknown' AND amount_micros IS NOT NULL)),
  CHECK(voided=0 OR (amount_micros IS NULL AND basis='unknown')),
  UNIQUE(session_id,cost_key,revision),
  UNIQUE(source,source_ref)
);

CREATE TABLE IF NOT EXISTS cf_container_filesystem_policies (
  policy_id TEXT PRIMARY KEY NOT NULL,
  image_record_hash TEXT REFERENCES cf_container_image_records(record_hash),
  container_id TEXT REFERENCES cf_container_resources(container_id),
  path TEXT NOT NULL CHECK(substr(path,1,1)='/'),
  principal TEXT NOT NULL,
  mount_kind TEXT NOT NULL CHECK(mount_kind IN ('rootfs','bind','volume','tmpfs','other','unknown')),
  writable INTEGER CHECK(writable IS NULL OR writable IN (0,1)),
  persistence TEXT NOT NULL CHECK(persistence IN ('ephemeral','external','unknown')),
  definition_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(definition_json)),
  recorded_at TEXT NOT NULL CHECK(julianday(recorded_at) IS NOT NULL AND substr(recorded_at,-1)='Z'),
  CHECK(image_record_hash IS NOT NULL OR container_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS cf_container_filesystem_observations (
  observation_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES cf_container_runtime_sessions(session_id),
  policy_id TEXT REFERENCES cf_container_filesystem_policies(policy_id),
  path TEXT NOT NULL CHECK(substr(path,1,1)='/'),
  principal TEXT NOT NULL,
  uid INTEGER CHECK(uid IS NULL OR uid>=0),
  gid INTEGER CHECK(gid IS NULL OR gid>=0),
  mount_mode TEXT NOT NULL CHECK(mount_mode IN ('ro','rw','unknown')),
  write_status TEXT NOT NULL CHECK(write_status IN ('allowed','denied','unknown','untested')),
  failure_reason TEXT CHECK(failure_reason IS NULL OR failure_reason IN ('read_only','permission','capacity','other')),
  probe_method TEXT NOT NULL CHECK(probe_method IN ('metadata','access','create_delete','other')),
  observed_at TEXT NOT NULL CHECK(julianday(observed_at) IS NOT NULL AND substr(observed_at,-1)='Z'),
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail_json)),
  CHECK(failure_reason IS NULL OR write_status='denied'),
  CHECK(mount_mode<>'ro' OR write_status<>'allowed'),
  UNIQUE(source,source_ref)
);

CREATE VIEW IF NOT EXISTS cf_container_latest_costs AS
SELECT c.* FROM cf_container_cost_observations c
WHERE NOT EXISTS (SELECT 1 FROM cf_container_cost_observations newer WHERE newer.session_id=c.session_id AND newer.cost_key=c.cost_key AND newer.revision>c.revision);

CREATE VIEW IF NOT EXISTS cf_container_latest_runtime_notes AS
SELECT n.* FROM cf_container_runtime_notes n WHERE NOT EXISTS (
  SELECT 1 FROM cf_container_runtime_notes newer WHERE newer.session_id=n.session_id AND newer.entry_key=n.entry_key AND newer.revision>n.revision
);

-- Event/observation records are append-only. Corrections use a new event or revision.
CREATE TRIGGER IF NOT EXISTS cf_container_runtime_events_update_immutable
BEFORE UPDATE ON cf_container_runtime_events
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_runtime_events_delete_immutable
BEFORE DELETE ON cf_container_runtime_events
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_runtime_notes_update_immutable
BEFORE UPDATE ON cf_container_runtime_notes
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_runtime_notes_delete_immutable
BEFORE DELETE ON cf_container_runtime_notes
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_cost_observations_update_immutable
BEFORE UPDATE ON cf_container_cost_observations
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_cost_observations_delete_immutable
BEFORE DELETE ON cf_container_cost_observations
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_filesystem_policies_update_immutable
BEFORE UPDATE ON cf_container_filesystem_policies
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_filesystem_policies_delete_immutable
BEFORE DELETE ON cf_container_filesystem_policies
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_filesystem_observations_update_immutable
BEFORE UPDATE ON cf_container_filesystem_observations
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;
CREATE TRIGGER IF NOT EXISTS cf_container_filesystem_observations_delete_immutable
BEFORE DELETE ON cf_container_filesystem_observations
BEGIN SELECT RAISE(ABORT,'append-only record; add a correction revision'); END;

CREATE TRIGGER IF NOT EXISTS container_session_identity_guard
BEFORE UPDATE ON cf_container_runtime_sessions
WHEN NEW.session_id<>OLD.session_id OR NEW.container_id<>OLD.container_id OR NEW.started_at<>OLD.started_at
BEGIN SELECT RAISE(ABORT,'session identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS container_session_delete_guard
BEFORE DELETE ON cf_container_runtime_sessions
BEGIN SELECT RAISE(ABORT,'retain session history'); END;
CREATE TRIGGER IF NOT EXISTS container_session_overlap_insert
BEFORE INSERT ON cf_container_runtime_sessions WHEN NEW.state<>'incomplete'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM cf_container_runtime_sessions s WHERE s.container_id=NEW.container_id AND s.state<>'incomplete'
      AND julianday(s.started_at)<COALESCE(julianday(NEW.ended_at),1e20)
      AND julianday(NEW.started_at)<COALESCE(julianday(s.ended_at),1e20)
  ) THEN RAISE(ABORT,'overlapping sessions for the same container') END;
END;
CREATE TRIGGER IF NOT EXISTS container_session_overlap_update
BEFORE UPDATE ON cf_container_runtime_sessions WHEN NEW.state<>'incomplete'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM cf_container_runtime_sessions s WHERE s.container_id=NEW.container_id AND s.session_id<>NEW.session_id AND s.state<>'incomplete'
      AND julianday(s.started_at)<COALESCE(julianday(NEW.ended_at),1e20)
      AND julianday(NEW.started_at)<COALESCE(julianday(s.ended_at),1e20)
  ) THEN RAISE(ABORT,'overlapping sessions for the same container') END;
END;

CREATE TRIGGER IF NOT EXISTS container_closed_session_guard
BEFORE UPDATE ON cf_container_runtime_sessions WHEN OLD.state='ended'
BEGIN SELECT RAISE(ABORT,'closed session is immutable; retain correction evidence separately'); END;
CREATE TRIGGER IF NOT EXISTS container_filesystem_policy_identity_guard
BEFORE INSERT ON cf_container_filesystem_observations WHEN NEW.policy_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM cf_container_filesystem_policies p JOIN cf_container_runtime_sessions s ON s.session_id=NEW.session_id
    WHERE p.policy_id=NEW.policy_id
      AND (p.container_id IS NULL OR p.container_id=s.container_id)
      AND (p.image_record_hash IS NULL OR p.image_record_hash=s.image_record_hash)
  ) THEN RAISE(ABORT,'filesystem policy/session mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS container_work_note_interval_guard
BEFORE INSERT ON cf_container_runtime_notes WHEN NEW.work_started_at IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM cf_container_runtime_sessions s WHERE s.session_id=NEW.session_id
      AND julianday(NEW.work_started_at)>=julianday(s.started_at)
      AND (s.ended_at IS NULL OR julianday(NEW.work_started_at)<=julianday(s.ended_at))
      AND (NEW.work_ended_at IS NULL OR s.ended_at IS NULL OR julianday(NEW.work_ended_at)<=julianday(s.ended_at))
  ) THEN RAISE(ABORT,'work interval outside runtime session') END;
END;
