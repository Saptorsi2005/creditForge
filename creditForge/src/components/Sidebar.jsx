import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileUp, Building2, BrainCircuit, Activity, FileText, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoSvg from '../assets/logo.svg';

// Persist last viewed application ID across page navigation within the same session
const LAST_APP_KEY = 'lastAppId';

function getLastAppId() {
    return sessionStorage.getItem(LAST_APP_KEY) ?? null;
}

export function setLastAppId(id) {
    if (id) sessionStorage.setItem(LAST_APP_KEY, id);
}

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, hasPermission } = useAuth();

    // Extract :id from current URL if on an analysis page, and update last known ID
    const pathMatch = location.pathname.match(/\/applications\/([^/]+)\//);
    if (pathMatch?.[1]) setLastAppId(pathMatch[1]);
    const lastAppId = getLastAppId();

    // Build href for analysis pages: if we know an app ID, use it; otherwise stay on dashboard
    function analysisHref(page) {
        if (lastAppId) return `/applications/${lastAppId}/${page}`;
        return '/dashboard'; // Redirect to dashboard if no app selected yet
    }

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'view' },
        { name: 'New Application', href: '/new-application', icon: FileUp, permission: 'create' },
        { name: 'Company Analysis', href: analysisHref('company-analysis'), icon: Building2, permission: 'view' },
        { name: 'AI Research', href: analysisHref('ai-research'), icon: BrainCircuit, permission: 'view' },
        { name: 'Risk Engine', href: analysisHref('risk-scoring'), icon: Activity, permission: 'view' },
        { name: 'CAM Report', href: analysisHref('cam-report'), icon: FileText, permission: 'view' },
        { name: 'Settings', href: '/settings', icon: Settings, permission: 'settings' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const filteredNavigation = navigation.filter((item) => {
        if (!user) return false;
        return hasPermission(item.permission);
    });

    const getInitials = (name) =>
        name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);

    const getRoleBadgeStyle = (role) => {
        switch (role) {
            case 'ADMIN': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
            case 'ANALYST': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
            default: return 'bg-slate-500/15 text-slate-300 border-slate-500/25';
        }
    };

    const getAvatarGradient = (role) => {
        switch (role) {
            case 'ADMIN': return 'from-emerald-600 to-emerald-800';
            case 'ANALYST': return 'from-emerald-600 to-emerald-800';
            default: return 'from-slate-600 to-slate-800';
        }
    };

    return (
        <div className="w-64 flex-shrink-0 flex flex-col h-full bg-black/40 backdrop-blur-2xl relative z-20"
            style={{
                borderRight: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '4px 0 24px rgba(0,0,0,0.6)'
            }}>

            {/* Logo */}
            <div className="px-5 pt-6 pb-4 flex items-center space-x-2.5">
                <img src={logoSvg} alt="CreditForge" className="h-8 w-8 flex-shrink-0" />
                <div>
                    <span className="text-[17px] font-bold tracking-tight text-white leading-none">CreditForge</span>
                    <span className="block text-[9px] font-medium tracking-widest uppercase mt-0.5"
                        style={{ color: '#10b981', letterSpacing: '0.12em' }}>AI Platform</span>
                </div>
            </div>

            {/* Divider */}
            <div className="mx-4 mb-3" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />

            {/* Nav section label */}
            <p className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Navigation</p>

            {/* Nav Items */}
            <div className="flex-1 px-3 space-y-0.5 overflow-y-auto">
                {filteredNavigation.map((item) => {
                    // Analysis items have an appId baked into their href already
                    const needsAppId = ['Company Analysis', 'AI Research', 'Risk Engine', 'CAM Report'].includes(item.name);
                    const isDisabled = needsAppId && !lastAppId;

                    const isActive = !isDisabled && location.pathname.startsWith(item.href) && item.href !== '/dashboard';
                    const isDashboard = item.href === '/dashboard' && location.pathname === '/dashboard';
                    const active = isActive || isDashboard;
                    const Icon = item.icon;

                    // Disabled — render a span so it's truly un-clickable
                    if (isDisabled) {
                        return (
                            <span
                                key={item.name}
                                title="Open an application from the Dashboard first"
                                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg cursor-not-allowed select-none"
                                style={{ color: 'rgba(71,85,105,0.6)' }}
                            >
                                <Icon className="h-4 w-4" style={{ color: 'rgba(71,85,105,0.5)' }} />
                                <span className="text-sm font-medium">{item.name}</span>
                                <span className="ml-auto text-[10px] opacity-40 border border-current rounded px-1">–</span>
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group"
                            style={active ? {
                                background: 'linear-gradient(90deg, #10b981, #047857)',
                                color: '#fff',
                                fontWeight: '600',
                                boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.2)'
                            } : {
                                color: '#a1a1aa'
                            }}
                            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#f4f4f5'; } }}
                            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#a1a1aa'; } }}
                        >
                            {/* Active indicator bar */}
                            {active && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                                    style={{ background: '#6ee7b7' }} />
                            )}
                            <Icon className="h-4 w-4 flex-shrink-0"
                                style={{ color: active ? '#6ee7b7' : 'inherit' }} />
                            <span className="text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Divider */}
            <div className="mx-4 mt-3" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />

            {/* Bottom — User Info + Logout */}
            <div className="p-4 space-y-3">
                <div className="flex items-center space-x-3 px-2 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${getAvatarGradient(user?.role)} flex items-center justify-center text-xs font-bold text-white shadow-lg flex-shrink-0`}>
                        {user ? getInitials(user.name) : 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate leading-tight">{user?.name || 'User'}</p>
                        <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium ${user ? getRoleBadgeStyle(user.role) : ''}`}>
                            {user?.role || 'N/A'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-150 group"
                    style={{ color: '#64748b' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; e.currentTarget.style.color = '#34d399'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748b'; }}
                >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    );
}
