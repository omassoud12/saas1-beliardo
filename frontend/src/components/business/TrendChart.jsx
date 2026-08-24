import { ACTIVITY_META, ACTIVITY_ORDER, formatCurrency } from "../../utils/analytics";

const colors = { playstation: "#b89cff", billiard: "#7ebc94", pingpong: "#e3ad68" };

function getValue(bucket, type, metric) {
  return Number(bucket.activities.find((activity) => activity.type === type)?.[metric] || 0);
}

export function TrendChart({ title, subtitle, data, metric = "revenue", valueFormatter = formatCurrency, labelFormatter }) {
  const values = data.flatMap((bucket) => ACTIVITY_ORDER.map((type) => getValue(bucket, type, metric)));
  const maximum = Math.max(...values, 0);
  const width = 960;
  const height = 280;
  const padding = { left: 52, right: 20, top: 18, bottom: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index) => padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value) => padding.top + plotHeight - ((maximum ? value / maximum : 0) * plotHeight);
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <section className="analytics-panel chart-panel" aria-labelledby={`${title.replaceAll(" ", "-")}-title`}>
      <div className="analytics-panel__heading">
        <div><p className="eyebrow">Visual trend</p><h3 id={`${title.replaceAll(" ", "-")}-title`}>{title}</h3></div>
        <p>{subtitle}</p>
      </div>
      <div className="chart-legend" aria-label="Activity legend">
        {ACTIVITY_ORDER.map((type) => <span key={type}><i style={{ background: colors[type] }} />{ACTIVITY_META[type].label}</span>)}
      </div>
      {maximum === 0 ? (
        <div className="chart-empty"><span aria-hidden="true">&#8644;</span><p>No completed activity in this period yet.</p></div>
      ) : (
        <div className="trend-chart-scroll">
          <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${subtitle}`}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={y(maximum * ratio)} y2={y(maximum * ratio)} className="chart-gridline" />
                <text x={padding.left - 10} y={y(maximum * ratio) + 4} textAnchor="end" className="chart-axis-label">
                  {metric === "revenue" ? `$${Math.round(maximum * ratio)}` : Math.round(maximum * ratio)}
                </text>
              </g>
            ))}
            {ACTIVITY_ORDER.map((type) => {
              const points = data.map((bucket, index) => `${x(index)},${y(getValue(bucket, type, metric))}`).join(" ");
              return <polyline key={type} points={points} fill="none" stroke={colors[type]} className="chart-line" />;
            })}
            {data.map((bucket, index) => (
              <g key={bucket.key}>
                {(index % labelEvery === 0 || index === data.length - 1) && (
                  <text x={x(index)} y={height - 14} textAnchor="middle" className="chart-axis-label">{labelFormatter(bucket.key)}</text>
                )}
                {ACTIVITY_ORDER.map((type) => {
                  const value = getValue(bucket, type, metric);
                  return (
                    <circle key={type} cx={x(index)} cy={y(value)} r="4" fill={colors[type]} className="chart-point">
                      <title>{`${labelFormatter(bucket.key)} · ${ACTIVITY_META[type].label}: ${valueFormatter(value)}`}</title>
                    </circle>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}
