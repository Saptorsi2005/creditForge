import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sliders, Calculator, PieChart, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { settingsAPI } from '../services/api';

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [message, setMessage] = useState(null);

    // Settings state
    const [autoApprovalScore, setAutoApprovalScore] = useState(75);
    const [baseLendingRate, setBaseLendingRate] = useState(8.5);
    const [maxRiskPremiumCap, setMaxRiskPremiumCap] = useState(3.0);

    // Risk scoring weights (not shown in UI but required by backend)
    const [weights, setWeights] = useState({
        revenueWeight: 0.25,
        debtWeight: 0.20,
        litigationWeight: 0.20,
        promoterWeight: 0.15,
        sectorWeight: 0.20,
    });

    const [sectorMultipliers, setSectorMultipliers] = useState({
        'Manufacturing': 1.2,
        'IT Services': 0.8,
        'Real Estate': 1.8,
        'Healthcare': 0.9,
        'Retail': 1.1,
    });

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await settingsAPI.get();
            const settings = response.data.settings;

            if (settings) {
                setAutoApprovalScore(settings.autoApprovalScore || 75);
                setBaseLendingRate(settings.baseLendingRate || 8.5);
                setMaxRiskPremiumCap(settings.maxRiskPremiumCap || 3.0);

                // Load risk scoring weights
                setWeights({
                    revenueWeight: settings.revenueWeight || 0.25,
                    debtWeight: settings.debtWeight || 0.20,
                    litigationWeight: settings.litigationWeight || 0.20,
                    promoterWeight: settings.promoterWeight || 0.15,
                    sectorWeight: settings.sectorWeight || 0.20,
                });

                // Load sector multipliers
                if (settings.sectorRiskConfig) {
                    const config = settings.sectorRiskConfig;
                    setSectorMultipliers({
                        'Manufacturing': config['Manufacturing'] || 1.2,
                        'IT Services': config['IT Services'] || 0.8,
                        'Real Estate': config['Real Estate'] || 1.8,
                        'Healthcare': config['Healthcare'] || 0.9,
                        'Retail': config['Retail'] || 1.1,
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            showMessage('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Prepare sector risk config with all sectors
            const sectorRiskConfig = {
                'Manufacturing': sectorMultipliers['Manufacturing'],
                'IT Services': sectorMultipliers['IT Services'],
                'Real Estate': sectorMultipliers['Real Estate'],
                'Healthcare': sectorMultipliers['Healthcare'],
                'Retail': sectorMultipliers['Retail'],
                'Technology': 0.85,
                'FMCG': 0.8,
                ...weights,  // Include all risk scoring weights
                'Services': 1.0,
                'Construction': 1.3,
                'Textiles': 1.1,
                'Metals': 1.2,
                'Aviation': 1.5,
                'Hospitality': 1.3,
            };

            await settingsAPI.update({
                autoApprovalScore,
                baseLendingRate,
                maxRiskPremiumCap,
                sectorRiskConfig,
            });

            showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            showMessage(error.response?.data?.error || 'Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Are you sure you want to reset all settings to default values?')) {
            return;
        }

        try {
            setResetting(true);
            await settingsAPI.reset();
            await loadSettings(); // Reload settings after reset
            showMessage('Settings reset to defaults successfully!', 'success');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            showMessage(error.response?.data?.error || 'Failed to reset settings', 'error');
        } finally {
            setResetting(false);
        }
    };

    const showMessage = (text, type) => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 5000);
    };

    const updateSectorMultiplier = (sector, value) => {
        setSectorMultipliers(prev => ({
            ...prev,
            [sector]: value,
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-white">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Success/Error Message */}
            {message && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                    <span>{message.text}</span>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-inner">
                        <SettingsIcon className="h-6 w-6 text-brand-blue" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Model Configuration</h1>
                        <p className="text-sm text-slate-400 mt-1">Adjust AI engine parameters, thresholds, and sector weightings.</p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={handleReset}
                        disabled={resetting || saving}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors text-sm font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
                        <span>{resetting ? 'Resetting...' : 'Reset Defaults'}</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || resetting}
                        className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium shadow-lg shadow-brand-blue/20 flex items-center space-x-2 relative group overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                        <Save className="h-4 w-4 relative z-10" />
                        <span className="relative z-10">{saving ? 'Saving...' : 'Save Configuration'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Col - Thresholds & Formula */}
                <div className="space-y-8">

                    {/* Risk Thresholds */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <Sliders className="h-5 w-5 text-brand-blue" />
                            Global Risk Thresholds
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label htmlFor="auto-approve" className="text-sm font-medium text-slate-300">
                                        Auto-Approval Minimum Score (Out of 100)
                                    </label>
                                    <span className="px-3 py-1 bg-slate-950 border border-slate-700 rounded-md text-emerald-400 font-bold text-sm">
                                        {autoApprovalScore}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    id="auto-approve"
                                    min="50"
                                    max="95"
                                    step="1"
                                    value={autoApprovalScore}
                                    onChange={(e) => setAutoApprovalScore(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                                    <span>Lenient (50)</span>
                                    <span>Strict (95)</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <p className="text-sm text-slate-300 font-medium mb-3">Score Classification Bands</p>
                                <div className="w-full h-8 flex rounded-lg overflow-hidden border border-slate-700 text-xs font-bold items-center text-center">
                                    <div className="bg-red-500/20 text-red-500 h-full flex items-center justify-center border-r border-slate-700/50" style={{ width: '40%' }}>
                                        0 - 40 (Reject)
                                    </div>
                                    <div className="bg-brand-yellow/20 text-brand-yellow h-full flex items-center justify-center border-r border-slate-700/50" style={{ width: `${autoApprovalScore - 40}%` }}>
                                        41 - {autoApprovalScore - 1} (Review)
                                    </div>
                                    <div className="bg-emerald-500/20 text-emerald-500 h-full flex items-center justify-center" style={{ width: `${100 - autoApprovalScore}%` }}>
                                        {autoApprovalScore} - 100 (Approve)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Interest Rate Engine */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-brand-blue" />
                            Dynamic Interest Engine
                        </h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Base Lending Rate (MCLR/Repo Linked)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={baseLendingRate}
                                        onChange={(e) => setBaseLendingRate(Number(e.target.value))}
                                        step="0.1"
                                        className="block w-full rounded-lg border-0 bg-slate-950 py-2.5 pl-4 pr-10 text-white shadow-inner ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-brand-blue sm:text-sm"
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                        <span className="text-slate-500 font-bold">%</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Max Risk Premium Cap</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={maxRiskPremiumCap}
                                        onChange={(e) => setMaxRiskPremiumCap(Number(e.target.value))}
                                        step="0.1"
                                        className="block w-full rounded-lg border-0 bg-slate-950 py-2.5 pl-4 pr-10 text-white shadow-inner ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-brand-blue sm:text-sm"
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                        <span className="text-slate-500 font-bold">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Simulation Formula</p>
                                    <code className="text-sm font-mono text-brand-blue block">
                                        Final ROI = Base Rate + (Risk Premium × (100 - AI Score)/100)
                                    </code>
                                    <div className="mt-3 text-xs text-slate-400">
                                        Example (Score 60): {baseLendingRate}% + ({maxRiskPremiumCap}% × 0.4) = <span className="font-bold text-white">{(baseLendingRate + (maxRiskPremiumCap * 0.4)).toFixed(2)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Col - Sector Weights */}
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm h-full">
                        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-brand-blue" />
                            Sector Risk Multipliers
                        </h2>
                        <p className="text-sm text-slate-400 mb-6">Adjust the AI's sensitivity to macroeconomic sectoral risks. Multipliers {'>'} 1.0 penalize the score.</p>

                        <div className="space-y-5">
                            {Object.entries(sectorMultipliers).map(([sector, weight]) => (
                                <div key={sector} className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-medium text-slate-200">{sector}</span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${weight > 1.3 ? 'bg-red-500/20 text-red-500' :
                                            weight > 1.0 ? 'bg-amber-500/20 text-amber-500' :
                                                'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                            {weight.toFixed(2)}x
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.5"
                                        step="0.1"
                                        value={weight}
                                        onChange={(e) => updateSectorMultiplier(sector, Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-5 border-t border-slate-800 flex items-start gap-3 p-3 bg-brand-blue/5 border-l-2 border-brand-blue rounded-r-lg">
                            <SettingsIcon className="h-5 w-5 text-brand-blue shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-300 leading-relaxed">
                                <span className="font-bold text-white block mb-1">Impact Note:</span>
                                Changes to sector multipliers require re-running the intelligence pipeline for all active applications in the queue to maintain portfolio consistency.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
