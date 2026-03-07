import { useState, useEffect, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Users, CheckCircle2, XCircle, Clock, RefreshCw, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, applicationsAPI } from '../services/api';

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'rgba(255,255,255,0.04)' }} />;
}

// ── Risk color helpers ────────────────────────────────────────────────────────
const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626' };

function normalizeRiskDistribution(raw = {}) {
    return [
        { name: 'Low Risk', value: raw.LOW ?? 0, color: RISK_COLORS.LOW },
        { name: 'Medium Risk', value: raw.MEDIUM ?? 0, color: RISK_COLORS.MEDIUM },
        { name: 'High Risk', value: (raw.HIGH ?? 0) + (raw.VERY_HIGH ?? 0), color: RISK_COLORS.HIGH },
        { name: 'Critical Risk', value: raw.CRITICAL ?? 0, color: RISK_COLORS.CRITICAL },
    ].filter((d) => d.value > 0);
}

function statusBadgeStyle(status = '') {
    const s = status.toUpperCase();
    if (s === 'APPROVED') return { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.2)' };
    if (s === 'REJECTED') return { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.2)' };
    if (s === 'COMPLETED') return { bg: 'rgba(16,185,129,0.1)', text: '#6ee7b7', border: 'rgba(16,185,129,0.2)' };
    if (s === 'FAILED') return { bg: 'rgba(220,38,38,0.12)', text: '#ef4444', border: 'rgba(220,38,38,0.2)' };
    return { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)' };
}

function formatCurrency(amount) {
    if (!amount) return '—';
    const cr = amount / 10000000;
    return `₹ ${cr.toFixed(2)} Cr`;
}

// KPI card accent configs
const CARD_ACCENTS = [
    { glow: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.15)', iconBg: 'rgba(16,185,129,0.1)', iconColor: '#34d399' },
    { glow: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.15)', iconBg: 'rgba(16,185,129,0.1)', iconColor: '#34d399' },
    { glow: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.15)', iconBg: 'rgba(249,115,22,0.1)', iconColor: '#fb923c' },
    { glow: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.15)', iconBg: 'rgba(245,158,11,0.08)', iconColor: '#fbbf24' },
];

