import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "../../../utils/analytics";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

const arabicLabels = {
  playstation: "بلايستيشن",
  billiard: "بليارد",
  pingpong: "بينغ بونغ",
};

function ShareTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return <div className="analytics-tooltip activity-share-tooltip" role="status">
    <strong>{item.label} · {item.arabicLabel}</strong>
    <span>Revenue share<b>{item.share.toFixed(1)}%</b></span>
    <span>Sales<b>{formatCurrency(item.revenue, currency)}</b></span>
    <span>Sessions<b>{item.sessions}</b></span>
  </div>;
}

export function ActivityRevenueShare({ activities, currency = "USD" }) {
  const byType = new Map(activities.map((item) => [item.type, item]));
  const data = CHART_SERIES.map((series) => {
    const activity = byType.get(series.key) ?? {};
    return {
      type: series.key,
      label: series.label,
      arabicLabel: arabicLabels[series.key],
      revenue: Number(activity.revenue || 0),
      sessions: Number(activity.sessions || 0),
    };
  });
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const chartData = data.map((item) => ({ ...item, share: totalRevenue ? item.revenue / totalRevenue * 100 : 0 }));

  return <section className="analytics-panel activity-share-panel" aria-labelledby="activity-share-title">
    <div className="analytics-panel__heading">
      <div><p className="eyebrow">Revenue mix · توزيع المبيعات</p><h3 id="activity-share-title">Sales by activity · المبيعات حسب النشاط</h3></div>
      <p>Each color shows the activity's share of total sales.<br /><span lang="ar" dir="rtl">كل لون يوضح حصة النشاط من إجمالي المبيعات.</span></p>
    </div>
    {totalRevenue <= 0 ? <div className="chart-empty"><span aria-hidden="true">○</span><p>No paid activity was recorded for this period.<br /><span lang="ar" dir="rtl">لا توجد مبيعات مسجلة خلال هذه الفترة.</span></p></div> : <div className="activity-share-layout">
      <div className="activity-share-donut" role="img" aria-label={`Activity revenue shares: ${chartData.map((item) => `${item.label} ${item.share.toFixed(1)} percent`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="revenue" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={3} cornerRadius={5} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
              {chartData.map((item) => <Cell key={item.type} fill={CHART_COLORS[item.type]} />)}
            </Pie>
            <Tooltip content={<ShareTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="activity-share-donut__total"><span>Total sales<br /><b lang="ar" dir="rtl">إجمالي المبيعات</b></span><strong>{formatCurrency(totalRevenue, currency)}</strong></div>
      </div>
      <div className="activity-share-list">
        {chartData.map((item) => <article key={item.type} style={{ "--activity-share-color": CHART_COLORS[item.type] }}>
          <div><span className="activity-share-list__dot" aria-hidden="true" /><strong>{item.label}<b lang="ar" dir="rtl">{item.arabicLabel}</b></strong><em>{item.share.toFixed(1)}%</em></div>
          <p><span>{formatCurrency(item.revenue, currency)} sales</span><span>{item.sessions} sessions</span></p>
        </article>)}
      </div>
    </div>}
  </section>;
}
