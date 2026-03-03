import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, FileUp, Building2, BrainCircuit, Activity, FileText, Settings, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'ADMIN': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
            case 'ANALYST': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <div className="w-64 flex-shrink-0 bg-slate-950 flex flex-col h-full border-r border-slate-800">
            {/* Logo */}
            <div className="p-6 flex items-center space-x-3 mb-2">
                <div className="bg-brand-blue/20 p-2 rounded-lg border border-brand-blue/30 shadow-inner shadow-brand-blue/10">
                    <ShieldCheck className="h-6 w-6 text-brand-blue" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">CreditForge AI</span>
            </div>

            {/* Nav Items */}
            <div className="flex-1 px-3 space-y-1 overflow-y-auto">
                {filteredNavigation.map((item) => {
                    // Analysis items have an appId baked into their href already
                    const needsAppId = ['Company Analysis', 'AI Research', 'Risk Engine', 'CAM Report'].includes(item.name);
                    const isDisabled = needsAppId && !lastAppId;

                    const isActive = !isDisabled && location.pathname.startsWith(item.href) && item.href !== '/dashboard';
                    const isDashboard = item.href === '/dashboard' && location.pathname === '/dashboard';
                    const active = isActive || isDashboard;
                    const Icon = item.icon;

                    const baseStyle = 'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all';

                    // Disabled — render a span so it's truly un-clickable
                    if (isDisabled) {
                        return (
                            <span
                                key={item.name}
                                title="Open an application from the Dashboard first"
                                className={`${baseStyle} text-slate-600 cursor-not-allowed select-none`}
                            >
                                <Icon className="h-5 w-5 text-slate-700" />
                                <span className="text-sm">{item.name}</span>
                                <span className="ml-auto text-[10px] text-slate-700 border border-slate-800 rounded px-1">–</span>
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`${baseStyle} ${active
                                    ? 'bg-slate-800 text-white font-medium shadow-sm border border-slate-700/50'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            <Icon className={`h-5 w-5 ${active ? 'text-brand-blue' : 'text-slate-500'}`} />
                            <span className="text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Bottom — User Info + Logout */}
            <div className="p-4 border-t border-slate-800 mt-auto bg-slate-950/50 space-y-3">
                <div className="flex items-center space-x-3 px-2 py-2">
                    <div className="h-9 w-9 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        {user ? getInitials(user.name) : 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{user?.name || 'User'}</p>
                        <div className="flex items-center space-x-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${user ? getRoleBadgeColor(user.role) : ''}`}>
                                {user?.role || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/30"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        </div>
    );
}
