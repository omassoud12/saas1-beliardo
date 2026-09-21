import { businessRepository } from "./business.repository.js";
import { businessAnalysisRepository } from "./business-analysis.repository.js";
import { createBusinessService } from "./business.service.js";
import { createBusinessAnalysisService } from "./business-analysis.service.js";
import { resolveAnalysisPeriods } from "./business-analysis.periods.js";
import { getBusinessDateKey } from "../../shared/utils/timeRange.js";

function stableRangeKey(range) {
  return `${range.from}|${range.to}|${range.startDate ?? ""}|${range.endDateExclusive ?? ""}`;
}

export function createRequestScopedBusinessRepository(repository = businessRepository) {
  const promises = new Map();
  const once = (key, load) => {
    if (!promises.has(key)) promises.set(key, Promise.resolve().then(load));
    return promises.get(key);
  };
  return {
    ...repository,
    findBusiness(businessId) {
      return once(`business|${businessId}`, () => repository.findBusiness(businessId));
    },
    aggregate(businessId, range, bucket, timezone) {
      const key = `aggregate|${businessId}|${timezone}|${bucket}|${stableRangeKey(range)}`;
      return once(key, () => repository.aggregate(businessId, range, bucket, timezone));
    },
  };
}

export function createBusinessOverviewService({
  repository = businessRepository,
  analysisRepository = businessAnalysisRepository,
  clock = () => new Date(),
} = {}) {
  return {
    async load({ businessId, timezone, period, date, year, month, page = 1, pageSize = 50, includeBusiness = false }) {
      const now = clock();
      const scoped = createRequestScopedBusinessRepository(repository);
      const requestClock = () => now;
      const summaries = createBusinessService({ repository: scoped, clock: requestClock });
      const analysis = createBusinessAnalysisService({ summaries: scoped, repository: analysisRepository, clock: requestClock });
      const parameters = { businessId, timezone, date, year, month };
      const method = period === "daily" ? "daily" : period === "monthly" ? "monthly" : period === "yearly" ? "yearly" : null;
      const periods = resolveAnalysisPeriods({
        period, date, year, month, timezone, now,
        businessDate: getBusinessDateKey(now, timezone),
      });
      const [summary, analysisResult, business] = await Promise.all([
        method ? summaries[method]({ ...parameters, page, pageSize, aggregateRange: periods.current }) : null,
        analysis.analyze({ ...parameters, period }),
        includeBusiness ? scoped.findBusiness(businessId) : null,
      ]);
      return { summary, analysis: analysisResult, ...(includeBusiness ? { business } : {}) };
    },
  };
}

export const businessOverviewService = createBusinessOverviewService();
