-- Next-best-action mix + predicted retained value by recommended action (Meridian).
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
SELECT
  recommended_action,
  CAST(COUNT(*) AS BIGINT) AS customers,
  CAST(ROUND(SUM(predicted_retained_usd), 2) AS DOUBLE) AS predicted_retained_usd
FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_nba_recommendations')
GROUP BY recommended_action
ORDER BY predicted_retained_usd DESC
