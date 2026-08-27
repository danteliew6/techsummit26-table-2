-- At-risk customers + revenue at risk by relationship tier (Meridian).
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
SELECT
  tier,
  CAST(COUNT(*) AS BIGINT) AS atrisk_customers,
  CAST(ROUND(SUM(revenue_at_risk_usd), 2) AS DOUBLE) AS revenue_at_risk_usd
FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_customer_position')
WHERE risk_band IN ('critical', 'elevated', 'watch')
GROUP BY tier
ORDER BY revenue_at_risk_usd DESC
