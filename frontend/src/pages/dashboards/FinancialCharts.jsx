import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { formatINR } from '../../utils/formatters';

const CHART_COLORS = ['#1E3A8A', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626'];

export function FinancialCharts({ charts, summary, fundsHref = '/funds' }) {
  if (!charts) return null;
  const cashflow = Array.isArray(charts.monthlyCashflow) ? charts.monthlyCashflow : [];
  const funds = Array.isArray(charts.fundDistribution) ? charts.fundDistribution : [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Summary cards use {summary?.reportingPeriodLabel || 'the selected period'}.{' '}
        {charts.chartRangeDescription || 'Charts cover the past six months and are not the selected summary period.'}
        {charts.chartRangeLabel ? ` Chart window: ${charts.chartRangeLabel}.` : ''}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <BarChart2 size={16} className="text-blue-600" />
            Monthly Income versus Expenditure
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Past six months{charts.chartRangeLabel ? `: ${charts.chartRangeLabel}` : ''}. Not the selected summary period.
          </p>
          <div className="h-72 w-full pt-4">
            {cashflow.length === 0 ? (
              <p className="text-xs text-slate-500">No posted cash flow in this chart window.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(value) => `₹${value / 100000}L`} />
                  <Tooltip formatter={(value) => [formatINR(value), '']} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="income" name="Income" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenditure" name="Expenditure" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <PieChartIcon size={16} className="text-blue-600" />
                Fund-wise Balance Distribution
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {summary?.fundBalanceDescription || 'Current balances, separate from period income and expenditure.'}
              </p>
            </div>
            <Link to={fundsHref} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
              View funds <ArrowRight size={12} />
            </Link>
          </div>
          <div className="h-72 w-full pt-2">
            {funds.length === 0 ? (
              <p className="text-xs text-slate-500">No fund balances were returned.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={funds} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {funds.map((entry, index) => (
                      <Cell key={entry.name || index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatINR(value), 'Balance']} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
