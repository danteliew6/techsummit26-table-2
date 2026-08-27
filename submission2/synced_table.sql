-- Build-1 evidence: read path to the synced UC table (Lakehouse→Lakebase).
-- Save output as synced_table_result.json (non-empty).
SELECT customer_id, tier, risk_band, attrition_risk_score,
       balance_at_risk_usd, revenue_at_risk_usd, min_days_to_maturity
FROM exercise.synced_gold_customer_position
WHERE risk_band IN ('critical','elevated','watch')
ORDER BY revenue_at_risk_usd DESC
LIMIT 20;
