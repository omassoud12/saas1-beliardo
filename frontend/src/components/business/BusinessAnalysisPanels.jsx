import { formatCurrency, formatDate } from "../../utils/analytics";
import { AnalyticsError, AnalyticsLoading } from "./AnalyticsStates";
import { ActivityRevenueShare } from "./charts/ActivityRevenueShare";
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
function changeLabel(comparison, currency = false) {
  if (!comparison) return "Not available · غير متاح";
  const difference = currency ? formatCurrency(comparison.absoluteDifference) : comparison.absoluteDifference;
  if (comparison.percentageDifference === null) return `${difference} · No percentage baseline / لا توجد نسبة مقارنة`;
  const sign = comparison.percentageDifference > 0 ? "+" : "";
  return `${sign}${comparison.percentageDifference}% · ${difference}`;
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
  const progress = Math.max(0, plan.revenueProgress ?? 0);
  const cappedProgress = Math.min(100, progress);
  const completed = plan.revenueRemaining <= 0;
  return <section className={`target-action ${completed ? "target-action--complete" : ""}`} aria-labelledby="target-action-title">
    <div className="target-action__heading"><div><p className="eyebrow">Sales plan · خطة المبيعات</p><h3 id="target-action-title">{completed ? "Target reached · تم تحقيق الهدف" : plan.periodClosed ? `${formatCurrency(plan.revenueRemaining)} short when the period closed · قيمة النقص عند انتهاء الفترة` : `${formatCurrency(plan.revenueRemaining)} remaining · متبقّي للوصول إلى الهدف`}</h3></div><strong>{percentValue(progress)}</strong></div>
    <div className="target-progress" role="progressbar" aria-label="Revenue target progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(cappedProgress)}><span style={{ width: `${cappedProgress}%` }} /></div>
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
  const comparison = data.comparisons.previousPeriod.totalCosts;
  return <section className="expense-overview" aria-labelledby="expense-overview-title"><div><p className="eyebrow">Cost control · مراقبة المصاريف</p><h3 id="expense-overview-title">Expense snapshot · ملخص المصاريف</h3></div><div className="expense-overview__grid"><div><span>Share of revenue · نسبتها من المبيعات</span><strong>{percentValue(costShare)}</strong></div><div><span>Largest category · أكبر فئة</span><strong>{largest ? `${expenseLabels[largest.category]?.[0] ?? largest.category} · ${formatCurrency(largest.amount)}` : "—"}</strong></div><div><span>Change vs previous period · مقارنة بالفترة السابقة</span><strong>{changeLabel(comparison, true)}</strong></div></div></section>;
}

export function BusinessPlanningSnapshot({ query }) {
  if (query.loading) return <AnalyticsLoading />;
  if (query.error) return <AnalyticsError onRetry={query.retry} />;
  return <div className="business-support-grid" aria-label="Planning and cost overview"><TargetActionPlan data={query.data} /><ExpenseOverview data={query.data} /></div>;
}

export function MonthlyRevenueGrowth({ query }) {
  if (query.loading || query.error || !query.data) return null;
  const comparison = query.data.comparisons.previousPeriod.totalRevenue;
  const percentage = comparison.percentageDifference;
  const direction = percentage === null ? "new" : comparison.direction;
  const value = percentage === null ? "New" : `${percentage > 0 ? "+" : ""}${percentage}%`;
  const partial = query.data.period.isPartial;
  return <section className={`monthly-growth-card monthly-growth-card--${direction}`} aria-labelledby="monthly-growth-title"><span className="monthly-growth-card__icon" aria-hidden="true">{direction === "up" ? "↗" : direction === "down" ? "↘" : direction === "new" ? "+" : "→"}</span><div className="monthly-growth-card__copy"><p className="eyebrow">Monthly revenue growth · نمو المبيعات الشهري</p><h3 id="monthly-growth-title">Compared with the previous month · مقارنة بالشهر السابق</h3><p>{formatCurrency(comparison.current)} versus {formatCurrency(comparison.previous)}.{partial ? " The same elapsed days are compared." : ""}</p><p lang="ar" dir="rtl">{formatCurrency(comparison.current)} مقابل {formatCurrency(comparison.previous)}.{partial ? " تتم مقارنة نفس عدد الأيام المنقضية." : ""}</p></div><div className="monthly-growth-card__value"><strong>{value}</strong><span lang="ar" dir="rtl">{percentage === null ? "لا توجد نسبة سابقة" : "مقارنة بالشهر السابق"}</span></div></section>;
}

