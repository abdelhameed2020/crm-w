import React from 'react';
import { Menu, Search, Bell, Database, Radio } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TopbarProps {
  onMenuClick: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  const { isFirebaseReady, user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Right side: Mobile Menu + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
          aria-label="فتح القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث في المحادثات، العملاء، الرسائل..."
            className="w-full pl-4 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Left side: System status & Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Firebase Environment Status Indicator */}
        <div
          title={isFirebaseReady ? 'متصل بقاعدة بيانات Firebase المباشرة' : 'وضع التطوير التجريبي المبدئي (بانتظار مفاتيح .env)'}
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isFirebaseReady
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{isFirebaseReady ? 'Firebase متصل' : 'وضع التطوير'}</span>
        </div>

        {/* Channels Live Status Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
          <span>القنوات: نشطة</span>
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          title="التنبيهات"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white"></span>
        </button>

        {/* User Avatar Chip */}
        <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
          <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs">
            {user?.displayName?.charAt(0) || 'U'}
          </div>
          <span className="hidden sm:inline text-xs font-bold text-slate-700 max-w-[100px] truncate">
            {user?.displayName}
          </span>
        </div>
      </div>
    </header>
  );
};
