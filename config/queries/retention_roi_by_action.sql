-- Retention ROI by action: predicted net value + predicted retained + customer count per recommended action.
-- Shows the value and ROI of each retention play to the executive.
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
SELECT
  recommended_action,
  CAST(COUNT(DISTINCT customer_id) AS BIGINT) AS customers,
  CAST(ROUND(SUM(predicted_retained_usd), 2) AS DOUBLE) AS predicted_retained_usd,
  CAST(ROUND(SUM(predicted_net_value_usd), 2) AS DOUBLE) AS predicted_net_value_usd
FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_nba_recommendations')
GROUP BY recommended_action
ORDER BY predicted_net_value_usd DESC
