-- /neko tree and tree-view snapshots now support repository paths through depth 7.
UPDATE workflow_steps
SET note = replace(replace(note, '--depth 4', '--depth 7'), '4階層', '7階層')
WHERE workflow_no = (
  SELECT workflow_no
  FROM workflow_registry
  WHERE title = 'tree viewのJSONデータ更新(/neko tree→dynamicneko)'
)
AND step_order = 2;
