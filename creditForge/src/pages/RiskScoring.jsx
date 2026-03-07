import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, Cpu, Network, Info, AlertCircle, ArrowLeft } from 'lucide-react';
import { analysisAPI } from '../services/api';

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

function scoreColor(score) {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-brand-yellow';
    return 'text-red-500';
}
function barColor(score) {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-brand-yellow';
    return 'bg-red-500';
}
function ringColor(riskLevel) {
    if (!riskLevel) return 'text-slate-400';
    const l = riskLevel.toUpperCase();
    if (l === 'LOW') return 'text-emerald-400';
    if (l === 'HIGH' || l === 'VERY_HIGH' || l === 'CRITICAL') return 'text-red-500';
    return 'text-brand-yellow';
}

export default function RiskScoring() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [riskScore, setRiskScore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) { setError('No application ID provided. Navigate from the Dashboard.'); setLoading(false); return; }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await analysisAPI.getRiskScore(id);
                setRiskScore(res.data.riskScore ?? res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load risk score data.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    // ── Build Five C's radar data from real DB fields ──────────────────────────
    const fiveCsData = riskScore
        ? [
            { subject: 'Character', A: riskScore.character ?? 0, fullMark: 100 },
            { subject: 'Capacity', A: riskScore.capacity ?? 0, fullMark: 100 },
            { subject: 'Capital', A: riskScore.capital ?? 0, fullMark: 100 },
            { subject: 'Collateral', A: riskScore.collateral ?? 0, fullMark: 100 },
            { subject: 'Conditions', A: riskScore.conditions ?? 0, fullMark: 100 },
        ]
        : [];

    // ── Build factor breakdown from real factorBreakdown / direct fields ───────
    const riskFactors = riskScore
        ? (riskScore.factorBreakdown ?? [
            { factor: 'Revenue Stability', score: riskScore.revenueStability, weight: riskScore.weights?.revenueWeight },
            { factor: 'Debt Ratio', score: riskScore.debtRatio, weight: riskScore.weights?.debtWeight },
            { factor: 'Litigation', score: riskScore.litigationScore, weight: riskScore.weights?.litigationWeight },
            { factor: 'Promoter', score: riskScore.promoterScore, weight: riskScore.weights?.promoterWeight },
            { factor: 'Sector Outlook', score: riskScore.sectorScore, weight: riskScore.weights?.sectorWeight },
        ])
        : [];

    const deductions = riskScore?.deductions ?? [];
    const score = riskScore?.compositeScore ?? 0;
    const riskLevel = riskScore?.riskLevel ?? '—';
    const recommendation = riskScore?.recommendation ?? '—';
    const recReason = riskScore?.recommendationReason ?? '';

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto pb-10">
                <Skeleton className="h-16 w-full" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-72 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <AlertCircle className="h-12 w-12 text-emerald-400" />
                <p className="text-slate-400 text-center max-w-md">{error}</p>
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </button>
            </div>
        );
    }

    if (!riskScore) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Activity className="h-12 w-12 mb-4 opacity-30" />
                <p>Risk score not yet calculated. Run analysis first.</p>
                <button onClick={() => navigate(`/applications/${id}/company-analysis`)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">
                    <ArrowLeft className="h-4 w-4" /> Company Analysis
                </button>
            </div>
        );
    }

    const ringColor_ = ringColor(riskLevel);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <button onClick={() => navigate(`/applications/${id}/ai-research`)} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-inner">
                        <Activity className="h-6 w-6 text-brand-blue" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Risk Engine & Explainability</h1>
                        <p className="text-sm text-slate-400 mt-1">Transparent breakdown of AI credit evaluations.</p>
                    </div>
                </div>
                <button onClick={() => navigate(`/applications/${id}/cam-report`)} className="px-4 py-2 bg-brand-blue hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-brand-blue/20">
                    View CAM Report →
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left – Score & Breakdown */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Composite Score Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex items-center justify-between relative overflow-hidden">
                        <div className="absolute -left-10 -top-10 w-40 h-40 bg-brand-yellow/10 rounded-full blur-[40px] pointer-events-none" />
                        <div>
                            <h2 className="text-lg font-semibold text-white mb-1">Composite AI Risk Score</h2>
                            <p className="text-sm text-slate-400">Calculated from financial, research, and sector data.</p>
                            {recReason && <p className="text-xs text-slate-500 mt-2 max-w-xs">{recReason}</p>}
                        </div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="text-right">
                                <p className={`text-3xl font-bold ${ringColor_}`}>
                                    {score.toFixed(1)}<span className="text-lg text-slate-500 font-medium">/100</span>
                                </p>
                                <p className={`text-xs font-semibold uppercase tracking-widest mt-1 ${ringColor_}`}>
                                    {riskLevel} Risk
                                </p>
                                <p className="text-xs text-slate-400 mt-1 font-medium">
                                    Rec: <span className={`font-bold ${recommendation === 'APPROVE' ? 'text-emerald-400' : recommendation === 'REJECT' ? 'text-red-500' : 'text-brand-yellow'}`}>{recommendation}</span>
                                </p>
                            </div>
                            {/* SVG ring chart */}
                            <div className="h-16 w-16 relative">
                                <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
                                    <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path
                                        className={ringColor_}
                                        strokeDasharray={`${score}, 100`}
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        stroke="currentColor"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Factor Breakdown Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Network className="h-5 w-5 text-brand-blue" />
                                Score Explainability Breakdown
                            </h2>
                            <button className="text-slate-400 hover:text-white transition-colors">
                                <Info className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="text-xs text-slate-500 bg-slate-950 uppercase border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-medium tracking-wider">Factor</th>
                                        <th className="px-6 py-4 font-medium tracking-wider">Score</th>
                                        <th className="px-6 py-4 font-medium tracking-wider">Weight</th>
                                        <th className="px-6 py-4 font-medium tracking-wider">Impact</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80 bg-slate-900">
                                    {riskFactors.map((item, idx) => {
                                        const s = typeof item.score === 'number' ? item.score : parseFloat(item.score || 0);
                                        const w = item.weight != null
                                            ? (typeof item.weight === 'number' ? `${(item.weight * 100).toFixed(0)}%` : item.weight)
                                            : '—';
                                        const impact = s >= 75 ? 'Positive' : s >= 50 ? 'Neutral' : 'Negative';
                                        return (
                                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-200">
                                                    {item.factor ?? item.name ?? `Factor ${idx + 1}`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <span className={`font-bold w-8 text-right ${scoreColor(s)}`}>{s.toFixed(1)}</span>
                                                        <div className="w-full bg-slate-800 rounded-full h-1.5 max-w-[80px] overflow-hidden">
                                                            <div className={`h-full rounded-full ${barColor(s)}`} style={{ width: `${Math.min(s, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-300">{w}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${impact === 'Positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        impact === 'Negative' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                            'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20'
                                                        }`}>
                                                        {impact}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500">
                            * Weights sourced from active Settings configuration.
                        </div>
                    </div>
                </div>

                {/* Right Col */}
                <div className="space-y-6">
                    {/* Five C's Radar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center">
                        <h2 className="text-lg font-semibold text-white mb-2 self-start flex items-center gap-2">
                            <Cpu className="h-5 w-5 text-brand-blue" />
                            Five C's of Credit
                        </h2>
                        <p className="text-xs text-slate-400 self-start mb-4">Multi-dimensional risk mapping</p>
                        {fiveCsData.every((d) => d.A === 0) ? (
                            <p className="text-slate-500 text-sm">Five C's data not available.</p>
                        ) : (
                            <div className="w-full h-64 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={fiveCsData}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="Company Profile" dataKey="A" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.3} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Key AI Deductions */}
                    {deductions.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-brand-yellow" />
                                Key AI Deductions
                            </h2>
                            <ul className="space-y-3">
                                {deductions.map((d, i) => (
                                    <li key={i} className="text-sm text-slate-300 pl-4 leading-relaxed border-l-2 border-red-500/50">
                                        {typeof d === 'string' ? d : d.reason ?? JSON.stringify(d)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
