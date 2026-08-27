-- Build-2 evidence: the live view the Book of Business renders (app.* view over the synced table).
-- Save output as view_result.json.
SELECT customer_id, tier, risk_band, attrition_risk_score,
       balance_at_risk_usd, revenue_at_risk_usd, min_days_to_maturity, home_metro
FROM app.customer_position
WHERE risk_band IN ('critical','elevated','watch')
ORDER BY revenue_at_risk_usd DESC
LIMIT 50;
