-- Build-2 evidence: the hero decision chain, linked by customer_id (+ action id).
-- Replace :hero with the top customer_id from view_result.json (e.g. CUST-0004138).
-- 1) position (why they matter / risk)
SELECT customer_id, tier, risk_band, attrition_risk_score, total_balance_usd,
       balance_at_risk_usd, revenue_at_risk_usd, min_days_to_maturity, profile_summary
FROM app.customer_position WHERE customer_id = :hero;
-- 2) open at-risk (the maturing product + cross-sell candidate)
SELECT customer_id, atrisk_product_id, atrisk_balance_usd, days_to_maturity,
       current_rate_apy, candidate_cross_sell_product_id
FROM app.open_atrisk WHERE customer_id = :hero;
-- 3) NBA (the ranked recommendation the model made)
SELECT customer_id, recommended_action, recommended_offer_product_id, recommended_rate_apy,
       predicted_retained_usd, predicted_net_value_usd, action_ranking
FROM app.nba_recommendations WHERE customer_id = :hero;
-- 4) the committed action (written by the app's Act flow)
SELECT id, customer_id, action_type, offered_product_id, rate_apy, drafted_note,
       status, approved_by, audit_trail, created_at, decided_at
FROM app.rm_actions WHERE customer_id = :hero ORDER BY created_at DESC;
