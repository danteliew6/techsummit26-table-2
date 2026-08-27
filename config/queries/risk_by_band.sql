-- Balance- and revenue-at-risk by risk band (Meridian).
-- Tables are referenced via IDENTIFIER(:catalog || '.' || :schema || '.t') so
-- the query resolves on any workspace; :catalog/:schema are bound at runtime by
-- server/routes/charts.ts and sampled at typegen via the @param annotations.
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
SELECT
  risk_band,
  CAST(COUNT(*) AS BIGINT) AS customers,
  CAST(ROUND(SUM(balance_at_risk_usd), 2) AS DOUBLE) AS balance_at_risk_usd,
  CAST(ROUND(SUM(revenue_at_risk_usd), 2) AS DOUBLE) AS revenue_at_risk_usd
FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_customer_position')
GROUP BY risk_band
ORDER BY CASE risk_band
  WHEN 'critical' THEN 0 WHEN 'elevated' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END
