CREATE TABLE inquiry_work_runs (
 id TEXT NOT NULL PRIMARY KEY,
 performed_by TEXT NOT NULL CHECK(length(trim(performed_by))>0),
 request_text TEXT NOT NULL CHECK(length(trim(request_text))>0),
 selection_policy TEXT NOT NULL CHECK(length(trim(selection_policy))>0),
 success_criterion TEXT NOT NULL CHECK(length(trim(success_criterion))>0),
 reason_timing TEXT NOT NULL CHECK(reason_timing IN ('contemporaneous','retrospective')),
 expected_items INTEGER NOT NULL CHECK(expected_items>0),
 expected_groups INTEGER NOT NULL CHECK(expected_groups>0 AND expected_groups<=expected_items),
 progress_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(progress_snapshot_json)),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE inquiry_work_groups (
 run_id TEXT NOT NULL REFERENCES inquiry_work_runs(id),
 entry_id TEXT NOT NULL REFERENCES inquiry_entries(id),
 case_id TEXT NOT NULL REFERENCES inquiry_cases(id),
 group_reason TEXT NOT NULL CHECK(length(trim(group_reason))>0),
 goal_snapshot TEXT NOT NULL CHECK(length(trim(goal_snapshot))>0),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 PRIMARY KEY(run_id,entry_id)
);
CREATE TABLE inquiry_work_items (
 run_id TEXT NOT NULL,
 entry_id TEXT NOT NULL,
 key_id TEXT REFERENCES inquiry_keys(id),
 priority_rank INTEGER NOT NULL CHECK(priority_rank>0),
 selection_reason TEXT NOT NULL CHECK(length(trim(selection_reason))>0),
 grouping_reason TEXT NOT NULL CHECK(length(trim(grouping_reason))>0),
 title_snapshot TEXT NOT NULL CHECK(length(trim(title_snapshot))>0),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 proposal_id TEXT REFERENCES inquiry_proposals(id),
 source_case_id TEXT REFERENCES inquiry_cases(id),
 CHECK((key_id IS NOT NULL)+(proposal_id IS NOT NULL)+(source_case_id IS NOT NULL)=1),
 PRIMARY KEY(run_id,priority_rank),
 UNIQUE(run_id,key_id),
 UNIQUE(run_id,proposal_id),
 UNIQUE(run_id,source_case_id),
 FOREIGN KEY(run_id,entry_id) REFERENCES inquiry_work_groups(run_id,entry_id)
);
CREATE TABLE inquiry_work_audits (
 id TEXT NOT NULL PRIMARY KEY,
 run_id TEXT NOT NULL,
 entry_id TEXT NOT NULL,
 audit_timing TEXT NOT NULL CHECK(audit_timing IN ('before_dispatch','retrospective')),
 progress_snapshot_json TEXT NOT NULL CHECK(json_valid(progress_snapshot_json) AND json_type(progress_snapshot_json)='object' AND length(progress_snapshot_json)>2),
 duplicate_check_json TEXT NOT NULL CHECK(json_valid(duplicate_check_json) AND json_type(duplicate_check_json)='object' AND length(duplicate_check_json)>2),
 conclusion TEXT NOT NULL CHECK(length(trim(conclusion))>0),
 checked_by TEXT NOT NULL CHECK(length(trim(checked_by))>0),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 FOREIGN KEY(run_id,entry_id) REFERENCES inquiry_work_groups(run_id,entry_id)
);
CREATE TABLE inquiry_work_completions (
 run_id TEXT NOT NULL PRIMARY KEY REFERENCES inquiry_work_runs(id),
 recorded_by TEXT NOT NULL CHECK(length(trim(recorded_by))>0),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE inquiry_work_evaluations (
 id TEXT NOT NULL PRIMARY KEY,
 run_id TEXT NOT NULL REFERENCES inquiry_work_runs(id),
 phase TEXT NOT NULL CHECK(phase IN ('problem_discovery','resolution')),
 outcome TEXT NOT NULL CHECK(outcome IN ('unknown','progress','success','failure')),
 reason TEXT NOT NULL CHECK(length(trim(reason))>0),
 evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json) AND json_type(evidence_json)='array' AND (outcome NOT IN ('progress','success') OR json_array_length(evidence_json)>0)),
 assessed_by TEXT NOT NULL CHECK(length(trim(assessed_by))>0),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TRIGGER inquiry_work_groups_match BEFORE INSERT ON inquiry_work_groups
WHEN NOT EXISTS(SELECT 1 FROM inquiry_entries WHERE id=NEW.entry_id AND case_id=NEW.case_id)
BEGIN SELECT RAISE(ABORT,'entry case mismatch'); END;
CREATE TRIGGER inquiry_work_items_match BEFORE INSERT ON inquiry_work_items
WHEN NOT EXISTS(
 SELECT 1 FROM inquiry_work_groups g WHERE g.run_id=NEW.run_id AND g.entry_id=NEW.entry_id AND (
 (NEW.key_id IS NOT NULL AND EXISTS(SELECT 1 FROM inquiry_keys k JOIN inquiry_entry_keys ek ON ek.key_id=k.id WHERE k.id=NEW.key_id AND k.case_id=g.case_id AND ek.entry_id=NEW.entry_id AND ek.role='target')) OR
 (NEW.proposal_id IS NOT NULL AND EXISTS(SELECT 1 FROM inquiry_proposals p WHERE p.id=NEW.proposal_id AND p.case_id=g.case_id)) OR
 NEW.source_case_id=g.case_id))
