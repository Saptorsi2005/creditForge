import { useState, useEffect, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Users, CheckCircle2, XCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, applicationsAPI } from '../services/api';

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

// ── Risk color helpers ────────────────────────────────────────────────────────
const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626' };

function normalizeRiskDistribution(raw = {}) {
    return [
        { name: 'Low Risk', value: raw.LOW ?? 0, color: RISK_COLORS.LOW },
        { name: 'Medium Risk', value: raw.MEDIUM ?? 0, color: RISK_COLORS.MEDIUM },
        { name: 'High Risk', value: raw.HIGH ?? 0, color: RISK_COLORS.HIGH },
        { name: 'Critical Risk', value: raw.CRITICAL ?? 0, color: RISK_COLORS.CRITICAL },
    ].filter((d) => d.value > 0);
}

function statusBadgeClass(status = '') {
    const s = status.toUpperCase();
    if (s === 'APPROVED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (s === 'REJECTED') return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (s === 'COMPLETED') return 'bg-brand-blue/10 text-brand-blue border-brand-blue/20';
    if (s === 'FAILED') return 'bg-red-900/30 text-red-400 border-red-900/30';
    return 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20';
}

function formatCurrency(amount) {
    if (!amount) return '—';
    const cr = amount / 10000000; // 1 Cr = 10M (assuming amount in INR)
    return `₹ ${cr.toFixed(2)} Cr`;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();

    const [stats, setStats] = useState(null);
    const [charts, setCharts] = useState(null);
    const [applications, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, chartsRes, appsRes] = await Promise.all([
                dashboardAPI.getStats(),
                dashboardAPI.getCharts(),
                applicationsAPI.getAll({ limit: 5, page: 1 }),
            ]);
            setStats(statsRes.data);
            setCharts(chartsRes.data);
            setApps(appsRes.data.applications || []);
        } catch (err) {
            console.error('[Dashboard] fetch error:', err);
            setError(err.response?.data?.error || 'Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll, refreshKey]);

    // ── KPI cards built from real /stats response ─────────────────────────────
    const kpiCards = stats
        ? [
            { name: 'Total Applications', value: stats.totalApplications ?? 0, icon: Users, color: 'text-brand-blue' },
            { name: 'Approved', value: stats.approved ?? 0, icon: CheckCircle2, color: 'text-emerald-400' },
            { name: 'Rejected', value: stats.rejected ?? 0, icon: XCircle, color: 'text-red-400' },
            { name: 'Under Review', value: stats.underReview ?? 0, icon: Clock, color: 'text-brand-yellow' },
        ]
        : [];

    // ── Risk distribution from /stats.riskDistribution ───────────────────────
    const riskData = normalizeRiskDistribution(stats?.riskDistribution);

    // ── Sector data from /charts.applicationsBySector ────────────────────────
    const sectorData = (charts?.applicationsBySector ?? []).map((d) => ({
        name: d.sector || d.name || 'Unknown',
        value: d.count ?? d.value ?? 0,
    }));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Overview</h1>
                    <p className="text-sm text-slate-400 mt-1">Real-time credit analysis and portfolio health.</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setRefreshKey((k) => k + 1)}
                        title="Refresh"
                        className="px-3 py-2 bg-slate-800 text-slate-400 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {hasPermission('create') && (
                        <button
                            onClick={() => navigate('/new-application')}
                            className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-lg shadow-brand-blue/20"
                        >
                            New Application
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <Skeleton className="h-4 w-32 mb-4" />
                            <Skeleton className="h-9 w-20" />
                        </div>
                    ))
                    : kpiCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div key={card.name} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-blue/5 rounded-full blur-2xl pointer-events-none" />
                                <div className="flex items-center justify-between relative z-10">
                                    <p className="text-sm font-medium text-slate-400">{card.name}</p>
                                    <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg">
                                        <Icon className={`h-5 w-5 ${card.color}`} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-baseline space-x-2 relative z-10">
                                    <p className="text-3xl font-semibold text-white">
                                        {card.value.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut — Risk Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-white mb-6">Risk Distribution</h2>
                    {loading ? (
                        <Skeleton className="h-72 w-full" />
                    ) : riskData.length === 0 ? (
                        <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
                            No risk data yet
                        </div>
                    ) : (
                        <>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={riskData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {riskData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                                            itemStyle={{ color: '#f8fafc' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 mt-2">
                                {riskData.map(item => (
                                    <div key={item.name} className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs text-slate-400 font-medium">
                                            {item.name} ({item.value})
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Bar — Applications by Sector */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-white mb-6">Applications by Sector</h2>
                    {loading ? (
                        <Skeleton className="h-72 w-full" />
                    ) : sectorData.length === 0 ? (
                        <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
                            No sector data yet
                        </div>
                    ) : (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sectorData} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                                    <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        cursor={{ fill: '#1e293b' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                                    />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Applications Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-white">Recent Loan Applications</h2>
                    {hasPermission('create') && (
                        <button
                            onClick={() => navigate('/new-application')}
                            className="text-sm text-brand-blue hover:text-blue-400 font-medium transition-colors"
                        >
                            + New
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="text-xs text-slate-500 bg-slate-900/50 uppercase border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4 font-medium tracking-wider">Application ID</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Entity Name</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Sector</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Requested Amount</th>
                                <th className="px-6 py-4 font-medium tracking-wider">AI Risk Score</th>
                                <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                            {loading
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <Skeleton className="h-4 w-full" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                                : applications.length === 0
                                    ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                No applications yet.{' '}
                                                {hasPermission('create') && (
                                                    <button
                                                        onClick={() => navigate('/new-application')}
                                                        className="text-brand-blue hover:underline"
                                                    >
                                                        Create one.
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                    : applications.map((app) => {
                                        const score = app.aiScore ?? app.riskScore?.compositeScore ?? null;
                                        return (
                                            <tr
                                                key={app.id}
                                                className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                                                onClick={() => navigate(`/applications/${app.id}/company-analysis`)}
                                            >
                                                <td className="px-6 py-4 font-medium text-brand-blue group-hover:text-blue-400 transition-colors">
                                                    {app.applicationNo}
                                                </td>
                                                <td className="px-6 py-4 text-slate-200 font-medium">{app.companyName}</td>
                                                <td className="px-6 py-4">{app.sector}</td>
                                                <td className="px-6 py-4 font-medium text-slate-300">
                                                    {formatCurrency(app.loanAmount)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {score !== null ? (
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-full bg-slate-800 rounded-full h-1.5 max-w-[80px] overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-brand-yellow' : 'bg-red-500'}`}
                                                                    style={{ width: `${Math.min(score, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-medium text-slate-300 w-8 text-right">
                                                                {Math.round(score)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs">Not scored</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-semibold border ${statusBadgeClass(app.status)}`}>
                                                        {app.status?.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
