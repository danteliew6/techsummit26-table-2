-- Build-1 evidence: Lakebase Search retrieval running (BM25/full-text over the product catalog).
SELECT product_id, product_name, segment, rate_apy, min_balance_usd,
       ts_rank(to_tsvector('english', description),
               plainto_tsquery('english','wealth advisory account for an affluent long-tenure customer')) AS score
FROM meridian.products
WHERE to_tsvector('english', description)
      @@ plainto_tsquery('english','wealth advisory account for an affluent long-tenure customer')
ORDER BY score DESC
LIMIT 5;
