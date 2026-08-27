-- Maturity urgency: revenue-at-risk + customer count by days-to-maturity buckets.
-- Shows the "act now" window for at-risk maturing products.
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
WITH at_risk_maturity AS (
  SELECT
    goa.customer_id,
    goa.days_to_maturity,
    SUM(goa.revenue_at_risk_usd) AS revenue_at_risk_usd
  FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_open_atrisk') goa
  GROUP BY goa.customer_id, goa.days_to_maturity
),
bucketed AS (
  SELECT
    customer_id,
    days_to_maturity,
    revenue_at_risk_usd,
    CASE
      WHEN days_to_maturity <= 7 THEN '0-7 days'
      WHEN days_to_maturity <= 14 THEN '8-14 days'
      WHEN days_to_maturity <= 30 THEN '15-30 days'
      ELSE '>30 days'
    END AS maturity_bucket
  FROM at_risk_maturity
)
SELECT
  maturity_bucket,
  CAST(COUNT(DISTINCT customer_id) AS BIGINT) AS customers,
  CAST(ROUND(SUM(revenue_at_risk_usd), 2) AS DOUBLE) AS revenue_at_risk_usd
FROM bucketed
GROUP BY maturity_bucket
ORDER BY CASE maturity_bucket
  WHEN '0-7 days' THEN 1
  WHEN '8-14 days' THEN 2
  WHEN '15-30 days' THEN 3
  ELSE 4
END
