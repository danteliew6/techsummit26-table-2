-- Build-2 evidence: the writable Postgres table AFTER you approve an NBA in the app.
-- Save output as writeback_table.json. Run AFTER clicking Approve in the Book of Business drawer.
SELECT id, customer_id, action_type, offered_product_id, rate_apy, drafted_note,
       predicted_retained_usd, status, approved_by, audit_trail, created_at, decided_at
FROM app.rm_actions
ORDER BY created_at DESC
LIMIT 20;
