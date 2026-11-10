CREATE TABLE inquiry_improvement_events (
 event_id TEXT NOT NULL PRIMARY KEY,
 proposal_id TEXT NOT NULL REFERENCES inquiry_proposals(id),
 work_run_id TEXT NOT NULL,
 source_entry_id TEXT NOT NULL,
 previous_event_id TEXT REFERENCES inquiry_improvement_events(event_id),
 classification TEXT NOT NULL CHECK(classification IN ('new','refinement','duplicate')),
 refines_proposal_id TEXT REFERENCES inquiry_proposals(id),
 duplicate_of_proposal_id TEXT REFERENCES inquiry_proposals(id),
 feasibility TEXT NOT NULL CHECK(feasibility IN ('unverified','conditional','confirmed','invalid')),
 optimality TEXT NOT NULL DEFAULT 'unassessed' CHECK(optimality IN ('unassessed','competitive','dominated')),
 comparison_basis TEXT NOT NULL DEFAULT '',
 context_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(context_json) AND json_type(context_json)='object'),
 delivery TEXT NOT NULL CHECK(delivery IN ('not_implemented','implemented','effect_verified')),
 reason TEXT NOT NULL CHECK(length(trim(reason))>0),
 evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json) AND json_type(evidence_json)='array' AND ((feasibility!='confirmed' AND optimality!='competitive' AND delivery='not_implemented') OR json_array_length(evidence_json)>0)),
 constraint_refs_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(constraint_refs_json) AND json_type(constraint_refs_json)='array'),
 recorded_by TEXT NOT NULL CHECK(length(trim(recorded_by))>0),
 proposal_text_snapshot TEXT NOT NULL CHECK(length(trim(proposal_text_snapshot))>0),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 UNIQUE(previous_event_id),
 CHECK(optimality!='competitive' OR length(trim(comparison_basis))>0),
 CHECK((classification='duplicate')=(duplicate_of_proposal_id IS NOT NULL)),
 CHECK((classification='refinement')=(refines_proposal_id IS NOT NULL)),
 CHECK(duplicate_of_proposal_id IS NULL OR duplicate_of_proposal_id!=proposal_id),
 CHECK(refines_proposal_id IS NULL OR refines_proposal_id!=proposal_id),
 FOREIGN KEY(work_run_id,source_entry_id) REFERENCES inquiry_work_groups(run_id,entry_id)
);
CREATE UNIQUE INDEX inquiry_improvement_one_root ON inquiry_improvement_events(proposal_id) WHERE previous_event_id IS NULL;
CREATE TRIGGER inquiry_improvement_no_update BEFORE UPDATE ON inquiry_improvement_events
BEGIN SELECT RAISE(ABORT,'improvement events append-only'); END;
CREATE TRIGGER inquiry_improvement_no_delete BEFORE DELETE ON inquiry_improvement_events
BEGIN SELECT RAISE(ABORT,'improvement events append-only'); END;
CREATE TRIGGER inquiry_improvement_no_replace BEFORE INSERT ON inquiry_improvement_events
WHEN EXISTS(SELECT 1 FROM inquiry_improvement_events WHERE event_id=NEW.event_id OR (NEW.previous_event_id IS NOT NULL AND previous_event_id=NEW.previous_event_id) OR (NEW.previous_event_id IS NULL AND previous_event_id IS NULL AND proposal_id=NEW.proposal_id))
BEGIN SELECT RAISE(ABORT,'improvement events append-only duplicate'); END;
CREATE TRIGGER inquiry_improvement_chain BEFORE INSERT ON inquiry_improvement_events
WHEN NEW.previous_event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inquiry_improvement_events WHERE event_id=NEW.previous_event_id AND proposal_id=NEW.proposal_id)
BEGIN SELECT RAISE(ABORT,'improvement chain mismatch'); END;
CREATE TRIGGER inquiry_improvement_case BEFORE INSERT ON inquiry_improvement_events
WHEN NOT EXISTS(SELECT 1 FROM inquiry_work_groups g JOIN inquiry_proposals p ON p.case_id=g.case_id WHERE g.run_id=NEW.work_run_id AND g.entry_id=NEW.source_entry_id AND p.id=NEW.proposal_id)
BEGIN SELECT RAISE(ABORT,'improvement source case mismatch'); END;
CREATE TRIGGER inquiry_improvement_baseline BEFORE INSERT ON inquiry_improvement_events
WHEN NEW.classification='new' AND (
 NOT EXISTS(SELECT 1 FROM inquiry_work_runs WHERE id=COALESCE((SELECT work_run_id FROM inquiry_improvement_events WHERE proposal_id=NEW.proposal_id AND previous_event_id IS NULL),NEW.work_run_id) AND json_type(progress_snapshot_json,'$.proposals')='array') OR
 EXISTS(SELECT 1 FROM inquiry_work_runs r,json_each(r.progress_snapshot_json,'$.proposals') p WHERE r.id=COALESCE((SELECT work_run_id FROM inquiry_improvement_events WHERE proposal_id=NEW.proposal_id AND previous_event_id IS NULL),NEW.work_run_id) AND json_extract(p.value,'$.id')=NEW.proposal_id))
