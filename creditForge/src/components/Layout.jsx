import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
    return (
        <div className="flex h-screen text-slate-50 overflow-hidden relative" style={{ backgroundColor: '#030000' }}>
            {/* Pronounced Reddish Rays & Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] bg-emerald-600/25 blur-[160px] pointer-events-none rounded-full mix-blend-screen" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] pointer-events-none rounded-full mix-blend-screen" />
            <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-teal-600/10 blur-[140px] pointer-events-none rounded-full mix-blend-screen" />

            <Sidebar />
            <main className="flex-1 overflow-y-auto relative z-10" style={{ background: 'transparent' }}>
                <div className="p-6 md:p-8 max-w-screen-2xl mx-auto relative z-10">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
