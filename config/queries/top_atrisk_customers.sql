-- Top at-risk customers by revenue at risk (Meridian).
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
SELECT
  customer_id,
  tier,
  risk_band,
  home_metro,
  CAST(ROUND(attrition_risk_score, 3) AS DOUBLE) AS attrition_risk_score,
  CAST(ROUND(balance_at_risk_usd, 2) AS DOUBLE) AS balance_at_risk_usd,
  CAST(ROUND(revenue_at_risk_usd, 2) AS DOUBLE) AS revenue_at_risk_usd,
  CAST(min_days_to_maturity AS BIGINT) AS min_days_to_maturity
FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_customer_position')
WHERE risk_band IN ('critical', 'elevated', 'watch')
ORDER BY revenue_at_risk_usd DESC
LIMIT 20
