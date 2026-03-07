import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, UserCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

export default function Signup() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'ANALYST',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const roles = [
    { value: 'ADMIN', label: 'Admin', description: 'Full system access' },
    { value: 'ANALYST', label: 'Credit Analyst', description: 'Create and analyze applications' },
    { value: 'VIEWER', label: 'Viewer', description: 'Read-only access' },
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    });

    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  };
  const inputFocus = (e) => e.target.style.borderColor = 'rgba(16,185,129,0.5)';
  const inputBlur = (e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)';
  const inputClass = "block w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm placeholder-slate-600 transition-all duration-150";

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{ backgroundColor: '#030000' }}>
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] bg-emerald-600/25 blur-[160px] pointer-events-none rounded-full mix-blend-screen z-0" />
        <div className="text-center relative z-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-5"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
          <p className="text-slate-400 mb-4">Redirecting to sign in...</p>
          <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: '#030000' }}>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] bg-emerald-600/25 blur-[160px] pointer-events-none rounded-full mix-blend-screen z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] pointer-events-none rounded-full mix-blend-screen z-0" />
      <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-teal-600/10 blur-[140px] pointer-events-none rounded-full mix-blend-screen z-0" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoSvg} alt="CreditForge" className="h-16 mb-4" />
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">Join CreditForge AI Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{
            background: 'rgba(11,17,32,0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
          }}>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm text-emerald-300 flex items-center space-x-2"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input id="name" name="name" type="text" required
                  value={formData.name} onChange={handleChange}
                  className={inputClass} style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur}
                  placeholder="Jane Smith" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input id="email" name="email" type="email" required
                  value={formData.email} onChange={handleChange}
                  className={inputClass} style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur}
                  placeholder="you@company.com" />
              </div>
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Role</label>
              <div className="relative">
                <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <select id="role" name="role" value={formData.role} onChange={handleChange}
                  className={`${inputClass} pr-10 appearance-none cursor-pointer`} style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur}>
                  {roles.map((role) => (
                    <option key={role.value} value={role.value} className="bg-slate-900">
                      {role.label} — {role.description}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input id="password" name="password"
                  type={showPassword ? 'text' : 'password'} required
                  value={formData.password} onChange={handleChange}
                  className={`${inputClass} pr-12`} style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur}
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input id="confirmPassword" name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'} required
                  value={formData.confirmPassword} onChange={handleChange}
                  className={`${inputClass} pr-12`} style={inputStyle}
                  onFocus={inputFocus} onBlur={inputBlur}
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold transition-colors" style={{ color: '#6ee7b7' }}
              onMouseEnter={e => e.target.style.color = '#10b981'}
              onMouseLeave={e => e.target.style.color = '#6ee7b7'}>
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">© 2026 CreditForge AI. All rights reserved.</p>
      </div>
    </div>
  );
}
