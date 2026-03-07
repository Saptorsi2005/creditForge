import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Activity, CheckCircle, AlertTriangle,
    XCircle, Info, Calculator, Percent, Clock, DollarSign,
    ArrowLeft, Loader2, BrainCircuit
} from 'lucide-react';
import { analysisAPI } from '../services/api';

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

function fmt(v, unit = '') {
    if (v == null) return '—';
    return `${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${unit}`;
}

function fmtCr(v) {
    if (v == null) return '—';
    // Convert to Cr units
    const crValue = v / 10000000;
    return `₹ ${fmt(crValue)} Cr`;
}

export default function RecommendationEngine() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [risk, setRisk] = useState(null);
    const [app, setApp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await analysisAPI.getRiskScore(id);
            setRisk(res.data.riskScore);
            setApp(res.data.riskScore?.application);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load recommendation data.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10 px-4">
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-400" />
            <p className="text-slate-400">{error}</p>
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-slate-800 text-white rounded-lg">
                Back to Dashboard
            </button>
        </div>
    );

    const score = risk?.compositeScore ?? 0;
    const recommendation = risk?.recommendation ?? 'PENDING';
    const riskLevel = risk?.riskLevel ?? 'UNKNOWN';
    const requestedAmount = app?.loanAmount ?? 0;

    // Recommendation Logic (Mirrors Backend)
    let suggestedAmount = requestedAmount;
    let suggestedTenure = 60;
    let suggestedRate = 8.5; // Base rate placeholder

    if (recommendation === 'APPROVE') {
        suggestedAmount = requestedAmount;
        suggestedTenure = score > 80 ? 84 : score > 70 ? 60 : 48;
    } else if (recommendation === 'CONDITIONAL') {
        suggestedAmount = requestedAmount * 0.75;
        suggestedTenure = 36;
    } else if (recommendation === 'REJECT') {
        suggestedAmount = 0;
        suggestedTenure = 0;
    }

    const getStatusStyles = () => {
        switch (recommendation) {
            case 'APPROVE': return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle };
            case 'CONDITIONAL': return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle };
            case 'REJECT': return { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: XCircle };
            default: return { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: Info };
        }
    };

    const styles = getStatusStyles();
    const StatusIcon = styles.icon;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12 px-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <BrainCircuit className="h-8 w-8 text-emerald-400" />
                            Recommendation Engine
                        </h1>
                        <p className="text-slate-400 mt-1">AI-driven credit decisioning & loan structuring</p>
                    </div>
                </div>
                <div className={`px-6 py-2 rounded-full border ${styles.border} ${styles.bg} ${styles.color} flex items-center gap-2 font-bold text-lg`}>
                    <StatusIcon className="h-5 w-5" />
                    {recommendation}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'AI Composite Score', value: `${score}/100`, sub: riskLevel, icon: Activity, color: 'text-emerald-400' },
                    { label: 'Suggested Limit', value: fmtCr(suggestedAmount), sub: `Requested: ${fmtCr(requestedAmount)}`, icon: DollarSign, color: 'text-blue-400' },
                    { label: 'Proposed Interest', value: `${score > 0 ? (8.5 + (3.0 * (100 - score) / 100)).toFixed(2) : '—'}%`, sub: 'ROI per annum', icon: Percent, color: 'text-amber-400' },
                    { label: 'Tenure Offering', value: `${suggestedTenure} Months`, sub: 'Fixed Repayment', icon: Clock, color: 'text-purple-400' },
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
                                <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                            </div>
                            <stat.icon className={`h-6 w-6 ${stat.color} opacity-80`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Decision Breakdown */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-emerald-400" />
                            Decision Logic & Rationalization
                        </h2>

                        <div className="space-y-6">
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2">Automated Justification</h3>
                                <p className="text-slate-300 leading-relaxed italic">
                                    "{risk?.recommendationReason || 'Generating detailed rationale...'}"
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Exposure Assessment</h4>
                                    <p className="text-sm text-slate-300">
                                        Limit calculation utilizes a <strong>{recommendation === 'CONDITIONAL' ? '25% risk-haircut' : 'primary exposure'}</strong> model based on the AI composite score of {score}.
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Pricing Matrix</h4>
                                    <p className="text-sm text-slate-300">
                                        Interest rate derived from Base Rate (8.5%) + Risk Premium (max 3%) pegged to {100 - score}% of unmitigated risk.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Conditions Box */}
                    {recommendation !== 'REJECT' && (
                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Activity className="h-24 w-24 text-emerald-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-4">Proposed Mitigants & Conditions</h2>
                            <ul className="space-y-3">
                                {[
                                    `Minimum DSCR maintenance of ${recommendation === 'CONDITIONAL' ? '1.5x' : '1.75x'}`,
                                    'Quarterly submission of audited GST returns',
                                    recommendation === 'CONDITIONAL' ? 'Personal guarantee from all primary promoters' : 'Standard pari-passu charge on current assets',
                                    'Immediate notification of any legal proceedings'
                                ].map((cond, i) => (
                                    <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                        {cond}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Score Components */}
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                        <h2 className="text-lg font-bold text-white mb-4">Risk Factor Breakdown</h2>
                        <div className="space-y-5">
                            {[
                                { label: 'Financial Stability', score: risk?.revenueStability },
                                { label: 'Debt Capability', score: risk?.debtRatio },
                                { label: 'Character / Litigation', score: risk?.litigationScore },
                                { label: 'Character / Promoter', score: risk?.promoterScore },
                                { label: 'Sector Context', score: risk?.sectorScore },
                            ].map((factor, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-slate-400 font-medium">{factor.label}</span>
                                        <span className="text-white font-bold">{factor.score || 0}/100</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${factor.score >= 80 ? 'bg-emerald-500' : factor.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                                }`}
                                            style={{ width: `${factor.score || 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-center">
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2 font-mono">Transparency Log</p>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            Every decision is generated by our proprietary AI model. Calculations are deterministic based on 45+ financial and non-financial data points.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