const tooltipStyle = {
    contentStyle: {
        backgroundColor: '#0b1120',
        borderColor: 'rgba(255,255,255,0.07)',
        borderRadius: '0.75rem',
        color: '#f8fafc',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        fontSize: '12px'
    },
    itemStyle: { color: '#cbd5e1' }
};

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

    useEffect(() => { fetchAll(); }, [fetchAll, refreshKey]);

    const kpiCards = stats
        ? [
            { name: 'Total Applications', value: stats.totalApplications ?? 0, icon: Users, accentIdx: 0 },
            { name: 'Approved', value: stats.approved ?? 0, icon: CheckCircle2, accentIdx: 1 },
            { name: 'Rejected', value: stats.rejected ?? 0, icon: XCircle, accentIdx: 2 },
            { name: 'Under Review', value: stats.underReview ?? 0, icon: Clock, accentIdx: 3 },
        ]
        : [];

    const riskData = normalizeRiskDistribution(stats?.riskDistribution);
    const sectorData = (charts?.applicationsBySector ?? []).map((d) => ({
        name: d.sector || d.name || 'Unknown',
        value: d.count ?? d.value ?? 0,
    }));

    // Format current date nicely
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const cardStyle = {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
    };

    return (
        <div className="space-y-6 pb-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h1>
                    <p className="text-sm mt-1" style={{ color: '#475569' }}>{today}</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setRefreshKey((k) => k + 1)}
                        title="Refresh"
                        className="h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-150"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    >
                        <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {hasPermission('create') && (
                        <button
                            onClick={() => navigate('/new-application')}
                            className="px-4 h-9 rounded-xl text-sm font-semibold text-white transition-all duration-150 flex items-center space-x-2"
                            style={{
                                background: 'linear-gradient(135deg, #10b981, #047857)',
                                boxShadow: '0 4px 16px rgba(16,185,129,0.35)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 24px rgba(16,185,129,0.5)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.35)'}
                        >
                            <span>New Application</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="px-4 py-3 rounded-xl text-sm flex items-center space-x-2"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={cardStyle} className="p-5">
                            <Skeleton className="h-4 w-28 mb-4" />
                            <Skeleton className="h-8 w-16" />
                        </div>
                    ))
                    : kpiCards.map((card, idx) => {
                        const Icon = card.icon;
                        const accent = CARD_ACCENTS[card.accentIdx];
                        return (
                            <div key={card.name} className="p-5 relative overflow-hidden transition-all duration-200"
                                style={{
                                    ...cardStyle,
                                    borderColor: accent.border,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.boxShadow = `0 8px 32px ${accent.glow}`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                {/* Glow orb */}
                                <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl pointer-events-none opacity-50"
                                    style={{ background: accent.glow }} />
                                <div className="flex items-center justify-between relative z-10">
                                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>{card.name}</p>
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: accent.iconBg, border: `1px solid ${accent.border}` }}>
                                        <Icon className="h-4 w-4" style={{ color: accent.iconColor }} />
                                    </div>
                                </div>
                                <p className="mt-4 text-3xl font-bold text-white relative z-10 tracking-tight">
                                    {card.value.toLocaleString()}
                                </p>
                            </div>
                        );
                    })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Donut — Risk Distribution */}
                <div style={cardStyle} className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Risk Distribution</h2>
                        <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>Portfolio</span>
                    </div>
                    {loading ? (
                        <Skeleton className="h-72 w-full" />
                    ) : riskData.length === 0 ? (
                        <div className="h-72 flex items-center justify-center text-slate-600 text-sm">No risk data yet</div>
                    ) : (
                        <>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={riskData} cx="50%" cy="50%"
                                            innerRadius={70} outerRadius={100}
                                            paddingAngle={4} dataKey="value" stroke="none"
                                        >
                                            {riskData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip {...tooltipStyle} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center flex-wrap gap-x-5 gap-y-2 mt-3">
                                {riskData.map(item => (
                                    <div key={item.name} className="flex items-center space-x-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                                            {item.name} <span className="opacity-60">({item.value})</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Bar — Applications by Sector */}
                <div style={cardStyle} className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Applications by Sector</h2>
                        <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>Distribution</span>
                    </div>
                    {loading ? (
                        <Skeleton className="h-72 w-full" />
                    ) : sectorData.length === 0 ? (
                        <div className="h-72 flex items-center justify-center text-slate-600 text-sm">No sector data yet</div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sectorData} layout="vertical" margin={{ top: 0, right: 8, left: 32, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                                    <XAxis type="number" stroke="#334155" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis dataKey="name" type="category" stroke="#334155" fontSize={11} tickLine={false} axisLine={false} />
                                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} {...tooltipStyle} />
                                    <Bar dataKey="value" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={20}>
                                    </Bar>
                                    <defs>
                                        <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#047857" />
                                            <stop offset="100%" stopColor="#10b981" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Applications Table */}
            <div style={cardStyle} className="overflow-hidden">
                <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Recent Applications</h2>
                        <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Latest 5 loan applications</p>
                    </div>
                    {hasPermission('create') && (
                        <button
                            onClick={() => navigate('/new-application')}
                            className="text-xs font-semibold transition-colors flex items-center space-x-1"
                            style={{ color: '#10b981' }}
                            onMouseEnter={e => e.target.style.color = '#6ee7b7'}
                            onMouseLeave={e => e.target.style.color = '#10b981'}
                        >
                            <span>+ New</span>
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                {['Application ID', 'Entity Name', 'Sector', 'Requested Amount', 'AI Risk Score', 'Status'].map(col => (
                                    <th key={col} className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#334155' }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
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
                                            <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: '#334155' }}>
                                                No applications yet.{' '}
                                                {hasPermission('create') && (
                                                    <button onClick={() => navigate('/new-application')}
                                                        className="font-semibold transition-colors" style={{ color: '#10b981' }}>
                                                        Create one.
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                    : applications.map((app) => {
                                        const score = app.aiScore ?? app.riskScore?.compositeScore ?? null;
                                        const badge = statusBadgeStyle(app.status);
                                        return (
                                            <tr
                                                key={app.id}
                                                className="transition-all duration-150 cursor-pointer group"
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                                onClick={() => navigate(`/applications/${app.id}/company-analysis`)}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderLeft = '3px solid rgba(16,185,129,0.4)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderLeft = ''; }}
                                            >
                                                <td className="px-6 py-4 font-mono text-xs font-semibold" style={{ color: '#6ee7b7' }}>
                                                    {app.applicationNo}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-200 text-sm">{app.companyName}</td>
                                                <td className="px-6 py-4 text-xs" style={{ color: '#64748b' }}>{app.sector}</td>
                                                <td className="px-6 py-4 font-semibold text-sm" style={{ color: '#94a3b8' }}>
                                                    {formatCurrency(app.loanAmount)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {score !== null ? (
                                                        <div className="flex items-center space-x-2.5">
                                                            <div className="w-16 rounded-full h-1"
                                                                style={{ background: 'rgba(255,255,255,0.06)' }}>
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${Math.min(score, 100)}%`,
                                                                        background: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-bold" style={{
                                                                color: score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#ef4444'
                                                            }}>
                                                                {Math.round(score)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs" style={{ color: '#334155' }}>Not scored</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                                                        style={{
                                                            background: badge.bg,
                                                            color: badge.text,
                                                            border: `1px solid ${badge.border}`
                                                        }}>
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
