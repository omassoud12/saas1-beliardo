import { formatCurrency } from "../../utils/analytics";
import { buildSecondaryKpis, compactPeriodLabel, comparisonDetails, profitCostPresentation, targetProgressPresentation } from "../../utils/businessKpis";
import { AnalyticsError, AnalyticsLoading } from "./AnalyticsStates";
import { ActivityRevenueShare } from "./charts/ActivityRevenueShare";
import { ActivityOperations, StationPerformance } from "./ActivityOperations";
import { useStationPerformance } from "../../hooks/useBusinessSummary";
import { BUSINESS_COPY } from "../../content/businessCopy";
const expenseLabels = {
  RENT: ["Rent", "الإيجار"], ELECTRICITY: ["Electricity", "الكهرباء"],
  EMPLOYEES: ["Employees", "الموظفون"], OTHER: ["Other", "أخرى"],
};

function valueOrDash(value, formatter = (item) => item) {
  return value === null || value === undefined ? "—" : formatter(value);
}
function percentValue(value) {
  return value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}%`;
}
const activityArabic = { playstation: "البلايستيشن", billiard: "البليارد", pingpong: "البينغ بونغ" };

function arabicInsight(item) {
  const evidence = item.evidence ?? {};
  const percent = (value) => value === null || value === undefined ? "غير متاحة" : `${value}%`;
  const usd = (value) => `${Number(value || 0).toLocaleString("en-US")} دولار`;
  const translations = {
    revenue_and_sessions_down: ["انخفضت الإيرادات وعدد الجلسات", `تغيّرت الإيرادات بنسبة ${percent(evidence.revenue?.percentageDifference)}، وتغيّر عدد الجلسات المكتملة بنسبة ${percent(evidence.sessions?.percentageDifference)}. قد يكون انخفاض عدد الجلسات أحد العوامل المحتملة.`],
    session_value_down: ["انخفض متوسط قيمة الجلسة", `تغيّرت الإيرادات بنسبة ${percent(evidence.revenue?.percentageDifference)} مع استقرار عدد الجلسات، وتغيّر متوسط قيمة الجلسة بنسبة ${percent(evidence.averageSessionValue?.percentageDifference)}.`],
    costs_reduced_profit: ["ارتفاع المصاريف خفّض الربح", `تغيّر صافي الربح بنسبة ${percent(evidence.profit?.percentageDifference)}، بينما بقيت الإيرادات مستقرة وتغيّرت المصاريف بنسبة ${percent(evidence.costs?.percentageDifference)}.`],
    costs_outpaced_revenue: ["ارتفعت المصاريف أسرع من الإيرادات", `ارتفعت الإيرادات بنسبة ${percent(evidence.revenue?.percentageDifference)}، بينما تغيّر صافي الربح بنسبة ${percent(evidence.profit?.percentageDifference)}.`],
    activity_revenue_drop: ["انخفضت إيرادات النشاط", `انخفضت إيرادات ${activityArabic[evidence.activity] ?? evidence.activity ?? "هذا النشاط"} بنسبة ${percent(evidence.revenue?.percentageDifference)} مقارنةً بالفترة السابقة المماثلة.`],
    growth_with_stable_costs: ["نمت الإيرادات والأرباح مع استقرار المصاريف", `تغيّرت الإيرادات بنسبة ${percent(evidence.revenue?.percentageDifference)}، وصافي الربح بنسبة ${percent(evidence.profit?.percentageDifference)}، والمصاريف بنسبة ${percent(evidence.costs?.percentageDifference)}.`],
    profit_below_target: ["قلّص الفارق المتبقي عن هدف الربح", `وصل النشاط إلى ${percent(evidence.achievement)} من هدف صافي الربح للفترة المحددة، وما زال ${usd(evidence.remaining)} للوصول إليه.`],
    sessions_to_revenue_target: ["خطة العمل للوصول إلى هدف المبيعات", `تحتاج تقريباً إلى ${evidence.requiredSessions ?? 0} جلسة مكتملة إضافية بمتوسط ${usd(evidence.averageSessionValue)} للجلسة لتغطية ${usd(evidence.remainingRevenue)}.${evidence.daysRemaining > 0 ? ` المطلوب تقريباً ${usd(evidence.requiredDailyRevenue)} يومياً خلال ${evidence.daysRemaining} يوم عمل متبقٍ.` : ""}`],
    revenue_below_target: ["الإيرادات أدنى من الهدف المرحلي", `الإيرادات الحالية هي ${usd(evidence.currentRevenue)} من هدف الفترة حتى الآن والبالغ ${usd(evidence.targetRevenue)}، وما زال ${usd(evidence.remaining)} للحاق بالمسار المطلوب.`],
    margin_below_target: ["هامش الربح أدنى من المتوقع", `هامش الربح الحالي هو ${percent(evidence.currentMargin)}، أي أقل بـ${evidence.gap} نقطة مئوية من المتوقع.`],
    costs_above_target: ["المصاريف تجاوزت الحد المحدد", `المصاريف أعلى بـ${usd(evidence.overage)} من الحد المحدد للفترة والبالغ ${usd(evidence.maximumCosts)}.`],
    period_profitable: ["الفترة المحددة مربحة", `صافي الربح هو ${usd(evidence.netProfit)}، مع هامش ربح قدره ${percent(evidence.profitMargin)}.`],
    no_material_problem: ["لم يتم رصد مشكلة جوهرية", `الإيرادات هي ${usd(evidence.revenue?.current)}، وصافي الربح ${usd(evidence.profit?.current)}، وعدد الجلسات المكتملة ${evidence.sessions?.current ?? 0}.`],
    monitor_next_period: ["راقب الفترة المماثلة القادمة", `قارن الفترة القادمة مع الإيرادات الحالية البالغة ${usd(evidence.revenue?.current)} وعدد الجلسات المكتملة البالغ ${evidence.sessions?.current ?? 0}.`],
  };
  const [title, message] = translations[item.code] ?? ["تحليل الأعمال", "هذه الملاحظة مبنية على أرقام الفترة المحددة ومقارنتها بالفترة السابقة."];
  return { title, message };
}

function TargetActionPlan({ data }) {
  const plan = data.decisionSupport;
  if (!plan?.hasTarget) return <section className="target-action target-action--empty" aria-labelledby="target-action-title"><div><p className="eyebrow">Next decision · القرار التالي</p><h3 id="target-action-title">Set a monthly sales target · حدّد هدف المبيعات الشهري</h3></div><p>Add one target made of expected costs plus desired profit to unlock daily revenue and session guidance.<br /><span lang="ar" dir="rtl">أضف هدفاً واحداً يجمع المصاريف المتوقعة والربح المطلوب لتظهر خطة المبيعات والجلسات اليومية.</span></p></section>;
  const completed = plan.revenueRemaining <= 0;
  return <section className={`target-action ${completed ? "target-action--complete" : ""}`} aria-labelledby="target-action-title">
    <div className="target-action__heading"><div><p className="eyebrow">Sales plan · خطة المبيعات</p><h3 id="target-action-title">{completed ? "Target achieved · تم تحقيق الهدف" : plan.periodClosed ? "Period closed · راجع النتيجة" : "Pace needed to reach target · الوتيرة المطلوبة لتحقيق الهدف"}</h3></div></div>
    <div className="target-action__metrics">
      <div><span>Revenue needed / day<br /><b lang="ar" dir="rtl">المبيعات المطلوبة يومياً</b></span><strong>{plan.periodClosed ? "—" : valueOrDash(plan.requiredDailyRevenue, formatCurrency)}</strong></div>
      <div><span>Sessions still needed<br /><b lang="ar" dir="rtl">الجلسات المتبقية تقريباً</b></span><strong>{plan.periodClosed ? "—" : valueOrDash(plan.requiredSessions)}</strong></div>
      <div><span>Business days remaining<br /><b lang="ar" dir="rtl">أيام العمل المتبقية</b></span><strong>{plan.daysRemaining}</strong></div>
    </div>
    {plan.averageSessionValue && !completed && !plan.periodClosed && <p className="target-action__note">Estimate uses the current {formatCurrency(plan.averageSessionValue)} average per completed session. · <span lang="ar" dir="rtl">التقدير مبني على متوسط {formatCurrency(plan.averageSessionValue)} لكل جلسة مكتملة.</span></p>}
    {plan.expectedNetProfit <= 0 && <p className="target-action__warning">The sales target no longer covers current expected costs. Update the target or review expenses. · <span lang="ar" dir="rtl">هدف المبيعات لم يعد يغطي المصاريف المتوقعة الحالية. عدّل الهدف أو راجع المصاريف.</span></p>}
    {plan.costBasisChanged && <p className="target-action__warning">Costs changed after this target was saved. Expected profit was recalculated using current expenses. · <span lang="ar" dir="rtl">تغيّرت المصاريف بعد حفظ الهدف، لذلك أُعيد احتساب الربح المتوقع حسب المصاريف الحالية.</span></p>}
  </section>;
}

function ExpenseOverview({ data }) {
  const active = data.expenses.breakdown.filter((item) => item.amount > 0);
  const largest = active.reduce((best, item) => !best || item.amount > best.amount ? item : best, null);
  const costShare = data.financial.totalRevenue > 0 ? data.financial.totalCosts / data.financial.totalRevenue * 100 : null;
  return <section className="expense-overview" aria-labelledby="expense-overview-title"><div><p className="eyebrow">Cost context · مراقبة المصاريف</p><h3 id="expense-overview-title">Expense composition · توزيع المصاريف</h3></div><div className="expense-overview__grid"><div><span>Share of revenue · نسبتها من المبيعات</span><strong>{percentValue(costShare)}</strong></div><div><span>Largest category · أكبر فئة</span><strong>{largest ? `${expenseLabels[largest.category]?.[0] ?? largest.category} · ${formatCurrency(largest.amount)}` : "—"}</strong></div></div></section>;
}

export function BusinessPlanningSnapshot({ query }) {
  if (query.loading) return <AnalyticsLoading />;
  if (query.error) return <AnalyticsError onRetry={query.retry} />;
  return <div className="business-support-grid" aria-label="Planning and cost overview"><TargetActionPlan data={query.data} /><ExpenseOverview data={query.data} /></div>;
}

export function BusinessEfficiencyStrip({ query }) {
  if (!query.data || query.loading || query.error) return null;
  const items = buildSecondaryKpis(query.data);
  return <section className="business-efficiency" aria-labelledby="business-efficiency-title">
    <div className="business-efficiency__heading"><p className="eyebrow">Efficiency · الكفاءة</p><h3 id="business-efficiency-title">Session efficiency</h3></div>
    <dl className="business-efficiency__grid">{items.map((item) => <div key={item.key}>
      <dt>{item.label}</dt>
      <dd>{item.value}</dd>
      {item.comparison ? <small className={`business-efficiency__comparison business-efficiency__comparison--${item.comparison.tone}`}>{item.comparison.label}</small> : item.description ? <small>{item.description}</small> : null}
    </div>)}</dl>
  </section>;
}

export function BusinessComparisonsAndInsights({ query }) {
  if (query.loading || query.error || !query.data) return null;
  const repeatedKpis = new Set(["period_profitable", "no_material_problem", "monitor_next_period"]);
  const insights = query.data.insights.filter((item) => !repeatedKpis.has(item.code));
  if (!insights.length) return null;
  const groups = [["positive", "Positive Indicators", "مؤشرات إيجابية", "✓"], ["warning", "Problems Detected", "مشاكل مكتشفة", "!"], ["recommendation", "Recommendations", "توصيات", "→"]];
  const visibleGroups = groups.map(([type, label, arabicLabel, icon]) => ({
    type, label, arabicLabel, icon, items: insights.filter((item) => item.type === type),
  })).filter((group) => group.items.length);
  return <>
    <section className="analytics-panel business-insights" aria-labelledby="analysis-insights-title"><div className="analytics-panel__heading"><div><p className="eyebrow">Deterministic analysis · تحليل رقمي ثابت</p><h3 id="analysis-insights-title">Evidence-based insights | تحليلات مبنية على الأرقام</h3></div><p>Rules use the selected and previous equivalent periods.<br /><span lang="ar" dir="rtl">تعتمد القواعد على الفترة المحددة والفترة السابقة المماثلة.</span></p></div><div className="insight-grid">{visibleGroups.map(({ type, label, arabicLabel, icon, items }) => <section className={`insight-column insight-column--${type}`} key={type} aria-labelledby={`insight-${type}`}><div className="insight-column__heading"><span className="insight-column__icon" aria-hidden="true">{icon}</span><h4 id={`insight-${type}`}>{label}<span className="insight-heading-ar" lang="ar" dir="rtl">{arabicLabel}</span></h4><span className="insight-column__count">{items.length}</span></div><div className="insight-column__cards">{items.map((item) => { const translation = arabicInsight(item); return <article key={`${item.code}-${item.title}`}><strong>{item.title}</strong><strong className="insight-title-ar" lang="ar" dir="rtl">{translation.title}</strong><p>{item.message}</p><p className="insight-copy-ar" lang="ar" dir="rtl">{translation.message}</p></article>; })}</div></section>)}</div></section>
  </>;
}

export function ActivityPerformance({ query, period, parameters, businessId }) {
  const stationQuery = useStationPerformance(period, parameters, businessId);
  if (query.loading) return <div className="business-view"><AnalyticsLoading /></div>;
  if (query.error) return <div className="business-view"><AnalyticsError onRetry={query.retry} /></div>;
  return <div className="business-view"><ActivityRevenueShare activities={query.data.activities} currency={query.data.period.currency} /><ActivityOperations activities={query.data.activities} /><StationPerformance query={stationQuery} /></div>;
}

export function BusinessOverview({ query }) {
  if (query.loading) return <section className="business-overview business-overview--loading" aria-label="Loading business snapshot" aria-busy="true"><div className="skeleton-line skeleton-line--title" /><div className="business-snapshot__loading-grid">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item} />)}</div></section>;
  if (query.error) return <section className="business-overview"><AnalyticsError onRetry={query.retry} /></section>;
  if (!query.data) return null;
  const { financial, period, statuses, decisionSupport } = query.data;
  const revenueComparison = comparisonDetails(query.data.comparisons?.previousPeriod?.totalRevenue, period);
  const { revenue, costs, netProfit, profitBarWidth, costBarWidth, isLoss } = profitCostPresentation(financial);
  const target = targetProgressPresentation(decisionSupport, revenue);
  const resultTone = statuses.profitability === "profitable" ? "green" : statuses.profitability === "loss" ? "red" : "yellow";
  return <section className={`business-overview business-overview--${resultTone}`} aria-labelledby="business-overview-title">
    <div className="business-overview__topline">
      <div><p className="eyebrow">Business snapshot · نظرة سريعة</p><h2 id="business-overview-title">Business Snapshot</h2></div>
      <p className="business-overview__period">{compactPeriodLabel(period)}</p>
    </div>
    {period.isPartial && <p className="business-overview__accounting-note">Revenue through current time · Scheduled period expenses included</p>}
    <div className="business-snapshot__grid">
      <article className={`business-snapshot__unified ${isLoss ? "business-snapshot__unified--loss" : ""}`}>
        <section className="business-snapshot__revenue" aria-label="Revenue">
          <span>{BUSINESS_COPY.metrics.revenue}</span>
          <strong>{formatCurrency(revenue)}</strong>
          {revenueComparison && <small className={`business-snapshot__comparison business-snapshot__comparison--${revenueComparison.tone}`}>{revenueComparison.label}</small>}
        </section>

        <section className={`business-snapshot__target ${target.state === "reached" || target.state === "exceeded" ? "business-snapshot__target--met" : ""}`} aria-label="Revenue target">
          <div className="business-snapshot__card-heading"><span>Target progress</span>{target.hasTarget && <strong>{percentValue(target.progress)}</strong>}</div>
          {target.hasTarget ? <>
            <p><strong>{formatCurrency(revenue)}</strong><span> / {formatCurrency(target.target)}</span></p>
            <div className="business-snapshot__progress" role="progressbar" aria-label="Revenue target progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(target.barWidth)} aria-valuetext={`${target.progress}%`}><i style={{ width: `${target.barWidth}%` }} /></div>
            <small>{target.state === "exceeded" ? "Target exceeded" : target.state === "reached" ? "Target reached" : `${formatCurrency(target.remaining)} remaining`}</small>
          </> : <div className="business-snapshot__empty"><strong>{BUSINESS_COPY.states.noTarget}</strong><small>Add one from Targets when you are ready.</small></div>}
        </section>

        <section className="business-snapshot__profit-costs" aria-label="Net profit and period expenses">
          <div className="business-snapshot__card-heading"><span>Profit vs Costs</span>{isLoss && <strong>Loss</strong>}</div>
          <div className="business-snapshot__bar-row business-snapshot__bar-row--profit"><p><span>{BUSINESS_COPY.metrics.netProfit}</span><strong className={isLoss ? "business-snapshot__loss-value" : ""}>{formatCurrency(netProfit)}</strong></p><div><i style={{ width: `${profitBarWidth}%` }} /></div></div>
          <div className="business-snapshot__bar-row business-snapshot__bar-row--costs"><p><span>{BUSINESS_COPY.metrics.periodExpenses}</span><strong>{formatCurrency(costs)}</strong></p><div><i style={{ width: `${costBarWidth}%` }} /></div></div>
          {revenue === 0 && costs === 0 && <small className="business-snapshot__zero">No revenue or expenses in this period.</small>}
          {revenue === 0 && costs > 0 && <small className="business-snapshot__zero">Expenses were recorded with no revenue.</small>}
        </section>
      </article>
    </div>
  </section>;
}
