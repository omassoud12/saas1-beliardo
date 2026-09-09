import { formatCurrency, formatHours } from "../../utils/analytics";

export function ActivityBreakdown({ activities, total }) {
  const totalRevenue = Number(total?.revenue || 0);
  return (
    <section className="analytics-panel activity-panel" aria-labelledby="activity-performance-title">
      <div className="analytics-panel__heading">
        <div>
          <p className="eyebrow">Performance mix · مزيج الأداء</p>
          <h3 id="activity-performance-title">Activity comparison · مقارنة الأنشطة</h3>
        </div>
        <p>Revenue, demand and efficiency by activity.<br /><span lang="ar" dir="rtl">المبيعات والطلب والكفاءة بحسب النشاط.</span></p>
      </div>
      <div className="analytics-table-wrap">
        <table className="activity-table">
          <thead><tr><th scope="col">Activity · النشاط</th><th scope="col">Sessions · الجلسات</th><th scope="col">Hours · الساعات</th><th scope="col">Revenue · المبيعات</th><th scope="col">Avg. session · متوسط الجلسة</th><th scope="col">Revenue/hour · المبيعات/ساعة</th><th scope="col">Share · الحصة</th></tr></thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.type}>
                <th scope="row"><span className={`activity-dot activity-dot--${activity.type}`} />{activity.label}</th>
                <td>{activity.sessions}</td><td>{formatHours(activity.hours)}</td><td>{formatCurrency(activity.revenue)}</td><td>{activity.sessions ? formatCurrency(activity.revenue / activity.sessions) : "—"}</td><td>{activity.hours ? formatCurrency(activity.revenue / activity.hours) : "—"}</td><td>{totalRevenue ? `${(activity.revenue / totalRevenue * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
          {total && <tfoot><tr><th scope="row">All Activities · كل الأنشطة</th><td>{total.sessions}</td><td>{formatHours(total.hours)}</td><td>{formatCurrency(total.revenue)}</td><td>{total.sessions ? formatCurrency(total.revenue / total.sessions) : "—"}</td><td>{total.hours ? formatCurrency(total.revenue / total.hours) : "—"}</td><td>{totalRevenue ? "100%" : "—"}</td></tr></tfoot>}
        </table>
      </div>
    </section>
  );
}
