CREATE TABLE IF NOT EXISTS t3_pwa_handoffs (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 32 AND 128),
  device_challenge TEXT NOT NULL CHECK(length(device_challenge)=64 AND device_challenge NOT GLOB '*[^0-9a-f]*'),
  confirmation_code TEXT NOT NULL CHECK(length(confirmation_code)=8 AND confirmation_code NOT GLOB '*[^A-Z2-9]*'),
  target_origin TEXT NOT NULL CHECK(target_origin GLOB 'https://*' AND length(target_origin) BETWEEN 9 AND 253),
  target_environment_key TEXT NOT NULL CHECK(length(target_environment_key) BETWEEN 1 AND 128),
  environment_generation TEXT NOT NULL CHECK(length(environment_generation) BETWEEN 1 AND 128),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','redeeming','consumed','failed','expired','cancelled')),
  approved_by TEXT,
  approved_at INTEGER,
  approved_scopes TEXT CHECK(approved_scopes IS NULL OR (json_valid(approved_scopes) AND json_type(approved_scopes)='array' AND json_array_length(approved_scopes)>0)),
  created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>0),
  expires_at INTEGER NOT NULL CHECK(typeof(expires_at)='integer' AND expires_at=created_at+300),
  updated_at INTEGER NOT NULL CHECK(typeof(updated_at)='integer' AND updated_at>=created_at),
  changed_by TEXT NOT NULL CHECK(length(changed_by) BETWEEN 1 AND 128),
  change_source TEXT NOT NULL CHECK(change_source IN ('pwa','tree-view','worker','recovery')),
  attempt_id TEXT UNIQUE CHECK(attempt_id IS NULL OR length(attempt_id) BETWEEN 32 AND 128),
  claimed_at INTEGER,
  completed_at INTEGER,
  failure_code TEXT CHECK(failure_code IS NULL OR (length(failure_code) BETWEEN 1 AND 64 AND failure_code NOT GLOB '*[^a-z0-9_]*')),
  CHECK((approved_by IS NULL AND approved_at IS NULL AND approved_scopes IS NULL) OR (approved_by IS NOT NULL AND length(trim(approved_by))>0 AND approved_at IS NOT NULL AND typeof(approved_at)='integer' AND approved_at>=created_at AND approved_at<expires_at AND approved_scopes IS NOT NULL)),
  CHECK(status NOT IN ('approved','redeeming','consumed') OR approved_at IS NOT NULL),
  CHECK(status<>'pending' OR approved_at IS NULL),
  CHECK((attempt_id IS NULL AND claimed_at IS NULL) OR (attempt_id IS NOT NULL AND claimed_at IS NOT NULL AND typeof(claimed_at)='integer' AND approved_at IS NOT NULL AND claimed_at>=approved_at AND claimed_at<expires_at)),
  CHECK((status IN ('redeeming','consumed','failed') AND attempt_id IS NOT NULL) OR (status NOT IN ('redeeming','consumed','failed') AND attempt_id IS NULL)),
  CHECK((status IN ('consumed','failed') AND completed_at IS NOT NULL AND typeof(completed_at)='integer' AND completed_at>=claimed_at AND updated_at>=completed_at) OR (status NOT IN ('consumed','failed') AND completed_at IS NULL)),
  CHECK((status='failed' AND failure_code IS NOT NULL) OR (status<>'failed' AND failure_code IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_handoffs_expiry ON t3_pwa_handoffs(status,expires_at);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_handoffs_owner ON t3_pwa_handoffs(approved_by,created_at);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_handoffs_recovery ON t3_pwa_handoffs(claimed_at) WHERE status='redeeming';
CREATE INDEX IF NOT EXISTS idx_t3_pwa_handoffs_retention ON t3_pwa_handoffs(created_at);

CREATE TABLE IF NOT EXISTS t3_pwa_sessions (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 32 AND 128),
  handoff_id TEXT NOT NULL UNIQUE REFERENCES t3_pwa_handoffs(id),
  attempt_id TEXT NOT NULL UNIQUE CHECK(length(attempt_id) BETWEEN 32 AND 128),
  native_session_id TEXT NOT NULL UNIQUE CHECK(length(native_session_id) BETWEEN 1 AND 256),
  principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 128),
  target_origin TEXT NOT NULL,
  target_environment_key TEXT NOT NULL,
  environment_generation TEXT NOT NULL,
  scopes TEXT NOT NULL CHECK(json_valid(scopes) AND json_type(scopes)='array' AND json_array_length(scopes)>0),
  changed_by TEXT NOT NULL CHECK(length(changed_by) BETWEEN 1 AND 128),
  change_source TEXT NOT NULL CHECK(change_source IN ('pwa','tree-view','worker','recovery')),
  issued_at INTEGER NOT NULL CHECK(typeof(issued_at)='integer' AND issued_at>0),
  expires_at INTEGER NOT NULL CHECK(typeof(expires_at)='integer' AND expires_at>issued_at AND expires_at<=issued_at+86400),
  first_verified_at INTEGER CHECK(first_verified_at IS NULL OR (typeof(first_verified_at)='integer' AND first_verified_at>=issued_at AND first_verified_at<expires_at)),
  last_authenticated_at INTEGER CHECK(last_authenticated_at IS NULL OR (typeof(last_authenticated_at)='integer' AND first_verified_at IS NOT NULL AND last_authenticated_at>=first_verified_at AND last_authenticated_at<expires_at)),
  logged_out_at INTEGER CHECK(logged_out_at IS NULL OR (typeof(logged_out_at)='integer' AND logged_out_at>=issued_at)),
  revoked_at INTEGER CHECK(revoked_at IS NULL OR (typeof(revoked_at)='integer' AND revoked_at>=issued_at)),
  revocation_reason TEXT CHECK(revocation_reason IS NULL OR (length(revocation_reason) BETWEEN 1 AND 64 AND revocation_reason NOT GLOB '*[^a-z0-9_]*')),
  CHECK((first_verified_at IS NULL AND last_authenticated_at IS NULL) OR (first_verified_at IS NOT NULL AND last_authenticated_at IS NOT NULL)),
  CHECK(logged_out_at IS NULL OR last_authenticated_at IS NULL OR logged_out_at>=last_authenticated_at),
  CHECK(revoked_at IS NULL OR last_authenticated_at IS NULL OR revoked_at>=last_authenticated_at),
  CHECK((revoked_at IS NULL AND revocation_reason IS NULL) OR (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_sessions_principal ON t3_pwa_sessions(principal_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_sessions_expiry ON t3_pwa_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_sessions_verified ON t3_pwa_sessions(last_authenticated_at);

CREATE TABLE IF NOT EXISTS t3_pwa_handoff_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handoff_id TEXT NOT NULL REFERENCES t3_pwa_handoffs(id),
  session_id TEXT REFERENCES t3_pwa_sessions(id),
  target_environment_key TEXT NOT NULL,
  environment_generation TEXT NOT NULL,
  actor TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('pwa','tree-view','worker','recovery')),
  event_type TEXT NOT NULL CHECK(event_type IN ('created','state_changed','session_issued','login_verified','session_authenticated','logged_out','revoked')),
  from_status TEXT CHECK(from_status IS NULL OR from_status IN ('pending','approved','rejected','redeeming','consumed','failed','expired','cancelled')),
  to_status TEXT CHECK(to_status IS NULL OR to_status IN ('pending','approved','rejected','redeeming','consumed','failed','expired','cancelled')),
  attempt_id TEXT,
  result TEXT NOT NULL CHECK(result IN ('success','failure')),
  failure_code TEXT,
  occurred_at INTEGER NOT NULL CHECK(typeof(occurred_at)='integer' AND occurred_at>0),
  recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_handoff_events_request ON t3_pwa_handoff_events(handoff_id,id);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_handoff_events_session ON t3_pwa_handoff_events(session_id,id);
CREATE INDEX IF NOT EXISTS idx_t3_pwa_handoff_events_retention ON t3_pwa_handoff_events(recorded_at);

CREATE TRIGGER IF NOT EXISTS t3_pwa_handoffs_pending_insert
BEFORE INSERT ON t3_pwa_handoffs
WHEN NEW.status<>'pending'
BEGIN
  SELECT RAISE(ABORT,'handoff must start pending');
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_handoffs_transition
BEFORE UPDATE ON t3_pwa_handoffs
BEGIN
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.device_challenge IS NOT OLD.device_challenge OR NEW.confirmation_code IS NOT OLD.confirmation_code OR NEW.target_origin IS NOT OLD.target_origin OR NEW.target_environment_key IS NOT OLD.target_environment_key OR NEW.environment_generation IS NOT OLD.environment_generation OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at THEN RAISE(ABORT,'handoff identity is immutable') END;
  SELECT CASE WHEN NOT ((OLD.status='pending' AND NEW.status IN ('approved','rejected','expired','cancelled')) OR (OLD.status='approved' AND NEW.status IN ('redeeming','expired','cancelled')) OR (OLD.status='redeeming' AND NEW.status IN ('consumed','failed'))) THEN RAISE(ABORT,'invalid handoff transition') END;
  SELECT CASE WHEN NEW.updated_at<OLD.updated_at THEN RAISE(ABORT,'handoff time cannot move backwards') END;
  SELECT CASE WHEN OLD.approved_at IS NOT NULL AND (NEW.approved_at IS NOT OLD.approved_at OR NEW.approved_by IS NOT OLD.approved_by OR NEW.approved_scopes IS NOT OLD.approved_scopes) THEN RAISE(ABORT,'approval is immutable') END;
  SELECT CASE WHEN OLD.attempt_id IS NOT NULL AND (NEW.attempt_id IS NOT OLD.attempt_id OR NEW.claimed_at IS NOT OLD.claimed_at) THEN RAISE(ABORT,'claim is immutable') END;
  SELECT CASE WHEN NEW.status IN ('approved','redeeming') AND NEW.updated_at>=NEW.expires_at THEN RAISE(ABORT,'handoff expired') END;
  SELECT CASE WHEN NEW.status='approved' AND NEW.updated_at<NEW.approved_at THEN RAISE(ABORT,'approval time mismatch') END;
  SELECT CASE WHEN NEW.status='redeeming' AND NEW.updated_at<NEW.claimed_at THEN RAISE(ABORT,'claim time mismatch') END;
  SELECT CASE WHEN NEW.status='approved' AND EXISTS(SELECT 1 FROM json_each(NEW.approved_scopes) WHERE type<>'text' OR value NOT IN ('orchestration:read','orchestration:operate','settings:write','providers:manage','diagnostics:read','terminal:read','terminal:operate','source-control:write','filesystem:read','filesystem:write','preview:operate')) THEN RAISE(ABORT,'unsupported handoff scope') END;
  SELECT CASE WHEN NEW.status='consumed' AND NOT EXISTS(SELECT 1 FROM t3_pwa_sessions s WHERE s.handoff_id=NEW.id AND s.attempt_id=NEW.attempt_id AND s.revoked_at IS NULL AND s.logged_out_at IS NULL) THEN RAISE(ABORT,'native session record required') END;
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_handoffs_created_event
AFTER INSERT ON t3_pwa_handoffs
BEGIN
  INSERT INTO t3_pwa_handoff_events(handoff_id,target_environment_key,environment_generation,actor,source,event_type,to_status,result,occurred_at)
  VALUES(NEW.id,NEW.target_environment_key,NEW.environment_generation,NEW.changed_by,NEW.change_source,'created',NEW.status,'success',NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_handoffs_state_event
AFTER UPDATE ON t3_pwa_handoffs
BEGIN
  INSERT INTO t3_pwa_handoff_events(handoff_id,target_environment_key,environment_generation,actor,source,event_type,from_status,to_status,attempt_id,result,failure_code,occurred_at)
  VALUES(NEW.id,NEW.target_environment_key,NEW.environment_generation,NEW.changed_by,NEW.change_source,'state_changed',OLD.status,NEW.status,NEW.attempt_id,CASE WHEN NEW.status IN ('rejected','failed','expired','cancelled') THEN 'failure' ELSE 'success' END,NEW.failure_code,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_sessions_match_insert
BEFORE INSERT ON t3_pwa_sessions
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM t3_pwa_handoffs h WHERE h.id=NEW.handoff_id AND h.status='redeeming' AND h.attempt_id=NEW.attempt_id AND h.approved_by=NEW.principal_id AND h.target_origin=NEW.target_origin AND h.target_environment_key=NEW.target_environment_key AND h.environment_generation=NEW.environment_generation AND h.approved_scopes=NEW.scopes AND NEW.issued_at>=h.claimed_at AND NEW.issued_at<h.claimed_at+60 AND NEW.issued_at<h.expires_at) THEN RAISE(ABORT,'session/handoff mismatch') END;
  SELECT CASE WHEN NEW.first_verified_at IS NOT NULL OR NEW.last_authenticated_at IS NOT NULL OR NEW.logged_out_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN RAISE(ABORT,'session must start unverified') END;
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_sessions_update_guard
BEFORE UPDATE ON t3_pwa_sessions
BEGIN
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.handoff_id IS NOT OLD.handoff_id OR NEW.attempt_id IS NOT OLD.attempt_id OR NEW.native_session_id IS NOT OLD.native_session_id OR NEW.principal_id IS NOT OLD.principal_id OR NEW.target_origin IS NOT OLD.target_origin OR NEW.target_environment_key IS NOT OLD.target_environment_key OR NEW.environment_generation IS NOT OLD.environment_generation OR NEW.scopes IS NOT OLD.scopes OR NEW.issued_at IS NOT OLD.issued_at OR NEW.expires_at IS NOT OLD.expires_at THEN RAISE(ABORT,'session identity is immutable') END;
  SELECT CASE WHEN OLD.first_verified_at IS NULL AND NEW.first_verified_at IS NOT NULL AND NEW.first_verified_at<>NEW.last_authenticated_at THEN RAISE(ABORT,'first login time mismatch') END;
  SELECT CASE WHEN OLD.first_verified_at IS NOT NULL AND NEW.first_verified_at IS NOT OLD.first_verified_at THEN RAISE(ABORT,'first login is immutable') END;
  SELECT CASE WHEN OLD.last_authenticated_at IS NOT NULL AND (NEW.last_authenticated_at IS NULL OR NEW.last_authenticated_at<OLD.last_authenticated_at) THEN RAISE(ABORT,'authentication time cannot move backwards') END;
  SELECT CASE WHEN OLD.logged_out_at IS NOT NULL AND NEW.logged_out_at IS NOT OLD.logged_out_at THEN RAISE(ABORT,'logout is immutable') END;
  SELECT CASE WHEN OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS NOT OLD.revoked_at OR NEW.revocation_reason IS NOT OLD.revocation_reason) THEN RAISE(ABORT,'revocation is immutable') END;
  SELECT CASE WHEN (OLD.logged_out_at IS NOT NULL OR OLD.revoked_at IS NOT NULL) AND (NEW.first_verified_at IS NOT OLD.first_verified_at OR NEW.last_authenticated_at IS NOT OLD.last_authenticated_at) THEN RAISE(ABORT,'session is closed') END;
  SELECT CASE WHEN NEW.last_authenticated_at IS NOT OLD.last_authenticated_at AND NOT EXISTS(SELECT 1 FROM t3_pwa_handoffs h WHERE h.id=NEW.handoff_id AND h.status='consumed') THEN RAISE(ABORT,'handoff must be consumed before login') END;
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_sessions_issued_event
AFTER INSERT ON t3_pwa_sessions
BEGIN
  INSERT INTO t3_pwa_handoff_events(handoff_id,session_id,target_environment_key,environment_generation,actor,source,event_type,attempt_id,result,occurred_at)
  VALUES(NEW.handoff_id,NEW.id,NEW.target_environment_key,NEW.environment_generation,NEW.changed_by,NEW.change_source,'session_issued',NEW.attempt_id,'success',NEW.issued_at);
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_sessions_login_event
AFTER UPDATE ON t3_pwa_sessions
WHEN NEW.last_authenticated_at IS NOT OLD.last_authenticated_at
BEGIN
  INSERT INTO t3_pwa_handoff_events(handoff_id,session_id,target_environment_key,environment_generation,actor,source,event_type,attempt_id,result,occurred_at)
  VALUES(NEW.handoff_id,NEW.id,NEW.target_environment_key,NEW.environment_generation,NEW.changed_by,NEW.change_source,CASE WHEN OLD.first_verified_at IS NULL THEN 'login_verified' ELSE 'session_authenticated' END,NEW.attempt_id,'success',NEW.last_authenticated_at);
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_sessions_logout_event
AFTER UPDATE ON t3_pwa_sessions
WHEN OLD.logged_out_at IS NULL AND NEW.logged_out_at IS NOT NULL
BEGIN
  INSERT INTO t3_pwa_handoff_events(handoff_id,session_id,target_environment_key,environment_generation,actor,source,event_type,attempt_id,result,occurred_at)
  VALUES(NEW.handoff_id,NEW.id,NEW.target_environment_key,NEW.environment_generation,NEW.changed_by,NEW.change_source,'logged_out',NEW.attempt_id,'success',NEW.logged_out_at);
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_sessions_revoked_event
AFTER UPDATE ON t3_pwa_sessions
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  INSERT INTO t3_pwa_handoff_events(handoff_id,session_id,target_environment_key,environment_generation,actor,source,event_type,attempt_id,result,failure_code,occurred_at)
  VALUES(NEW.handoff_id,NEW.id,NEW.target_environment_key,NEW.environment_generation,NEW.changed_by,NEW.change_source,'revoked',NEW.attempt_id,'success',NEW.revocation_reason,NEW.revoked_at);
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_handoff_events_append_only
BEFORE UPDATE ON t3_pwa_handoff_events
BEGIN
  SELECT RAISE(ABORT,'handoff events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_handoff_events_retention_guard
BEFORE DELETE ON t3_pwa_handoff_events
WHEN OLD.recorded_at>=unixepoch()-2592000
BEGIN
  SELECT RAISE(ABORT,'handoff events require 30 day retention');
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_sessions_retention_guard
BEFORE DELETE ON t3_pwa_sessions
WHEN max(OLD.expires_at,coalesce(OLD.logged_out_at,0),coalesce(OLD.revoked_at,0))>=unixepoch()-2592000
BEGIN
  SELECT RAISE(ABORT,'sessions require 30 day retention after closure');
END;
CREATE TRIGGER IF NOT EXISTS t3_pwa_handoffs_retention_guard
BEFORE DELETE ON t3_pwa_handoffs
WHEN OLD.status NOT IN ('rejected','consumed','failed','expired','cancelled') OR OLD.updated_at>=unixepoch()-2592000
BEGIN
  SELECT RAISE(ABORT,'handoffs require terminal state and 30 day retention');
END;
