import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(formData.email, formData.password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const features = [
    { icon: ShieldCheck, label: 'AI-Powered Risk Scoring', desc: 'Composite risk scores with ML models' },
    { icon: TrendingUp, label: 'Real-time Analytics', desc: 'Live portfolio health dashboards' },
    { icon: Zap, label: 'Automated CAM Reports', desc: 'Generate credit appraisal memos instantly' },
  ];

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ backgroundColor: '#030000' }}>
      {/* Pronounced Reddish Rays & Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] bg-emerald-600/25 blur-[160px] pointer-events-none rounded-full mix-blend-screen z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] pointer-events-none rounded-full mix-blend-screen z-0" />
      <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-teal-600/10 blur-[140px] pointer-events-none rounded-full mix-blend-screen z-0" />

      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col justify-between p-12 relative z-10">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <img src={logoSvg} alt="CreditForge" className="h-10 w-10" />
          <div>
            <span className="text-xl font-bold text-white tracking-tight">CreditForge</span>
            <span className="block text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: '#c07a20' }}>AI Platform</span>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-6">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              Precision Intelligence<br />
              <span style={{ background: 'linear-gradient(90deg, #10b981, #c07a20)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                for Credit Risk
              </span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Enterprise-grade credit appraisal powered by AI. Analyze companies, score risk, and generate compliant CAM reports at scale.
            </p>
          </div>
          <div className="space-y-4">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start space-x-4">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <Icon className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="text-xs text-slate-600">© 2026 CreditForge AI. Enterprise Credit Intelligence Platform.</p>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <img src={logoSvg} alt="CreditForge" className="h-16" />
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8 shadow-2xl"
            style={{
              background: 'rgba(11,17,32,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
              <p className="text-sm text-slate-500">Sign in to your CreditForge account</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-sm text-emerald-300 flex items-center space-x-2"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="email" name="email" type="email" required
                    value={formData.email} onChange={handleChange}
                    className="block w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm placeholder-slate-600 transition-all duration-150"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(16,185,129,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="password" name="password"
                    type={showPassword ? 'text' : 'password'} required
                    value={formData.password} onChange={handleChange}
                    className="block w-full pl-10 pr-12 py-3 rounded-xl text-white text-sm placeholder-slate-600 transition-all duration-150"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(16,185,129,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 mt-2"
                style={{
                  background: loading ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg, #10b981, #047857)',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(16,185,129,0.4)',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 28px rgba(16,185,129,0.55)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(16,185,129,0.4)'; }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Sign up link */}
            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold transition-colors" style={{ color: '#6ee7b7' }}
                onMouseEnter={e => e.target.style.color = '#10b981'}
                onMouseLeave={e => e.target.style.color = '#6ee7b7'}>
                Create account
              </Link>
            </p>

            {/* Demo credentials */}
            <div className="mt-6 pt-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Demo Credentials</p>
              <div className="space-y-1 text-[11px] text-slate-700 font-mono">
                <p>admin@creditforge.com / password123</p>
                <p>analyst@creditforge.com / password123</p>
                <p>viewer@creditforge.com / password123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
