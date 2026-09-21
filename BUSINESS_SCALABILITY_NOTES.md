# Business scalability notes

## Request caching

The frontend now keeps resolved Business overview, analysis, and station-performance requests for 15 seconds. Keys include business ID, period type, and all period parameters; concurrent identical requests share one promise. Expense and target mutations invalidate every cached Business request for that tenant. This cache is process-local to the browser tab and intentionally does not replace database freshness or introduce shared infrastructure.

## Historical backend caching

Historical response caching is intentionally deferred. The current deployment does not expose a measured latency or database-load threshold that justifies a second consistency layer. Completed periods can still change when an expense is versioned or a target is updated, so a safe cache would need tenant/period keys plus invalidation for sessions, expenses, targets, station snapshots, and report-relevant metadata. The request-scoped overview loader removes duplicate work without stale data or cross-tenant cache risk.

If measurements later justify caching, cache only completed periods with a key containing the business ID, timezone, period type, and period key. Invalidate it after session completion/cancellation and expense or target mutations. Keep active periods uncached or use a very short TTL.

## Money precision

Postgres remains authoritative and stores money/rates as `numeric`. Conversion to JavaScript `Number` currently occurs in:

- `backend/src/features/business/business.repository.js` for aggregate/session revenue;
- `backend/src/features/business/business-analysis.repository.js` for expenses, exchange rates, and targets;
- `backend/src/features/business/business-analysis.calculations.js` and `business-analysis.service.js` for ratios, proration, and totals;
- `backend/src/features/business/business.service.js` and `business-report.template.js` for summaries and presentation.

Business money inputs are capped at `90,000,000,000,000`, keeping a two-decimal value within JavaScript's safe integer range when represented as cents. The present schema rounds financial outputs to cents, so changing every runtime value to a decimal object would create more compatibility risk than benefit at lounge scale. Ratios, recurring-expense proration, and sums still use `Number`, so before supporting balances near that ceiling, sub-cent accounting, or high-volume multi-currency settlement, move authoritative arithmetic into Postgres numeric functions or adopt one audited decimal library throughout the backend. Do not mix decimal objects and `Number` piecemeal.

## Index review

No index was added in Phase 5 without a production `EXPLAIN (ANALYZE, BUFFERS)` trace. Existing indexes already cover the observed tenant access paths:

- completed session aggregation: `sessions_business_ended_idx`;
- open-session lookup: `sessions_business_open_started_idx`;
- targets: `business_targets_tenant_effective_idx` and the month uniqueness index;
- report quota/listing: `business_report_exports_quota_idx` and `business_report_exports_recent_idx`;
- expense date/version lookup: tenant date and validity indexes.

The expense management list's `business_id + created_at desc` ordering is the first candidate to measure. Add it only if production plans show a material sort/scan cost.

## PDF execution

The process-local PDF gate remains appropriate for the current single-instance deployment. It preserves the existing quota reservation, failure cleanup, and tenant-scoped storage flow. If the service moves to multiple API instances, the migration path is a shared job lease/queue keyed by business and export ID; that should be introduced together with operational monitoring, idempotent workers, and stale-lease recovery—not before.