export function BusinessComparisonsAndInsights({ query }) {
  if (query.loading || query.error || !query.data) return null;
  const { insights } = query.data;
  const groups = [["positive", "Positive Indicators", "مؤشرات إيجابية", "✓"], ["warning", "Problems Detected", "مشاكل مكتشفة", "!"], ["recommendation", "Recommendations", "توصيات", "→"]];
  return <>
    <section className="analytics-panel business-insights" aria-labelledby="analysis-insights-title"><div className="analytics-panel__heading"><div><p className="eyebrow">Deterministic analysis · تحليل رقمي ثابت</p><h3 id="analysis-insights-title">Evidence-based insights | تحليلات مبنية على الأرقام</h3></div><p>Rules use the selected and previous equivalent periods.<br /><span lang="ar" dir="rtl">تعتمد القواعد على الفترة المحددة والفترة السابقة المماثلة.</span></p></div><div className="insight-grid">{groups.map(([type, label, arabicLabel, icon]) => { const groupInsights = insights.filter((item) => item.type === type); return <section className={`insight-column insight-column--${type}`} key={type} aria-labelledby={`insight-${type}`}><div className="insight-column__heading"><span className="insight-column__icon" aria-hidden="true">{icon}</span><h4 id={`insight-${type}`}>{label}<span className="insight-heading-ar" lang="ar" dir="rtl">{arabicLabel}</span></h4><span className="insight-column__count">{groupInsights.length}</span></div><div className="insight-column__cards">{groupInsights.map((item) => { const translation = arabicInsight(item); return <article key={`${item.code}-${item.title}`}><strong>{item.title}</strong><strong className="insight-title-ar" lang="ar" dir="rtl">{translation.title}</strong><p>{item.message}</p><p className="insight-copy-ar" lang="ar" dir="rtl">{translation.message}</p></article>; })}</div></section>; })}</div></section>
  </>;
}

export function ActivityPerformance({ query }) {
  if (query.loading) return <div className="business-view"><AnalyticsLoading /></div>;
  if (query.error) return <div className="business-view"><AnalyticsError onRetry={query.retry} /></div>;
  return <div className="business-view"><ActivityRevenueShare activities={query.data.activities} currency={query.data.period.currency} /></div>;
}

export function BusinessOverview({ query }) {
  if (query.loading || query.error || !query.data) return null;
  const { financial, period, statuses, decisionSupport } = query.data;
  const ending = formatDate(period.endDateExclusive);
  const state = statuses.profitability === "profitable"
    ? ["Profit", "ربح"]
    : statuses.profitability === "loss"
      ? ["Loss", "خسارة"]
      : ["Break-even", "تعادل"];
  const scale = Math.max(financial.totalRevenue, financial.totalCosts, 1);
  const salesWidth = Math.max(0, financial.totalRevenue / scale * 100);
  const costsWidth = Math.max(0, financial.totalCosts / scale * 100);
  const resultSign = financial.netProfit > 0 ? "+" : "";
  const targetProgress = decisionSupport?.hasTarget ? Math.max(0, decisionSupport.revenueProgress ?? 0) : null;
  const resultTone = statuses.profitability === "profitable" ? "green" : statuses.profitability === "loss" ? "red" : "yellow";
  return <section className={`business-overview business-overview--${resultTone}`} aria-labelledby="business-overview-title">
    <div className="business-overview__topline">
      <p className="eyebrow">Business snapshot · نظرة سريعة</p>
      <p className="business-overview__period"><span aria-hidden="true">◷</span> {formatDate(period.startDate)} → {ending}</p>
    </div>
    <div className="business-overview__visual">
      <div className="business-overview__result">
        <span className="business-overview__status"><i aria-hidden="true" />{state[0]} <b lang="ar" dir="rtl">· {state[1]}</b></span>
        <strong id="business-overview-title">{resultSign}{formatCurrency(financial.netProfit)}</strong>
        <small>Net result · صافي النتيجة</small>
      </div>
      <div className="business-overview__chart" role="img" aria-label={`Sales ${formatCurrency(financial.totalRevenue)}; costs ${formatCurrency(financial.totalCosts)}`}>
        <div className="business-overview__bar-row business-overview__bar-row--sales">
          <span>Sales · المبيعات</span><strong>{formatCurrency(financial.totalRevenue)}</strong>
          <div aria-hidden="true"><i style={{ width: `${salesWidth}%` }} /></div>
        </div>
        <div className="business-overview__bar-row business-overview__bar-row--costs">
          <span>Costs · المصاريف</span><strong>{formatCurrency(financial.totalCosts)}</strong>
          <div aria-hidden="true"><i style={{ width: `${costsWidth}%` }} /></div>
        </div>
      </div>
    </div>
    {targetProgress !== null && <div className={`business-overview__target ${targetProgress >= 100 ? "business-overview__target--met" : ""}`}>
      <span>Sales goal · هدف المبيعات</span><div aria-hidden="true"><i style={{ width: `${Math.min(100, targetProgress)}%` }} /></div><strong>{percentValue(targetProgress)}</strong>
    </div>}
  </section>;
}
