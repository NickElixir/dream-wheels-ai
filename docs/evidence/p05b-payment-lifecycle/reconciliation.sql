-- Read-only exceptions: one paid order -> one purchase ledger entry and package.
BEGIN READ ONLY;
WITH grants AS (
  SELECT related_payment_id::text AS payment_id, count(*) AS n, sum(credits_delta) AS credits
  FROM credit_ledger WHERE event_type = 'purchase_grant' GROUP BY related_payment_id
), packages AS (
  SELECT related_payment_id::text AS payment_id, count(*) AS n, sum(credits_granted) AS credits
  FROM credit_packages WHERE source = 'purchase' GROUP BY related_payment_id
)
SELECT p.id, p.status, coalesce(g.n,0) AS grant_count, coalesce(c.n,0) AS package_count
FROM payments p LEFT JOIN grants g ON g.payment_id=p.id::text LEFT JOIN packages c ON c.payment_id=p.id::text
WHERE (p.status='paid' AND (coalesce(g.n,0)<>1 OR coalesce(c.n,0)<>1 OR g.credits<>p.credits_granted OR c.credits<>p.credits_granted))
   OR (p.status IN ('pending','cancelled','failed') AND (coalesce(g.n,0)<>0 OR coalesce(c.n,0)<>0));
ROLLBACK;
