import { useEffect, useState } from "react";
import {
  Area, ComposedChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useUI } from "../data/ui";
import { compact, money, monthLabel } from "../lib/format";
import { getCategory } from "../lib/categories";
import { periodOf, tickLabel } from "../lib/period";

/** Reads theme tokens so chart strokes follow light/dark mode. */
function useTokens() {
  const { theme } = useUI();
  const readAll = () => {
    const s = getComputedStyle(document.documentElement);
    const g = (k: string) => s.getPropertyValue(k).trim();
    return { accent: g("--accent"), muted: g("--muted"), faint: g("--faint"), line: g("--line"), ink: g("--ink"), pos: g("--pos"), neg: g("--neg"), surface: g("--surface"), s3: g("--surface-3") };
  };
  const [t, setT] = useState(readAll);
  useEffect(() => {
    const update = () => requestAnimationFrame(() => setT(readAll()));
    update();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme]);
  return t;
}

function niceStep(max: number) {
  const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const niceMax = (max: number) => Math.ceil((max * 1.04) / niceStep(max)) * niceStep(max);
const niceTicks = (max: number) => { const st = niceStep(max), top = niceMax(max), out: number[] = []; for (let v = 0; v <= top + 1e-6; v += st) out.push(v); return out; };

const axis = (c: string) => ({ fill: c, fontSize: 12, fontFamily: "var(--f-ui)" });

/* ---------- Cumulative spending this month vs last month ---------- */
export function TrendChart({ current, previous, elapsed, budget, mk }: {
  current: number[]; previous: number[]; elapsed: number; budget?: number; mk: string;
}) {
  const k = useTokens();
  const days = current.length - 1;
  const period = periodOf(mk);
  const data = Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return { d, now: d <= elapsed ? current[d] : null, prev: previous[Math.min(d, previous.length - 1)] ?? null };
  });
  const maxVal = Math.max(budget ?? 0, current[elapsed] ?? 0, previous[previous.length - 1] ?? 0, 1000);
  return (
    <div className="chart" role="img" aria-label={`Spending so far in ${monthLabel(mk)}: ${money(current[elapsed] ?? 0)}`}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 22, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="g-now" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={k.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={k.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={k.line} />
          <XAxis dataKey="d" tick={axis(k.muted)} tickLine={false} axisLine={false} ticks={[1, 8, 15, 22, days].filter((d, i, a) => a.indexOf(d) === i && (d === days || days - d > 3))} interval={0} tickFormatter={(d: number) => tickLabel(period, d)} />
          <YAxis tick={axis(k.muted)} tickLine={false} axisLine={false} tickFormatter={compact} width={48} domain={[0, niceMax(maxVal)]} ticks={niceTicks(maxVal)} />
          {budget ? <ReferenceLine y={budget} stroke={k.neg} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: "Budget", position: "insideTopRight", fill: k.neg, fontSize: 11 }} /> : null}
          <Tooltip
            cursor={{ stroke: k.faint, strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => active && payload?.length ? (
              <div className="tip">
                <b>{tickLabel({ ...period, custom: true }, Number(label))} · day {label}</b>
                {payload.map((p) => p.value != null && (
                  <div key={String(p.dataKey)}><span>{p.dataKey === "now" ? "This month" : "Same day last month"}</span>{money(Number(p.value))}</div>
                ))}
              </div>
            ) : null}
          />
          <Line type="monotone" dataKey="prev" stroke={k.faint} strokeWidth={1.75} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="now" stroke={k.accent} strokeWidth={2.5} fill="url(#g-now)" connectNulls={false}
            dot={false} activeDot={{ r: 5, stroke: k.surface, strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Income vs expenses by month ---------- */
export function CashflowChart({ rows }: { rows: { mk: string; income: number; expense: number }[] }) {
  const k = useTokens();
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.mk, "short", false) }));
  return (
    <div className="chart" role="img" aria-label="Income and expenses for the last six months">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={4} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={k.line} />
          <XAxis dataKey="label" tick={axis(k.muted)} tickLine={false} axisLine={false} />
          <YAxis tick={axis(k.muted)} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
          <Tooltip
            cursor={{ fill: k.s3, opacity: 0.5 }}
            content={({ active, payload }) => active && payload?.length ? (
              <div className="tip">
                <b>{monthLabel(String(payload[0].payload.mk))}</b>
                <div><span>Income</span>{money(Number(payload[0].payload.income))}</div>
                <div><span>Expenses</span>{money(Number(payload[0].payload.expense))}</div>
                <div><span>Net</span>{money(Number(payload[0].payload.income) - Number(payload[0].payload.expense), { sign: true })}</div>
              </div>
            ) : null}
          />
          <Bar dataKey="income" fill={k.pos} radius={[6, 6, 2, 2]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="expense" fill={k.ink} fillOpacity={0.82} radius={[6, 6, 2, 2]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Category donut ---------- */
export function CategoryDonut({ rows, total }: { rows: { id: string; total: number }[]; total: number }) {
  const k = useTokens();
  const top = rows.slice(0, 7);
  const rest = rows.slice(7).reduce((s, r) => s + r.total, 0);
  const data = [...top.map((r) => ({ id: r.id, name: getCategory(r.id).name, value: r.total, color: getCategory(r.id).color })),
    ...(rest > 0 ? [{ id: "rest", name: "Everything else", value: rest, color: k.faint }] : [])];
  return (
    <div className="donut">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={data.length > 1 ? 2 : 0}
            stroke={k.surface} strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.id} fill={d.color} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => active && payload?.length ? (
            <div className="tip"><b>{String(payload[0].name)}</b><div><span>{Math.round(Number(payload[0].value) / total * 100)}%</span>{money(Number(payload[0].value))}</div></div>
          ) : null} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center"><div><b>{money(total)}</b><small>spent</small></div></div>
    </div>
  );
}
