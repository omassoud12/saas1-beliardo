import { BusinessComparisonsAndInsights, BusinessPlanningSnapshot } from "../../components/business/BusinessAnalysisPanels";
import { FinancialTrendChart } from "../../components/business/charts/FinancialTrendChart";
import { comparisonDetails } from "../../utils/businessKpis";

function WeeklyProfitMargin({ query }) {
  if (!query.data) return null;
  const margin = query.data.financial.profitMargin;
  const comparison = comparisonDetails(query.data.comparisons?.previousPeriod?.profitMargin, query.data.period);
  return <section className="weekly-margin" aria-labelledby="weekly-margin-title">
    <div><p className="eyebrow">Weekly profitability</p><h3 id="weekly-margin-title">Profit Margin</h3></div>
    <div><strong>{margin === null || margin === undefined ? "—" : `${Number(margin).toFixed(2)}%`}</strong>{comparison && <small className={`business-efficiency__comparison business-efficiency__comparison--${comparison.tone}`}>{comparison.label}</small>}</div>
  </section>;
}

export function WeeklySummary({ analysisQuery }) {
  return <div className="business-view">
    <WeeklyProfitMargin query={analysisQuery} />
    <FinancialTrendChart query={analysisQuery} />
    <BusinessPlanningSnapshot query={analysisQuery} />
    <BusinessComparisonsAndInsights query={analysisQuery} />
  </div>;
}
