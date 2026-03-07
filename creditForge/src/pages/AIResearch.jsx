import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Search, AlertTriangle, Scale, Users, Newspaper,
    ExternalLink, ShieldAlert, CheckCircle2, AlertCircle, ArrowLeft
} from 'lucide-react';
import { analysisAPI } from '../services/api';

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

// Highlight risk words marked with [risk]...[/risk] in text, or just render plain text
const HighlightRiskWords = ({ text = '' }) => {
    const parts = String(text).split(/(<risk>.*?<\/risk>)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('<risk>') && part.endsWith('</risk>')) {
                    const word = part.replace(/<\/?risk>/g, '');
                    return (
                        <span key={i} className="bg-red-500/20 text-red-400 font-bold px-1 rounded border border-red-500/30">
                            {word}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
};

// Strip HTML tags and decode HTML entities from RSS feed descriptions
const stripHtml = (html = '') => {
    if (!html) return '';
    return html
        .replace(/&lt;[^&]*&gt;/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
};

function SentimentBadge({ label, score }) {
    const color = label === 'POSITIVE'
        ? 'bg-emerald-500/20 text-emerald-400'
        : label === 'NEGATIVE'
            ? 'bg-red-500/20 text-red-500'
            : 'bg-slate-700 text-slate-300';
    return (
        <span className={`px-2 py-1 text-xs font-bold rounded ${color}`}>
            {label}{score !== undefined && score !== null ? ` (${Number(score).toFixed(2)})` : ''}
        </span>
    );
}

export default function AIResearch() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [research, setResearch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) { setError('No application ID provided. Navigate from the Dashboard.'); setLoading(false); return; }

        const fetchResearch = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await analysisAPI.getAIResearch(id);
                setResearch(res.data.research ?? res.data.aiResearch ?? res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load AI research data.');
            } finally {
                setLoading(false);
            }
        };

        fetchResearch();
    }, [id]);

    const litigations = research?.litigationDetails ?? [];
    const regulatory = research?.regulatoryDetails ?? [];
    const directorItems = research?.directorDetails ?? [];
    const newsItems = research?.newsDetails ?? [];
    const allArticles = research?.allArticles ?? [];
    const displayArticles = allArticles.length > 0 ? allArticles : newsItems;
    const redFlags = research?.redFlags ?? [];
    const totalRisk = (research?.litigationCount ?? 0) + (research?.regulatoryIssues ?? 0) + (research?.negativeNews ?? 0);
    const sentiment = research?.overallSentiment ?? 'NEUTRAL';
    const sentimentScore = research?.sentimentScore;

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto pb-10">
                <Skeleton className="h-16 w-full" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    // ── Error ──────────────────────────────────────────────────────────────────
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

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                    <button onClick={() => navigate(`/applications/${id}/company-analysis`)} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-inner">
                        <Search className="h-6 w-6 text-brand-blue" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Secondary Intelligence</h1>
                        <p className="text-sm text-slate-400 mt-1">Real-time news, regulatory, and judicial intelligence results.</p>
                    </div>
                </div>

                {/* Risk summary badge */}
                <div className={`px-4 py-2 border rounded-lg flex items-center space-x-2 ${totalRisk > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                    <ShieldAlert className={`h-5 w-5 ${totalRisk > 0 ? 'text-red-500' : 'text-emerald-400'}`} />
                    <span className={`text-sm border-r pr-3 mr-1 font-bold ${totalRisk > 0 ? 'text-red-500 border-red-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                        {totalRisk > 0 ? 'Risk Signals Found' : 'No Risk Found'}
                    </span>
                    <span className="text-sm font-medium text-slate-300">
                        {totalRisk} Issue{totalRisk !== 1 ? 's' : ''} Detected
                    </span>
                </div>
            </div>

            {/* Executive Summary */}
            {research?.executiveSummary && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <p className="text-sm text-slate-300 leading-relaxed">{research.executiveSummary}</p>
                </div>
            )}

            {/* Red Flags */}
            {redFlags.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Critical Red Flags
                    </h2>
                    {redFlags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${flag.severity === 'CRITICAL' ? 'text-red-500' : 'text-brand-yellow'}`} />
                            <div>
                                <p className="text-sm font-semibold text-white">{flag.flag}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{flag.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Col */}
                <div className="space-y-6">
                    {/* NLP Sentiment & News Coverage */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-[50px] pointer-events-none" />
                        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 relative z-10">
                            <Newspaper className="h-5 w-5 text-brand-blue" />
                            News Coverage
                            {displayArticles.length > 0 && (
                                <span className="ml-2 text-xs font-bold bg-brand-blue/20 text-brand-blue px-2 py-0.5 rounded-full">
                                    {displayArticles.length} articles
                                </span>
                            )}
                        </h2>

                        {displayArticles.length === 0 ? (
                            <p className="text-slate-500 text-sm relative z-10">No news articles found. Try re-running analysis.</p>
                        ) : (
                            <div className="space-y-3 relative z-10 max-h-96 overflow-y-auto pr-1">
                                {displayArticles.map((article, idx) => {
                                    const text = ((article.title || article.headline || '') + ' ' + (article.description || article.summary || '')).toLowerCase();
                                    const isNeg = ['fraud', 'default', 'loss', 'penalty', 'raid', 'ed ', 'nclt', 'lawsuit', 'bankrupt', 'scam', 'npa'].some(w => text.includes(w));
                                    const isPos = ['profit', 'growth', 'award', 'expansion', 'record', 'win', 'strong', 'upgrade'].some(w => text.includes(w));
                                    const border = isNeg ? 'border-red-500/30 bg-red-500/5' : isPos ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-800/30';
                                    const dot = isNeg ? 'bg-red-500' : isPos ? 'bg-emerald-400' : 'bg-slate-500';

                                    // Tag-based relevance styling
                                    const tagLabel = article.tag === 'DIRECT' ? 'Direct Match' : article.tag === 'RELATED' ? 'Related' : article.tag === 'INDUSTRY' ? 'Industry Context' : null;
                                    const tagColor = article.tag === 'DIRECT' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                        article.tag === 'RELATED' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                            'bg-slate-700/50 text-slate-400 border-slate-600/50';

                                    return (
                                        <div key={idx} className={`p-3.5 rounded-xl border ${border} hover:opacity-90 transition-opacity`}>
                                            <div className="flex items-start gap-2.5">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dot}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-col gap-1">
                                                            <p className="text-sm text-slate-200 font-medium leading-snug">
                                                                {article.title || article.headline}
                                                            </p>
                                                            {tagLabel && (
                                                                <span className={`inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${tagColor}`}>
                                                                    {tagLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(article.url) && (
                                                            <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                                className="text-brand-blue hover:text-emerald-400 shrink-0 mt-0.5">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {article.source} {article.publishedAt || article.date ? '• ' + new Date(article.publishedAt || article.date).toLocaleDateString('en-IN') : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                            <p className="text-xs text-slate-500 font-medium">
                                Sources: {(research?.sources ?? []).slice(0, 5).join(', ') || 'Google News / Indian Finance RSS'}
                            </p>
                            <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-slate-400">Sentiment:</span>
                                <SentimentBadge label={sentiment} score={sentimentScore} />
                            </div>
                        </div>
                    </div>

                    {/* Litigation */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                            <Scale className="h-5 w-5 text-brand-blue" />
                            Litigation & Judicial Records
                        </h2>
                        {litigations.length === 0 ? (
                            <p className="text-slate-500 text-sm">No litigation records found.</p>
                        ) : (
                            <div className="space-y-4">
                                {litigations.map((item, idx) => (
                                    <div key={idx} className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/20 relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-yellow rounded-l-xl" />
                                        <div className="flex justify-between items-center mb-3 pl-2">
                                            <span className="text-xs font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-700">
                                                {item.type || 'Legal'}
                                            </span>
                                            <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-brand-yellow border border-slate-700">
                                                {item.status || 'Reported'}
                                            </span>
                                        </div>
                                        <div className="pl-2 min-w-0 overflow-hidden">
                                            <p className="text-xs text-slate-400 font-medium mb-1 break-words">
                                                {item.headline}
                                            </p>
                                            <p className="text-sm text-slate-200 leading-relaxed break-words line-clamp-3">
                                                {stripHtml(item.description)}
                                            </p>
                                            {item.url && (
                                                <a href={item.url} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs text-brand-blue hover:underline mt-2 inline-flex items-center gap-1">
                                                    Source <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Col */}
                <div className="space-y-6">
                    {/* Director Issues */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                            <Users className="h-5 w-5 text-brand-blue" />
                            Director / Promoter Intelligence
                        </h2>

                        {directorItems.length === 0 ? (
                            <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-300">No director-related concerns found in public sources.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {directorItems.map((item, idx) => (
                                    <div key={idx} className="border border-slate-800 rounded-xl overflow-hidden">
                                        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800">
                                            <p className="text-sm font-semibold text-white">{item.headline || 'Director Concern'}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{item.source}</p>
                                        </div>
                                        <div className="p-4 bg-slate-800/10">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                                                <p className="text-sm text-slate-200">{stripHtml(item.details || item.description)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Regulatory Issues */}
                    {regulatory.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-brand-yellow" />
                                Regulatory Concerns ({regulatory.length})
                            </h2>
                            <div className="space-y-4">
                                {regulatory.map((item, idx) => (
                                    <div key={idx} className="p-5 rounded-xl border border-slate-700/50 bg-slate-800/20 relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-yellow rounded-l-xl" />
                                        <div className="flex justify-between items-center mb-3 pl-2">
                                            <span className="text-xs font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-700">
                                                {item.type || 'Regulatory'}
                                            </span>
                                            <span className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-brand-yellow border border-slate-700">
                                                {item.status || 'Active'}
                                            </span>
                                        </div>
                                        <div className="pl-2 min-w-0 overflow-hidden">
                                            <p className="text-xs text-slate-400 font-medium mb-1 break-words">
                                                {item.headline}
                                            </p>
                                            <p className="text-sm text-slate-200 leading-relaxed break-words line-clamp-3">
                                                {stripHtml(item.description)}
                                            </p>
                                            {item.url && (
                                                <a href={item.url} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs text-brand-blue hover:underline mt-2 inline-flex items-center gap-1">
                                                    Source <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risk keyword summary */}
                    {(research?.riskKeywords ?? []).length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-emerald-400" />
                                Risk Keyword Signals
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {research.riskKeywords.slice(0, 20).map((kw, i) => (
                                    <span key={i} className={`text-xs px-2 py-1 rounded border font-medium ${kw.severity === 'CRITICAL' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' :
                                        kw.severity === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            kw.severity === 'MEDIUM' ? 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20' :
                                                'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                        {kw.keyword} ×{kw.count}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
