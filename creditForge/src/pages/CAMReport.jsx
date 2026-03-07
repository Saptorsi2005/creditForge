import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FileText, Download, Printer, CheckCircle, XCircle,
    AlertTriangle, Briefcase, Building, AlertCircle, ArrowLeft, Loader2
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
    return `₹ ${fmt(v)} Cr`;
}

export default function CAMReport() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [cam, setCam] = useState(null);
    const [app, setApp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloading, setDownloading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) { setError('No application ID provided. Navigate from the Dashboard.'); setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const camRes = await analysisAPI.getCAMReport(id);
            const camData = camRes.data.camReport ?? camRes.data;
            setCam(camData);
            // Application data is often embedded in the response
            setApp(camData.application ?? camRes.data.application ?? null);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load CAM report. Run analysis first.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDownloadPDF = async () => {
        if (!id) return;
        setDownloading(true);
        try {
            const res = await analysisAPI.downloadCAMPDF(id);
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `CAM_Report_${app?.applicationNo ?? id}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to download PDF: ' + (err.response?.data?.error || err.message));
        } finally {
            setDownloading(false);
        }
    };

    const handlePrint = () => window.print();

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-10">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-[600px] w-full" />
            </div>
        );
    }

    // ── Error ──────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <AlertCircle className="h-12 w-12 text-emerald-400" />
                <p className="text-slate-400 text-center max-w-md">{error}</p>
                <button onClick={() => navigate(`/applications/${id}/risk-scoring`)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">
                    <ArrowLeft className="h-4 w-4" /> Risk Score
                </button>
            </div>
        );
    }

    // Extract key fields from cam with safe fallbacks
    const companyName = cam?.companyName ?? app?.companyName ?? '—';
    const appNo = cam?.applicationNo ?? app?.applicationNo ?? id;
    const loanAmount = cam?.loanAmount ?? app?.loanAmount ?? null;
    const loanPurpose = cam?.loanPurpose ?? app?.loanPurpose ?? '—';
    const sector = cam?.sector ?? app?.sector ?? '—';
    const aiScore = cam?.compositeScore ?? cam?.aiScore ?? null;
    const riskLevel = cam?.riskLevel ?? '—';
    const recommendation = cam?.recommendation ?? '—';
    const executiveSummary = cam?.executiveSummary ?? '';
    const strengths = cam?.strengths ?? [];
    const weaknesses = cam?.weaknesses ?? cam?.risks ?? [];
    const financials = cam?.financialSummary ?? cam?.keyFinancials ?? {};
    const generatedAt = cam?.generatedAt ? new Date(cam.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN');

    const recBgColor = recommendation === 'APPROVE' ? 'bg-emerald-600' : recommendation === 'REJECT' ? 'bg-emerald-600' : 'bg-brand-yellow';

    const scoreColor = aiScore >= 80 ? 'text-emerald-700' : aiScore >= 60 ? 'text-amber-700' : 'text-emerald-700';

    // Build financial table rows
    const finRows = [
        { label: 'Revenue', fy22: financials?.fy22?.revenue, fy23: financials?.fy23?.revenue, fy24: financials?.fy24?.revenue ?? cam?.revenue },
        { label: 'EBITDA', fy22: financials?.fy22?.ebitda, fy23: financials?.fy23?.ebitda, fy24: financials?.fy24?.ebitda ?? cam?.ebitda },
        { label: 'Net Worth', fy22: financials?.fy22?.netWorth, fy23: financials?.fy23?.netWorth, fy24: financials?.fy24?.netWorth ?? cam?.netWorth },
        { label: 'Total Debt', fy22: financials?.fy22?.totalDebt, fy23: financials?.fy23?.totalDebt, fy24: financials?.fy24?.totalDebt ?? cam?.totalDebt },
    ].filter((r) => r.fy22 || r.fy23 || r.fy24);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <button onClick={() => navigate(`/applications/${id}/risk-scoring`)} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-inner">
                        <FileText className="h-6 w-6 text-brand-blue" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Credit Assessment Memo</h1>
                        <p className="text-sm text-slate-400 mt-1">AI-generated comprehensive credit report.</p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors text-sm font-medium flex items-center space-x-2"
                    >
                        <Printer className="h-4 w-4" />
                        <span>Print</span>
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={downloading}
                        className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium shadow-lg shadow-brand-blue/20 flex items-center space-x-2 disabled:opacity-60"
                    >
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        <span>{downloading ? 'Generating…' : 'Download CAM as PDF'}</span>
                    </button>
                </div>
            </div>

            {/* CAM Document */}
            <div className="bg-slate-200 text-slate-900 rounded-sm shadow-2xl overflow-hidden font-serif leading-relaxed" id="cam-print-area">
                {/* Header */}
                <div className="border-b-4 border-slate-900 p-8 sm:p-12 bg-white">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                                <Building className="h-8 w-8 text-slate-800" />
                                CreditForge AI
                            </h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Secure AI Credit Platform</p>
                        </div>
                        <div className="text-right text-sm">
                            <p><span className="font-bold">Date:</span> {generatedAt}</p>
                            <p><span className="font-bold">App ID:</span> {appNo}</p>
                            <p><span className="font-bold">Analyst:</span> CreditForge AI Engine</p>
                        </div>
                    </div>

                    {/* Entity Summary */}
                    <div className="bg-slate-100 p-6 rounded border border-slate-300">
                        <h3 className="text-xl font-bold mb-2">Target Entity: {companyName}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                            <div>
                                <p className="text-slate-500 font-bold text-xs uppercase">Requested Amt</p>
                                <p className="font-semibold text-lg">{fmtCr(loanAmount)}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-bold text-xs uppercase">Sector</p>
                                <p className="font-semibold text-lg">{sector}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-bold text-xs uppercase">Loan Purpose</p>
                                <p className="font-semibold text-lg">{loanPurpose}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 font-bold text-xs uppercase">AI Risk Score</p>
                                <p className={`font-bold text-lg ${scoreColor}`}>
                                    {aiScore != null ? `${fmt(aiScore)}/100 (${riskLevel})` : '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 sm:p-12 space-y-10 bg-white">
                    {/* Executive Summary */}
                    <section>
                        <h4 className="text-lg font-black uppercase border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
                            <Briefcase className="h-5 w-5" /> Executive Summary
                        </h4>
                        {executiveSummary ? (
                            <p className="text-justify text-slate-800">{executiveSummary}</p>
                        ) : (
                            <p className="text-slate-500 italic text-sm">Executive summary not generated. Run analysis to generate.</p>
                        )}
                    </section>

                    {/* Financial Assessment */}
                    {finRows.length > 0 && (
                        <section>
                            <h4 className="text-lg font-black uppercase border-b-2 border-slate-900 pb-2 mb-4">Financial Assessment</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse border border-slate-300">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="border border-slate-300 p-2 font-bold">Metric (₹ Cr)</th>
                                            <th className="border border-slate-300 p-2 font-bold">FY22</th>
                                            <th className="border border-slate-300 p-2 font-bold">FY23</th>
                                            <th className="border border-slate-300 p-2 font-bold">FY24</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {finRows.map((row, i) => (
                                            <tr key={i}>
                                                <td className="border border-slate-300 p-2 font-medium">{row.label}</td>
                                                <td className="border border-slate-300 p-2">{row.fy22 != null ? fmt(row.fy22) : '—'}</td>
                                                <td className="border border-slate-300 p-2">{row.fy23 != null ? fmt(row.fy23) : '—'}</td>
                                                <td className="border border-slate-300 p-2 font-bold">{row.fy24 != null ? fmt(row.fy24) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* Strengths & Risks */}
                    {(strengths.length > 0 || weaknesses.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {strengths.length > 0 && (
                                <section>
                                    <h4 className="text-lg font-black uppercase border-b-2 border-emerald-700 text-emerald-900 pb-2 mb-4 flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-emerald-600" /> Key Strengths
                                    </h4>
                                    <ul className="space-y-3 text-sm text-slate-800">
                                        {strengths.map((s, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="text-emerald-600 font-bold shrink-0">+</span>
                                                {typeof s === 'string' ? s : s.text ?? JSON.stringify(s)}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            {weaknesses.length > 0 && (
                                <section>
                                    <h4 className="text-lg font-black uppercase border-b-2 border-emerald-800 text-emerald-900 pb-2 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-emerald-600" /> Key Risks
                                    </h4>
                                    <ul className="space-y-3 text-sm text-slate-800">
                                        {weaknesses.map((w, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="text-emerald-600 font-bold shrink-0">−</span>
                                                {typeof w === 'string' ? w : w.text ?? JSON.stringify(w)}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </div>
                    )}

                    {/* Final Recommendation */}
                    <section className="bg-slate-100 p-6 rounded border border-slate-300">
                        <h4 className="text-lg font-black uppercase border-b-2 border-slate-400 pb-2 mb-4">Final Recommendation</h4>
                        <div className="flex items-start gap-4">
                            <div className={`${recBgColor} text-white px-4 py-2 font-black rounded text-xl uppercase tracking-widest shrink-0`}>
                                {recommendation}
                            </div>
                            <p className="text-slate-800 leading-relaxed font-medium">
                                {cam?.recommendationReason
                                    ? cam.recommendationReason
                                    : `Based on the comprehensive AI assessment with a composite score of ${aiScore != null ? fmt(aiScore) : '—'}/100 (${riskLevel} risk), the credit facility of ${fmtCr(loanAmount)} is recommended for ${recommendation}.`}
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
