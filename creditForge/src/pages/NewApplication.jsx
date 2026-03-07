import { useState, useRef, useEffect } from 'react';
import {
    Upload, FileText, CheckCircle, Circle, ArrowRight,
    Loader2, Sparkles, Building2, AlertCircle, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { applicationsAPI } from '../services/api';

const DOCUMENT_TYPES = [
    { label: 'Financial Statements (PDF)', type: 'FINANCIAL_STATEMENT', desc: 'Audited P&L and Balance Sheet', accept: '.pdf', req: true },
    { label: 'GST Data (CSV)', type: 'GST_RETURN', desc: 'Last 12 months GSTR-3B', accept: '.csv,.pdf', req: true },
    { label: 'Bank Statements (PDF)', type: 'BANK_STATEMENT', desc: '6 months primary account', accept: '.pdf', req: true },
    { label: 'ITR Filing (PDF)', type: 'ITR', desc: 'Latest assessment year', accept: '.pdf', req: false },
];

const PIPELINE_STEPS = [
    { name: 'Extracting Financials', description: 'Parsing P&L and Balance Sheet from PDF' },
    { name: 'Running Research Agent', description: 'Checking real-time news & secondary intelligence' },
    { name: 'Calculating Risk Score', description: 'Evaluating financial indicators & sector weights' },
    { name: 'Generating CAM Report', description: 'Drafting Credit Assessment Memo' },
];

export default function NewApplication() {
    const navigate = useNavigate();

    // ── Form State ─────────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        companyName: '',
        pan: '',
        gstin: '',
        cin: '',
        loanAmount: '',
        loanPurpose: '',
        sector: '',
    });
    const [customSector, setCustomSector] = useState('');
    const [files, setFiles] = useState({}); // { [type]: File }
    const fileRefs = useRef({});

    // ── Pipeline State ─────────────────────────────────────────────────────────
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeStep, setActiveStep] = useState(-1);
    const [isComplete, setIsComplete] = useState(false);
    const [createdAppId, setCreatedAppId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => { return () => setIsProcessing(false); }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileSelect = (type, file) => {
        if (!file) return;
        setFiles((prev) => ({ ...prev, [type]: file }));
    };

    const handleRunAnalysis = async () => {
        // Basic form validation
        if (!form.companyName || !form.pan || !form.loanAmount || !form.loanPurpose || !form.sector) {
            setError('Please fill in all required fields: Company Name, PAN, Loan Amount, Purpose, and Sector.');
            return;
        }

        if (form.sector === 'Other' && !customSector.trim()) {
            setError('Please specify the sector.');
            return;
        }

        const requiredTypes = DOCUMENT_TYPES.filter((d) => d.req).map((d) => d.type);
        const missingDocs = requiredTypes.filter((t) => !files[t]);
        if (missingDocs.length > 0) {
            setError(`Please upload all required documents: ${missingDocs.map((t) => DOCUMENT_TYPES.find((d) => d.type === t)?.label).join(', ')}`);
            return;
        }

        setError(null);
        setIsProcessing(true);
        setActiveStep(0);

        try {
            // Step 1: Create application
            // loanAmount field is in Crores (UI label says "₹ in Cr")
            // Backend validates min: 100000 (raw rupees), so convert Cr → ₹
            const loanAmountInRupees = parseFloat(form.loanAmount) * 10_000_000;
            const createRes = await applicationsAPI.create({
                companyName: form.companyName,
                pan: form.pan.toUpperCase().trim(),
                gstin: form.gstin || undefined,
                cin: form.cin || undefined,
                loanAmount: loanAmountInRupees,
                loanPurpose: form.loanPurpose,
                sector: form.sector === 'Other' ? customSector.trim() : form.sector,
            });
            const appId = createRes.data.application.id;
            setCreatedAppId(appId);

            // Step 1 done → Step 2: Upload all documents
            for (const [type, file] of Object.entries(files)) {
                const formData = new FormData();
                formData.append('documents', file);
                formData.append('documentType', type);
                await applicationsAPI.uploadDocuments(appId, formData);
            }
            setActiveStep(1);

            // Step 2 done → Step 3: Analyze (research + risk)
            await applicationsAPI.analyze(appId);
            setActiveStep(2);

            // Step 3 done → Step 4: CAM is generated inside analyze pipeline
            setActiveStep(3);
            await new Promise((r) => setTimeout(r, 600)); // brief visual pause

            setActiveStep(4);
            setIsComplete(true);
        } catch (err) {
            console.error('[NewApplication] pipeline error:', err);
            setError(err.response?.data?.error || `Analysis failed: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const SECTORS = [
        'Technology', 'Healthcare', 'FMCG', 'Manufacturing', 'Services',
        'Retail', 'Real Estate', 'Construction', 'Textiles', 'Metals', 'Aviation', 'Hospitality', 'Other'
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-brand-blue" />
                    New Credit Application
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                    Fill in company details and upload required documents to initiate AI-powered analysis.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left — Forms */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Error Banner */}
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-400">{error}</p>
                            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Company Details */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-white mb-6">Company Details</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { name: 'companyName', label: 'Company Name *', placeholder: 'NovaTech Industries Ltd.' },
                                { name: 'pan', label: 'PAN *', placeholder: 'AAACP1234C' },
                                { name: 'gstin', label: 'GSTIN', placeholder: '27AAACP1234C1ZV' },
                                { name: 'cin', label: 'CIN', placeholder: 'U72200MH2008PTC123456' },
                                { name: 'loanAmount', label: 'Loan Amount (₹ in Cr) *', placeholder: '5.2', type: 'number' },
                                { name: 'loanPurpose', label: 'Loan Purpose *', placeholder: 'Capacity expansion' },
                            ].map((field) => (
                                <div key={field.name}>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">{field.label}</label>
                                    <input
                                        name={field.name}
                                        type={field.type || 'text'}
                                        value={form[field.name]}
                                        onChange={handleFormChange}
                                        placeholder={field.placeholder}
                                        disabled={isProcessing}
                                        className="block w-full rounded-lg border-0 bg-slate-950/80 py-2.5 px-4 text-white shadow-inner ring-1 ring-inset ring-slate-800 placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-brand-blue sm:text-sm transition-all disabled:opacity-50"
                                    />
                                </div>
                            ))}

                            {/* Sector dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Sector *</label>
                                <select
                                    name="sector"
                                    value={form.sector}
                                    onChange={handleFormChange}
                                    disabled={isProcessing}
                                    className="block w-full rounded-lg border-0 bg-slate-950/80 py-2.5 px-4 text-white shadow-inner ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-brand-blue sm:text-sm transition-all disabled:opacity-50"
                                >
                                    <option value="">Select sector…</option>
                                    {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>

                                {/* Custom Sector Input - Moved here to be directly under the dropdown */}
                                {form.sector === 'Other' && (
                                    <div className="mt-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Specify Sector *</label>
                                        <input
                                            type="text"
                                            value={customSector}
                                            onChange={(e) => setCustomSector(e.target.value)}
                                            placeholder="e.g. Space Exploration"
                                            disabled={isProcessing}
                                            className="block w-full rounded-lg border-0 bg-slate-950/80 py-2.5 px-4 text-white shadow-inner ring-1 ring-inset ring-slate-800 placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-brand-blue sm:text-sm transition-all disabled:opacity-50"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Document Uploads */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-blue/30 to-transparent" />
                        <h2 className="text-lg font-semibold text-white mb-6">Document Uploads</h2>
                        <div className="space-y-4">
                            {DOCUMENT_TYPES.map((doc) => (
                                <div
                                    key={doc.type}
                                    className="flex items-center justify-between p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 transition-all duration-300 group cursor-pointer border-dashed"
                                    onClick={() => !isProcessing && fileRefs.current[doc.type]?.click()}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-2.5 rounded-lg transition-all border ${files[doc.type]
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            : 'bg-slate-950 text-slate-400 border-slate-800 group-hover:bg-brand-blue/20 group-hover:text-brand-blue group-hover:border-brand-blue/30'
                                            }`}>
                                            {files[doc.type] ? <CheckCircle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{doc.label}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {files[doc.type]
                                                    ? <span className="text-emerald-400">{files[doc.type].name}</span>
                                                    : <>{doc.desc} • <span className={doc.req ? 'text-brand-yellow/80' : 'text-slate-500'}>{doc.req ? 'Required' : 'Optional'}</span></>
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs font-medium text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity">
                                            {files[doc.type] ? 'Replace' : 'Browse'}
                                        </span>
                                        <Upload className="h-4 w-4 text-slate-500 group-hover:text-brand-blue transition-colors" />
                                    </div>
                                    <input
                                        ref={(el) => (fileRefs.current[doc.type] = el)}
                                        type="file"
                                        accept={doc.accept}
                                        className="hidden"
                                        onChange={(e) => handleFileSelect(doc.type, e.target.files[0])}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right — Pipeline Status */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm sticky top-8">
                        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-brand-blue" />
                            AI Execution Engine
                        </h2>
                        <p className="text-xs text-slate-400 mb-6">Real-time pipeline connected to backend</p>

                        <button
                            onClick={handleRunAnalysis}
                            disabled={isProcessing || isComplete}
                            className="w-full mb-8 flex items-center justify-center space-x-2 rounded-xl bg-brand-blue hover:bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Processing…</span>
                                </>
                            ) : isComplete ? (
                                <>
                                    <CheckCircle className="h-5 w-5 text-white" />
                                    <span>Analysis Complete</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    <span>Execute Analysis</span>
                                </>
                            )}
                        </button>

                        <div className="space-y-6 pl-2">
                            {PIPELINE_STEPS.map((step, idx) => {
                                const isActive = activeStep === idx;
                                const isCompleted = activeStep > idx;

                                return (
                                    <div key={idx} className="relative flex space-x-4">
                                        {idx !== PIPELINE_STEPS.length - 1 && (
                                            <div className={`absolute top-6 left-[11px] -bottom-6 w-px ${isCompleted ? 'bg-brand-blue' : 'bg-slate-800'}`} />
                                        )}
                                        <div className="relative flex-none mt-1 z-10">
                                            {isCompleted ? (
                                                <CheckCircle className="h-6 w-6 text-brand-blue bg-slate-900 rounded-full" />
                                            ) : isActive && isProcessing ? (
                                                <div className="h-6 w-6 bg-slate-900 rounded-full flex items-center justify-center">
                                                    <Loader2 className="h-5 w-5 text-brand-yellow animate-spin" />
                                                </div>
                                            ) : (
                                                <Circle className="h-6 w-6 text-slate-700 bg-slate-900 rounded-full" />
                                            )}
                                        </div>
                                        <div className="flex-1 pb-2">
                                            <p className={`text-sm font-semibold transition-colors ${isActive || isCompleted ? 'text-white' : 'text-slate-500'}`}>
                                                {step.name}
                                            </p>
                                            <p className={`text-xs mt-1 transition-colors ${isActive && isProcessing ? 'text-brand-yellow font-medium' : 'text-slate-500'}`}>
                                                {step.description}
                                            </p>
                                            {isActive && isProcessing && (
                                                <div className="mt-3 w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-brand-yellow/80 h-full rounded-full animate-pulse w-full" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Completion Card */}
                        {isComplete && createdAppId && (
                            <div className="mt-8 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col items-center text-center space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <CheckCircle className="h-10 w-10 text-emerald-500 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <div>
                                    <h3 className="text-sm font-bold text-emerald-400">Analysis Complete</h3>
                                    <p className="text-xs text-emerald-500/70 mt-1">All data saved to database.</p>
                                </div>
                                <button
                                    onClick={() => navigate(`/applications/${createdAppId}/company-analysis`)}
                                    className="flex items-center space-x-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 px-5 py-2.5 rounded-lg transition-all w-full justify-center mt-2 group"
                                >
                                    <span>View Company Analysis</span>
                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
