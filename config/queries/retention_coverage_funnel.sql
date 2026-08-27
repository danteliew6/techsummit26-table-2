-- Retention coverage funnel: total at-risk revenue → with recommendation → actioned.
-- Shows how much of the at-risk book the retention program has touched.
-- @param catalog STRING = table_2
-- @param schema STRING = exercise
WITH at_risk_base AS (
  SELECT
    customer_id,
    revenue_at_risk_usd
  FROM IDENTIFIER(:catalog || '.' || :schema || '.gold_customer_position')
  WHERE risk_band IN ('critical', 'elevated', 'watch')
),
with_recommendation AS (
  SELECT DISTINCT
    ar.customer_id,
    ar.revenue_at_risk_usd
  FROM at_risk_base ar
  JOIN IDENTIFIER(:catalog || '.' || :schema || '.gold_nba_recommendations') gnr
    ON ar.customer_id = gnr.customer_id
),
with_action AS (
  SELECT DISTINCT
    ar.customer_id,
    ar.revenue_at_risk_usd
  FROM at_risk_base ar
  WHERE ar.customer_id IN (
    SELECT DISTINCT customer_id
    FROM IDENTIFIER(:catalog || '.' || :schema || '.lakebase_rm_actions')
  )
),
funnel_data AS (
  SELECT
    'Total at-risk revenue' AS stage,
    CAST(COUNT(DISTINCT customer_id) AS BIGINT) AS customers,
    CAST(ROUND(SUM(revenue_at_risk_usd), 2) AS DOUBLE) AS revenue_at_risk_usd
  FROM at_risk_base
  UNION ALL
  SELECT
    'With recommendation' AS stage,
    CAST(COUNT(DISTINCT customer_id) AS BIGINT) AS customers,
    CAST(ROUND(SUM(revenue_at_risk_usd), 2) AS DOUBLE) AS revenue_at_risk_usd
  FROM with_recommendation
  UNION ALL
  SELECT
    'Actioned' AS stage,
    CAST(COUNT(DISTINCT customer_id) AS BIGINT) AS customers,
    CAST(ROUND(SUM(revenue_at_risk_usd), 2) AS DOUBLE) AS revenue_at_risk_usd
  FROM with_action
)
SELECT
  stage,
  customers,
  revenue_at_risk_usd
FROM funnel_data
ORDER BY CASE stage
  WHEN 'Total at-risk revenue' THEN 1
  WHEN 'With recommendation' THEN 2
  ELSE 3
END
