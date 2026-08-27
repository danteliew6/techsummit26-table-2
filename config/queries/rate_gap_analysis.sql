-- Rate gap analysis: current APY vs recommended APY for at-risk maturing deposits.
-- Shows how much rate lift is needed for retention.
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
WITH rate_comparison AS (
  SELECT
    goa.customer_id,
    goa.current_rate_apy,
    gnr.recommended_rate_apy,
    goa.revenue_at_risk_usd,
    ROUND((gnr.recommended_rate_apy - goa.current_rate_apy) * 100, 0) AS rate_gap_bps
  FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_open_atrisk') goa
  JOIN IDENTIFIER(:catalog || '.' || :schema || '.gold_nba_recommendations') gnr
    ON goa.customer_id = gnr.customer_id
),
gap_bucketed AS (
  SELECT
    customer_id,
    current_rate_apy,
    recommended_rate_apy,
    revenue_at_risk_usd,
    rate_gap_bps,
    CASE
      WHEN rate_gap_bps <= 25 THEN '0-25 bps'
      WHEN rate_gap_bps <= 50 THEN '26-50 bps'
      WHEN rate_gap_bps <= 100 THEN '51-100 bps'
      ELSE '>100 bps'
    END AS rate_gap_bucket
  FROM rate_comparison
)
SELECT
  rate_gap_bucket,
  CAST(COUNT(DISTINCT customer_id) AS BIGINT) AS customers,
  CAST(ROUND(AVG(current_rate_apy), 3) AS DOUBLE) AS avg_current_rate_apy,
  CAST(ROUND(AVG(recommended_rate_apy), 3) AS DOUBLE) AS avg_recommended_rate_apy,
  CAST(ROUND(SUM(revenue_at_risk_usd), 2) AS DOUBLE) AS revenue_at_risk_usd
FROM gap_bucketed
GROUP BY rate_gap_bucket
ORDER BY CASE rate_gap_bucket
  WHEN '0-25 bps' THEN 1
  WHEN '26-50 bps' THEN 2
  WHEN '51-100 bps' THEN 3
  ELSE 4
END
