import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import {
    Building2, AlertTriangle, FileWarning,
    Wallet, ArrowUpRight, ArrowDownRight, Activity, Loader2,
    AlertCircle, ArrowLeft, RefreshCw, CheckCircle2, Pencil, X, Eye
} from 'lucide-react';
import { analysisAPI, applicationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function fmt(val, unit = '') {
    if (val === null || val === undefined) return '—';
    return `${parseFloat(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${unit}`;
}
function fmtCr(val) {
    if (val === null || val === undefined) return '—';
    const inCrores = val / 10000000;
    return `₹ ${fmt(inCrores)} Cr`;
}

function fmtPct(val) {
    if (val === null || val === undefined) return '—';
    return `${fmt(val)}%`;
}

/**
 * buildRevenueChart — Override priority:
 * If financialOverrides.multiYearRevenue exists, use it for the chart.
 * Otherwise fall back to extracted multiYearRevenue.
 */
function buildRevenueChart(analysis) {
    const overrideMyr = analysis?.financialOverrides?.multiYearRevenue;
    const extractedMyr = analysis?.multiYearRevenue;
    const myr = (Array.isArray(overrideMyr) && overrideMyr.length > 0) ? overrideMyr : extractedMyr;

    if (!Array.isArray(myr) || myr.length === 0) return [];

    return myr
        .sort((a, b) => a.year - b.year)
        .map((item) => ({
            year: item.year,
            revenue: (item.revenue ?? 0) / 10000000,
            ebitda: (item.ebitda ?? 0) / 10000000,
        }));
}

function severityColor(s = '') {
    const sv = s.toLowerCase();
    if (sv === 'high' || sv === 'critical') return 'border-red-500/30 bg-red-500/10 text-red-400';
    if (sv === 'medium') return 'border-brand-yellow/30 bg-brand-yellow/10 text-brand-yellow';
    return 'border-slate-700 bg-slate-800 text-slate-300';
}

// ── OverridePill: shown next to a metric that has been manually overridden ─────
function OverridePill() {
    return (
        <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <Pencil className="h-2.5 w-2.5" /> OVR
        </span>
    );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toCr(raw) {
    if (raw === null || raw === undefined) return null;
    return parseFloat((raw / 10000000).toFixed(4));
}
function fmtCrModal(val) {
    if (val === null || val === undefined) return '—';
    return `₹ ${parseFloat(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
}
function isChanged(overrideStr, extractedRaw) {
    if (overrideStr === '' || overrideStr === null || overrideStr === undefined) return false;
    const ovVal = parseFloat(overrideStr) * 10000000;
    return extractedRaw !== null && extractedRaw !== undefined && Math.abs(ovVal - extractedRaw) > 0.001;
}

// ── EditFinancialsModal ────────────────────────────────────────────────────────
function EditFinancialsModal({ analysis, onClose, onSave, saving, onReset, resetting }) {
    const ov = analysis?.financialOverrides || {};

    // Each metric: key=override key, label, extractedRaw=raw INR from analysis
    const METRICS = [
        { key: 'revenue', label: 'Annual Revenue', extractedRaw: analysis?.revenue },
        { key: 'ebitda', label: 'EBITDA', extractedRaw: analysis?.ebitda },
        { key: 'netProfit', label: 'Net Profit', extractedRaw: analysis?.netProfit },
        { key: 'totalDebt', label: 'Total Debt', extractedRaw: analysis?.totalDebt },
        { key: 'netWorth', label: 'Net Worth', extractedRaw: analysis?.netWorth },
        { key: 'currentAssets', label: 'Current Assets', extractedRaw: analysis?.totalAssets },
        { key: 'currentLiabilities', label: 'Current Liabilities', extractedRaw: analysis?.totalLiabilities },
    ];

    // Init override field: override value in Crores if exists, else extracted in Crores
    const initField = (key, extractedRaw) => {
        const raw = ov[key] !== undefined ? ov[key] : extractedRaw;
        return raw !== null && raw !== undefined ? String(toCr(raw)) : '';
    };

    const initFields = () => {
        const f = {};
        METRICS.forEach(({ key, extractedRaw }) => { f[key] = initField(key, extractedRaw); });
        return f;
    };

    const [fields, setFields] = useState(initFields);
    const [errors, setErrors] = useState({});
    const [reason, setReason] = useState(ov.reason || '');
    const [confirmReset, setConfirmReset] = useState(false);

    // multi-year revenue
    const extractedMyr = Array.isArray(analysis?.multiYearRevenue) ? analysis.multiYearRevenue : [];
    const overrideMyr = Array.isArray(ov.multiYearRevenue) ? ov.multiYearRevenue : null;
    const baseMyr = overrideMyr || extractedMyr;
    const [myrRows, setMyrRows] = useState(
        baseMyr.map((r, i) => ({
            year: String(r.year ?? ''),
            revenue: r.revenue !== undefined ? String(toCr(r.revenue)) : '',
            ebitda: r.ebitda !== undefined ? String(toCr(r.ebitda)) : '',
            // extracted for comparison
            extRevenue: extractedMyr[i]?.revenue,
            extEbitda: extractedMyr[i]?.ebitda,
        }))
    );

    // detect if any value actually changed from extracted
    const hasAnyChange = METRICS.some(({ key, extractedRaw }) => isChanged(fields[key], extractedRaw));

    const validate = () => {
        const errs = {};
        METRICS.forEach(({ key }) => {
            const v = fields[key];
            if (v !== '' && (isNaN(parseFloat(v)) || parseFloat(v) < 0)) {
                errs[key] = 'Must be a non-negative number';
            }
        });
        myrRows.forEach((row, i) => {
            if (row.revenue !== '' && (isNaN(parseFloat(row.revenue)) || parseFloat(row.revenue) < 0))
                errs[`myr_rev_${i}`] = 'Invalid';
            if (row.ebitda !== '' && (isNaN(parseFloat(row.ebitda)) || parseFloat(row.ebitda) < 0))
                errs[`myr_ebitda_${i}`] = 'Invalid';
        });
        if (hasAnyChange && !reason.trim()) {
            errs.reason = 'Reason is required when overriding values.';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        const toRaw = v => v !== '' ? parseFloat(v) * 10000000 : undefined;
        const payload = { reason: reason.trim() };
        METRICS.forEach(({ key }) => {
            if (fields[key] !== '') payload[key] = toRaw(fields[key]);
        });
        if (myrRows.length > 0) {
            payload.multiYearRevenue = myrRows
                .filter(r => r.year)
                .map(r => ({
                    year: Number(r.year),
                    revenue: r.revenue !== '' ? parseFloat(r.revenue) * 10000000 : undefined,
                    ebitda: r.ebitda !== '' ? parseFloat(r.ebitda) * 10000000 : undefined,
                }));
        }
        onSave(payload);
    };

    const inputCls = (key) =>
        `w-full bg-slate-950 border ${errors[key] ? 'border-emerald-500/60' : 'border-slate-700'} rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-blue placeholder-slate-700 transition-colors`;

    const rowCls = (key, extractedRaw) =>
        isChanged(fields[key], extractedRaw)
            ? 'border-l-2 border-amber-500/60 bg-amber-500/5'
            : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-amber-400" /> Edit Financial Values
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Original extracted data is preserved. Overrides are tracked and auditable.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

                    {/* ── Comparison Table ── */}
                    <div>
                        <div className="grid grid-cols-3 gap-2 mb-2 px-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Metric</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Extracted Value</p>
                            <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider">Override Value</p>
                        </div>
                        <div className="space-y-1">
                            {METRICS.map(({ key, label, extractedRaw }) => (
                                <div key={key} className={`grid grid-cols-3 gap-2 items-center px-2 py-2 rounded-lg transition-colors ${rowCls(key, extractedRaw)}`}>
                                    <span className="text-sm text-slate-300 font-medium flex items-center gap-1">
                                        {label}
                                        {isChanged(fields[key], extractedRaw) && (
                                            <span className="text-amber-400" title="Value differs from extracted">⚑</span>
                                        )}
                                    </span>
                                    <span className="text-sm text-slate-500 font-mono">{fmtCrModal(toCr(extractedRaw))}</span>
                                    <div>
                                        <input
                                            type="number" min="0" step="any"
                                            placeholder="Override (₹ Cr)"
                                            value={fields[key]}
                                            onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                                            className={inputCls(key)}
                                        />
                                        {errors[key] && <p className="text-xs text-emerald-400 mt-0.5">{errors[key]}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Multi-Year Revenue Comparison ── */}
                    {myrRows.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Multi-Year Revenue (₹ Crores)</p>
                            <div className="grid grid-cols-5 gap-2 mb-1 px-2">
                                {['Year', 'Ext. Revenue', 'Ovr. Revenue', 'Ext. EBITDA', 'Ovr. EBITDA'].map(h => (
                                    <p key={h} className={`text-[10px] font-bold uppercase tracking-wider ${h.startsWith('Ovr') ? 'text-amber-500/80' : 'text-slate-500'}`}>{h}</p>
                                ))}
                            </div>
                            <div className="space-y-1">
                                {myrRows.map((row, i) => {
                                    const revChanged = row.revenue !== '' && row.extRevenue !== undefined &&
                                        Math.abs(parseFloat(row.revenue) * 10000000 - row.extRevenue) > 0.001;
                                    const ebitdaChanged = row.ebitda !== '' && row.extEbitda !== undefined &&
                                        Math.abs(parseFloat(row.ebitda) * 10000000 - row.extEbitda) > 0.001;
                                    return (
                                        <div key={i} className={`grid grid-cols-5 gap-2 items-center px-2 py-2 rounded-lg ${(revChanged || ebitdaChanged) ? 'border-l-2 border-amber-500/60 bg-amber-500/5' : ''}`}>
                                            <span className="text-sm text-slate-300 font-mono font-semibold">{row.year}</span>
                                            <span className="text-sm text-slate-500 font-mono">{fmtCrModal(toCr(row.extRevenue))}</span>
                                            <div>
                                                <input type="number" min="0" step="any"
                                                    value={row.revenue}
                                                    onChange={e => setMyrRows(rows => rows.map((r, idx) => idx === i ? { ...r, revenue: e.target.value } : r))}
                                                    className={inputCls(`myr_rev_${i}`)}
                                                />
                                                {errors[`myr_rev_${i}`] && <p className="text-xs text-emerald-400 mt-0.5">{errors[`myr_rev_${i}`]}</p>}
                                            </div>
                                            <span className="text-sm text-slate-500 font-mono">{fmtCrModal(toCr(row.extEbitda))}</span>
                                            <div>
                                                <input type="number" min="0" step="any"
                                                    value={row.ebitda}
                                                    onChange={e => setMyrRows(rows => rows.map((r, idx) => idx === i ? { ...r, ebitda: e.target.value } : r))}
                                                    className={inputCls(`myr_ebitda_${i}`)}
                                                />
                                                {errors[`myr_ebitda_${i}`] && <p className="text-xs text-emerald-400 mt-0.5">{errors[`myr_ebitda_${i}`]}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Reason for Override ── */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Reason for Manual Adjustment
                            {hasAnyChange && <span className="ml-1 text-emerald-400">*</span>}
                        </label>
                        <textarea
                            rows={3}
                            placeholder="e.g. Correcting PDF extraction error — verified against audited financials FY2024..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className={`w-full bg-slate-950 border ${errors.reason ? 'border-emerald-500/60' : 'border-slate-700'} rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue placeholder-slate-600 resize-none transition-colors`}
                        />
                        {errors.reason && <p className="text-xs text-emerald-400 mt-1">{errors.reason}</p>}
                        {ov.overriddenAt && (
                            <p className="text-xs text-slate-500 mt-1">
                                Last override: {new Date(ov.overriddenAt).toLocaleString('en-IN')}
                                {ov.overriddenBy ? ` by ${ov.overriddenBy}` : ''}
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-slate-800 px-6 py-4">
                    {confirmReset ? (
                        <div className="flex items-center justify-between gap-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-4 py-3">
                            <p className="text-sm text-emerald-300 font-medium">This will remove all overrides and restore extracted values. Risk score will be recalculated.</p>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => setConfirmReset(false)} disabled={resetting} className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
                                    Cancel
                                </button>
                                <button onClick={onReset} disabled={resetting} className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                    {resetting ? <><Loader2 className="h-3 w-3 animate-spin" /> Resetting...</> : 'Yes, Reset'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex gap-2">
                                {Object.keys(ov).length > 0 && (
                                    <button onClick={() => setConfirmReset(true)} className="px-3 py-2 text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 hover:bg-emerald-950/40 rounded-lg transition-colors font-semibold">
                                        Reset to Extracted Data
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <p className="text-xs text-slate-500 self-center">Values in ₹ Crores</p>
                                <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
                                    Cancel
                                </button>
                                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-brand-blue hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Apply Override'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CompanyAnalysis() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isViewer = user?.role === 'VIEWER';

    const [app, setApp] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rerunning, setRerunning] = useState(false);
    const [overrideModalOpen, setOverrideModalOpen] = useState(false);
    const [overrideSaving, setOverrideSaving] = useState(false);
    const [resetSaving, setResetSaving] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }
    const toastTimer = useRef(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4000);
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [appRes, analysisRes] = await Promise.all([
                applicationsAPI.getOne(id),
                analysisAPI.getCompanyAnalysis(id),
            ]);
            setApp(appRes.data.application);
            setAnalysis(analysisRes.data.analysis ?? analysisRes.data.companyAnalysis ?? analysisRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load company analysis data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!id) { setError('No application ID provided. Navigate from the Dashboard.'); setLoading(false); return; }
        fetchData();
    }, [id]);

    const handleRerun = async () => {
        setRerunning(true);
        try {
            await applicationsAPI.rerunAnalysis(id);
            showToast('success', 'Analysis re-run successfully! Data refreshed.');
            // Re-fetch both app and analysis to update all charts
            await fetchData();
        } catch (err) {
            const msg = err.response?.data?.error || 'Re-run failed. Please try again.';
            showToast('error', msg);
        } finally {
            setRerunning(false);
        }
    };

    const handleOverride = async (payload) => {
        setOverrideSaving(true);
        try {
            await analysisAPI.applyOverride(id, payload);
            setOverrideModalOpen(false);
            showToast('success', 'Manual override applied. Risk score recalculated.');
            await fetchData();
        } catch (err) {
            const msg = err.response?.data?.error || 'Override failed. Please try again.';
            showToast('error', msg);
        } finally {
            setOverrideSaving(false);
        }
    };

    const handleReset = async () => {
        setResetSaving(true);
        try {
            await analysisAPI.resetOverride(id);
            setOverrideModalOpen(false);
            showToast('success', 'Overrides cleared. Financial metrics restored to extracted values.');
            await fetchData();
        } catch (err) {
            const msg = err.response?.data?.error || 'Reset failed. Please try again.';
            showToast('error', msg);
        } finally {
            setResetSaving(false);
        }
    };

    // Build revenue chart data from real PDF multi-year data
    const revenueChartData = buildRevenueChart(analysis);

    // Build risk flags from real analysis data
    const riskFlags = [
        analysis?.mismatchFlag && {
            title: `Revenue mismatch detected: ${fmtPct(analysis.revenueMismatch)} deviation (GST vs Bank)`,
            severity: 'high',
            icon: FileWarning,
        },
        (analysis?.debtToEquity ?? 0) > 2 && {
            title: `High leverage: Debt-to-Equity ${fmt(analysis.debtToEquity)}x (above 2.0 threshold)`,
            severity: 'medium',
            icon: AlertTriangle,
        },
        (analysis?.currentRatio ?? 2) < 1.2 && {
            title: `Low liquidity: Current Ratio ${fmt(analysis.currentRatio)}x (below 1.2)`,
            severity: 'medium',
            icon: AlertTriangle,
        },
        ...(analysis?.riskFlags ?? []).map((f) => ({
            title: f.flag || f.description || f,
            severity: (f.severity || 'medium').toLowerCase(),
            icon: AlertTriangle,
        })),
    ].filter(Boolean);

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto pb-8">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6">
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                        <Skeleton className="h-80 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    // ── Error ──────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-slate-400 text-center max-w-md">{error}</p>
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </button>
            </div>
        );
    }

    const score = app?.aiScore ?? app?.riskScore?.compositeScore ?? null;
    const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-brand-yellow' : 'text-red-500';

    // Determine if any manual overrides are active
    const hasOverrides = analysis?.financialOverrides &&
        Object.keys(analysis.financialOverrides).length > 0;

    // Map override keys to overview item labels for OverridePill display
    const ov = analysis?.financialOverrides || {};

    const overviewItems = [
        { label: 'Annual Turnover', value: fmtCr(analysis?.revenue), subValue: analysis?.revenueGrowth != null ? `${fmtPct(analysis.revenueGrowth)} YoY` : '', overrideKey: 'revenue' },
        { label: 'EBITDA', value: fmtCr(analysis?.ebitda), subValue: analysis?.ebitdaMargin != null ? `Margin: ${fmtPct(analysis.ebitdaMargin)}` : '', overrideKey: 'ebitda' },
        { label: 'Total Debt', value: fmtCr(analysis?.totalDebt), subValue: '', overrideKey: 'totalDebt' },
        { label: 'Net Worth', value: fmtCr(analysis?.netWorth), subValue: '', overrideKey: 'netWorth' },
        { label: 'Net Profit', value: fmtCr(analysis?.netProfit), subValue: analysis?.netProfitMargin != null ? `Margin: ${fmtPct(analysis.netProfitMargin)}` : '', overrideKey: 'netProfit' },
    ];

    const ratios = [
        { name: 'Debt-to-Equity', value: analysis?.debtToEquity != null ? `${fmt(analysis.debtToEquity)}x` : '—', status: (analysis?.debtToEquity ?? 0) < 2 ? 'good' : 'warning', trend: 'down' },
        { name: 'Current Ratio', value: analysis?.currentRatio != null ? `${fmt(analysis.currentRatio)}x` : '—', status: (analysis?.currentRatio ?? 0) >= 1.2 ? 'good' : 'warning', trend: 'up' },
        { name: 'EBITDA Margin', value: analysis?.ebitdaMargin != null ? fmtPct(analysis.ebitdaMargin) : '—', status: (analysis?.ebitdaMargin ?? 0) >= 15 ? 'good' : 'warning', trend: 'up' },
        { name: 'Net Profit Margin', value: analysis?.netProfitMargin != null ? fmtPct(analysis.netProfitMargin) : '—', status: (analysis?.netProfitMargin ?? 0) >= 8 ? 'good' : 'warning', trend: 'up' },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-8">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium transition-all animate-fade-in ${toast.type === 'success'
                    ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-950 border-red-500/30 text-red-400'
                    }`}>
                    {toast.type === 'success'
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        : <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />}
                    {toast.message}
                </div>
            )}

            {/* Header Profile */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-brand-blue/5 to-transparent pointer-events-none" />

                <div className="flex items-center space-x-5 relative z-10">
                    <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="h-16 w-16 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center shadow-inner">
                        <Building2 className="h-8 w-8 text-brand-blue" />
                    </div>
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h1 className="text-2xl font-bold tracking-tight text-white">{app?.companyName ?? 'Loading...'}</h1>
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${app?.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : app?.status === 'REJECTED'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                {app?.status?.replace(/_/g, ' ') ?? '—'}
                            </span>
                            {hasOverrides && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                                    <Pencil className="h-3 w-3" /> Manual Override Active
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400 font-medium">
                            {app?.sector ?? '—'}  •  {app?.applicationNo ?? '—'}
                        </p>
                        {hasOverrides && (
                            <p className="text-xs text-amber-500/80 mt-1">Using manually adjusted values — original extracted data preserved</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center relative z-10">
                    {score !== null && (
                        <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg">
                            <p className="text-xs text-slate-500 font-medium mb-1">AI Risk Score</p>
                            <div className="flex items-baseline space-x-2">
                                <span className={`text-xl font-bold ${scoreColor}`}>{Math.round(score)}</span>
                                <span className="text-xs text-slate-400">/ 100</span>
                            </div>
                        </div>
                    )}
                    {isViewer && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <Eye className="h-3.5 w-3.5" /> Read-Only View
                        </span>
                    )}
                    <div className="flex gap-2">
                        {/* Edit Financials — hidden for VIEWER */}
                        {analysis && !isViewer && (
                            <button
                                onClick={() => setOverrideModalOpen(true)}
                                className="px-4 py-2.5 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 text-amber-300 rounded-lg transition-all text-sm font-semibold flex items-center gap-2"
                            >
                                <Pencil className="h-4 w-4" /> Edit Financials
                            </button>
                        )}
                        {/* Re-Run Analysis — hidden for VIEWER */}
                        {analysis && !isViewer && (
                            <button
                                onClick={handleRerun}
                                disabled={rerunning}
                                className="px-4 py-2.5 bg-slate-700 border border-slate-600 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-semibold flex items-center gap-2"
                            >
                                {rerunning
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Re-Running...</>
                                    : <><RefreshCw className="h-4 w-4" /> Re-Run Analysis</>}
                            </button>
                        )}
                        <button onClick={() => navigate(`/applications/${id}/ai-research`)} className="px-4 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-lg transition-all text-sm font-semibold">
                            AI Research
                        </button>
                        <button onClick={() => navigate(`/applications/${id}/risk-scoring`)} className="px-4 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-lg transition-all text-sm font-semibold">
                            Risk Engine
                        </button>
                        <button onClick={() => navigate(`/applications/${id}/cam-report`)} className="px-5 py-2.5 bg-brand-blue hover:bg-emerald-600 text-white rounded-lg transition-all text-sm font-semibold shadow-lg shadow-brand-blue/20">
                            CAM Report
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* Company Overview */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                            <Activity className="h-5 w-5 text-brand-blue" />
                            Company Overview
                        </h2>
                        {analysis === null ? (
                            <p className="text-slate-500 text-sm">No financial data yet. Upload documents and run analysis.</p>
                        ) : (
                            <div className="space-y-4">
                                {overviewItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                                        <span className="text-sm font-medium text-slate-400 flex items-center">
                                            {item.label}
                                            {item.overrideKey && ov[item.overrideKey] !== undefined && <OverridePill />}
                                        </span>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-slate-200">{item.value}</p>
                                            {item.subValue && <p className="text-xs text-brand-blue/80 font-medium">{item.subValue}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Override Audit Info */}
                    {hasOverrides && analysis?.financialOverrides?.reason && (
                        <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-5 shadow-sm">
                            <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                                <Pencil className="h-4 w-4" /> Override Audit
                            </h3>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-xs text-slate-500 font-medium mb-1">Reason</p>
                                    <p className="text-sm text-slate-200 leading-relaxed">{analysis.financialOverrides.reason}</p>
                                </div>
                                {analysis.financialOverrides.overriddenAt && (
                                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/10">
                                        <p className="text-xs text-slate-500">
                                            {new Date(analysis.financialOverrides.overriddenAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </p>
                                        {analysis.financialOverrides.overriddenBy && (
                                            <span className="text-xs text-amber-400/70 font-medium">
                                                by {analysis.financialOverrides.overriddenBy}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Risk Flags */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-brand-yellow" />
                            Intelligence Risk Flags
                        </h2>
                        {riskFlags.length === 0 ? (
                            <p className="text-slate-500 text-sm">No risk flags detected.</p>
                        ) : (
                            <div className="space-y-3">
                                {riskFlags.map((flag, idx) => {
                                    const Icon = flag.icon;
                                    return (
                                        <div key={idx} className={`flex items-start space-x-3 p-3 rounded-lg border ${severityColor(flag.severity)}`}>
                                            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-sm font-medium">{flag.title}</p>
                                                <span className="text-xs opacity-80 uppercase tracking-wider font-bold mt-1 inline-block">
                                                    Severity: {flag.severity}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Key Ratios */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {ratios.map((ratio, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                                <p className="text-xs font-medium text-slate-400 mb-2">{ratio.name}</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-2xl font-bold text-white">{ratio.value}</p>
                                    <div className={`p-1 rounded ${ratio.status === 'good' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-yellow/20 text-brand-yellow'}`}>
                                        {ratio.trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Revenue Chart */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">Revenue & EBITDA Trend (₹ Cr)</h2>
                            <div className="flex space-x-4">
                                <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-sm bg-brand-blue" />
                                    <span className="text-xs text-slate-400 font-medium">Revenue</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                                    <span className="text-xs text-slate-400 font-medium">EBITDA</span>
                                </div>
                            </div>
                        </div>
                        {revenueChartData.length === 0 ? (
                            <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
                                No multi-year revenue data available. Upload financial statements.
                            </div>
                        ) : (
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorEbitda" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="year" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => {
                                                if (v === 0) return '0';
                                                if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
                                                if (Math.abs(v) >= 1) return parseFloat(v.toFixed(1)).toString();
                                                return parseFloat(v.toPrecision(2)).toString();
                                            }}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.5rem', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                                            formatter={(value, name) => [`₹ ${parseFloat(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`, name === 'revenue' ? 'Revenue' : 'EBITDA']}
                                        />
                                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                        <Area type="monotone" dataKey="ebitda" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEbitda)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* GST vs Bank Reconciliation */}
                    {(analysis?.gstRevenue || analysis?.bankRevenue) && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm overflow-hidden relative">
                            <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-brand-blue" />
                                GST vs Bank Reconciliation
                                {analysis?.mismatchFlag && (
                                    <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">MISMATCH</span>
                                )}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                                <div className="p-4 flex flex-col items-center">
                                    <p className="text-sm font-medium text-slate-400 mb-1">GST Revenue</p>
                                    <p className="text-xl font-bold text-slate-200">{fmtCr(analysis?.gstRevenue)}</p>
                                </div>
                                <div className="p-4 flex flex-col items-center">
                                    <p className="text-sm font-medium text-slate-400 mb-1">Bank Inflows</p>
                                    <p className="text-xl font-bold text-slate-200">{fmtCr(analysis?.bankRevenue)}</p>
                                </div>
                                <div className="p-4 flex flex-col items-center">
                                    <p className="text-sm font-medium text-slate-400 mb-1">Deviation</p>
                                    <p className={`text-xl font-bold ${analysis?.mismatchFlag ? 'text-emerald-400' : 'text-emerald-400'}`}>
                                        {fmtPct(analysis?.revenueMismatch)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Financials Modal */}
            {overrideModalOpen && analysis && (
                <EditFinancialsModal
                    analysis={analysis}
                    onClose={() => setOverrideModalOpen(false)}
                    onSave={handleOverride}
                    saving={overrideSaving}
                    onReset={handleReset}
                    resetting={resetSaving}
                />
            )}
        </div>
    );
}
