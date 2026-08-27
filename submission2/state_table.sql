-- Build-2 evidence: workflow-state / observability — actions committed in the last day,
-- showing the audit_trail carrying the decision forward. Save output as state_table.json.
SELECT id, customer_id, action_type, status, approved_by, audit_trail, created_at, decided_at
FROM app.rm_actions
WHERE created_at >= now() - interval '1 day'
ORDER BY created_at DESC;
