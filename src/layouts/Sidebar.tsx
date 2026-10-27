import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  Users,
  GitBranch,
  UserCheck,
  BarChart3,
  Settings,
  Shield,
  Smartphone,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { InstallPwaButton } from '../components/pwa/InstallPwaButton';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout, switchDemoRole, isAdmin, isManager } = useAuth();

  const navigationItems = [
    { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard, visible: true },
    { name: 'صندوق المحادثات', href: '/inbox', icon: Inbox, badge: 'موحد', visible: true },
    { name: 'العملاء والـ Leads', href: '/customers', icon: Users, visible: true },
    { name: 'مسار المبيعات', href: '/pipeline', icon: GitBranch, visible: true },
    { name: 'فريق العمل', href: '/employees', icon: UserCheck, visible: isAdmin || isManager },
    { name: 'حسابات واتساب', href: '/whatsapp-accounts', icon: Smartphone, badge: 'تجريبي', visible: isAdmin },
    { name: 'التقارير والأداء', href: '/reports', icon: BarChart3, visible: isAdmin || isManager },
    { name: 'الإعدادات والقنوات', href: '/settings', icon: Settings, visible: isAdmin },
  ].filter((item) => item.visible);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-white tracking-tight">OmniCRM</h1>
              <p className="text-[10px] text-slate-400">صندوق المحادثات الموحد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            القائمة الرئيسية
          </div>

          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-brand-500/30 text-brand-300 border border-brand-400/30 px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* PWA Mobile App Install Section */}
        <div className="px-3 pb-2">
          <InstallPwaButton variant="sidebar" />
        </div>

        {/* User Profile & Role Switcher */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 font-bold text-sm">
                {user?.displayName?.charAt(0) || 'م'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'المستخدم'}</p>
                <span className="inline-flex items-center gap-1 text-[10px] text-brand-300 bg-brand-950/60 px-1.5 py-0.5 rounded border border-brand-800/50">
                  <Shield className="w-3 h-3" />
                  {user?.role === 'admin' ? 'مدير نظام' : user?.role === 'manager' ? 'مدير فريق' : 'موظف'}
                </span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="تسجيل الخروج"
              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Role Tester (strictly gated to offline dev mode only) */}
          {switchDemoRole && (
            <div className="pt-2 border-t border-slate-800/60">
              <p className="text-[10px] text-slate-400 mb-1.5">معاينة الواجهة المحلية (Dev Tool):</p>
              <div className="grid grid-cols-3 gap-1">
                {(['admin', 'manager', 'employee'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => switchDemoRole(r)}
                    className={`text-[10px] py-1 rounded transition-colors ${
                      user?.role === r
                        ? 'bg-brand-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {r === 'admin' ? 'أدمن' : r === 'manager' ? 'مدير' : 'موظف'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