BEGIN SELECT RAISE(ABORT,'target case mismatch'); END;
CREATE TRIGGER inquiry_work_complete_count BEFORE INSERT ON inquiry_work_completions
WHEN NOT EXISTS(SELECT 1 FROM inquiry_work_runs r WHERE r.id=NEW.run_id
 AND r.expected_items=(SELECT COUNT(*) FROM inquiry_work_items WHERE run_id=r.id)
 AND r.expected_groups=(SELECT COUNT(*) FROM inquiry_work_groups WHERE run_id=r.id)
 AND NOT EXISTS(SELECT 1 FROM inquiry_work_groups g WHERE g.run_id=r.id AND NOT EXISTS(SELECT 1 FROM inquiry_work_items i WHERE i.run_id=g.run_id AND i.entry_id=g.entry_id)))
BEGIN SELECT RAISE(ABORT,'work count mismatch'); END;
CREATE TRIGGER inquiry_work_groups_sealed BEFORE INSERT ON inquiry_work_groups
WHEN EXISTS(SELECT 1 FROM inquiry_work_completions WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'completed work sealed'); END;
CREATE TRIGGER inquiry_work_items_sealed BEFORE INSERT ON inquiry_work_items
WHEN EXISTS(SELECT 1 FROM inquiry_work_completions WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'completed work sealed'); END;
CREATE TRIGGER inquiry_work_runs_no_update BEFORE UPDATE ON inquiry_work_runs
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_runs_no_delete BEFORE DELETE ON inquiry_work_runs
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_groups_no_update BEFORE UPDATE ON inquiry_work_groups
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_groups_no_delete BEFORE DELETE ON inquiry_work_groups
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_items_no_update BEFORE UPDATE ON inquiry_work_items
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_items_no_delete BEFORE DELETE ON inquiry_work_items
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_completions_no_update BEFORE UPDATE ON inquiry_work_completions
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_completions_no_delete BEFORE DELETE ON inquiry_work_completions
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_evaluations_no_update BEFORE UPDATE ON inquiry_work_evaluations
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_evaluations_no_delete BEFORE DELETE ON inquiry_work_evaluations
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_complete_audit BEFORE INSERT ON inquiry_work_completions
WHEN EXISTS(SELECT 1 FROM inquiry_work_groups g WHERE g.run_id=NEW.run_id AND NOT EXISTS(SELECT 1 FROM inquiry_work_audits a WHERE a.run_id=g.run_id AND a.entry_id=g.entry_id))
BEGIN SELECT RAISE(ABORT,'group audit missing'); END;
CREATE TRIGGER inquiry_work_runs_no_replace BEFORE INSERT ON inquiry_work_runs
WHEN EXISTS(SELECT 1 FROM inquiry_work_runs WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'work records append-only duplicate'); END;
CREATE TRIGGER inquiry_work_groups_no_replace BEFORE INSERT ON inquiry_work_groups
WHEN EXISTS(SELECT 1 FROM inquiry_work_groups WHERE run_id=NEW.run_id AND entry_id=NEW.entry_id)
BEGIN SELECT RAISE(ABORT,'work records append-only duplicate'); END;
CREATE TRIGGER inquiry_work_items_no_replace BEFORE INSERT ON inquiry_work_items
WHEN EXISTS(SELECT 1 FROM inquiry_work_items WHERE run_id=NEW.run_id AND (priority_rank=NEW.priority_rank OR key_id=NEW.key_id OR proposal_id=NEW.proposal_id OR source_case_id=NEW.source_case_id))
BEGIN SELECT RAISE(ABORT,'work records append-only duplicate'); END;
CREATE TRIGGER inquiry_work_completions_no_replace BEFORE INSERT ON inquiry_work_completions
WHEN EXISTS(SELECT 1 FROM inquiry_work_completions WHERE run_id=NEW.run_id)
BEGIN SELECT RAISE(ABORT,'work records append-only duplicate'); END;
CREATE TRIGGER inquiry_work_evaluations_no_replace BEFORE INSERT ON inquiry_work_evaluations
WHEN EXISTS(SELECT 1 FROM inquiry_work_evaluations WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'work records append-only duplicate'); END;
CREATE TRIGGER inquiry_work_audits_no_replace BEFORE INSERT ON inquiry_work_audits
WHEN EXISTS(SELECT 1 FROM inquiry_work_audits WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'work records append-only duplicate'); END;
CREATE TRIGGER inquiry_work_audits_no_update BEFORE UPDATE ON inquiry_work_audits
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
CREATE TRIGGER inquiry_work_audits_no_delete BEFORE DELETE ON inquiry_work_audits
BEGIN SELECT RAISE(ABORT,'work records append-only'); END;