BEGIN SELECT RAISE(ABORT,'existing or missing baseline cannot be counted as new'); END;
CREATE VIEW inquiry_improvement_current AS
SELECT e.*,p.status AS proposal_status,
 (SELECT root.work_run_id FROM inquiry_improvement_events root WHERE root.proposal_id=e.proposal_id AND root.previous_event_id IS NULL) AS origin_work_run_id
FROM inquiry_improvement_events e JOIN inquiry_proposals p ON p.id=e.proposal_id
WHERE NOT EXISTS(SELECT 1 FROM inquiry_improvement_events child WHERE child.previous_event_id=e.event_id);
CREATE VIEW inquiry_improvement_summary AS
SELECT r.id AS run_id,
 COUNT(c.proposal_id) AS tracked_plans,
 COALESCE(SUM(c.classification='new' AND c.feasibility!='invalid' AND c.proposal_status!='rejected'),0) AS new_independent,
 COALESCE(SUM(c.classification='refinement' AND c.feasibility!='invalid' AND c.proposal_status!='rejected'),0) AS refinements,
 COALESCE(SUM(c.classification='duplicate'),0) AS duplicates,
 COALESCE(SUM(c.classification!='duplicate' AND c.feasibility='conditional' AND c.proposal_status!='rejected'),0) AS conditional,
 COALESCE(SUM(c.classification!='duplicate' AND c.feasibility='unverified' AND c.proposal_status!='rejected'),0) AS unverified,
 COALESCE(SUM(c.classification!='duplicate' AND c.feasibility='confirmed' AND c.proposal_status!='rejected'),0) AS confirmed_feasible,
 COALESCE(SUM(c.classification!='duplicate' AND c.feasibility='confirmed' AND c.optimality='competitive' AND c.proposal_status!='rejected'),0) AS confirmed_competitive,
 COALESCE(SUM(c.classification!='duplicate' AND c.feasibility='conditional' AND c.optimality='competitive' AND c.proposal_status!='rejected'),0) AS conditional_competitive,
 COALESCE(SUM(c.classification!='duplicate' AND c.feasibility='confirmed' AND c.proposal_status='adopted'),0) AS adopted_confirmed,
 COALESCE(SUM(c.classification!='duplicate' AND c.delivery IN ('implemented','effect_verified') AND c.proposal_status!='rejected'),0) AS implemented,
 COALESCE(SUM(c.classification!='duplicate' AND c.delivery='effect_verified' AND c.proposal_status!='rejected'),0) AS effect_verified,
 COALESCE(SUM(c.feasibility='invalid' OR c.proposal_status='rejected'),0) AS invalid_or_rejected
FROM inquiry_work_runs r LEFT JOIN inquiry_improvement_current c ON c.origin_work_run_id=r.id
GROUP BY r.id;
CREATE VIEW inquiry_improvement_contexts AS
SELECT c.proposal_id,c.origin_work_run_id,j.key AS category,json_extract(item.value,'$.id') AS context_id,item.value AS context_json
FROM inquiry_improvement_current c,json_each(c.context_json) j,json_each(CASE WHEN j.type='array' THEN j.value ELSE '[]' END) item
WHERE j.key IN ('fixed_constraints','policy_constraints','uncertainties','dependencies') AND j.type='array' AND item.type='object';
CREATE TRIGGER inquiry_improvement_context_shape BEFORE INSERT ON inquiry_improvement_events
WHEN EXISTS(
 SELECT 1 FROM json_each(NEW.context_json) j
 WHERE j.key IN ('fixed_constraints','policy_constraints','uncertainties','dependencies') AND (
 j.type!='array' OR EXISTS(
 SELECT 1 FROM json_each(CASE WHEN j.type='array' THEN j.value ELSE '[]' END) item
 WHERE item.type!='object' OR COALESCE(json_type(CASE WHEN item.type='object' THEN item.value ELSE '{}' END,'$.id'),'')!='text'
 OR length(trim(COALESCE(json_extract(CASE WHEN item.type='object' THEN item.value ELSE '{}' END,'$.id'),'')))=0)))
BEGIN SELECT RAISE(ABORT,'improvement context shape invalid'); END;
CREATE VIEW inquiry_context_summary AS
SELECT origin_work_run_id AS run_id,category,COUNT(DISTINCT context_id) AS context_count,COUNT(DISTINCT proposal_id) AS affected_plans
FROM inquiry_improvement_contexts GROUP BY origin_work_run_id,category;
