import React from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { PwaInstallModal } from './PwaInstallModal';

interface InstallPwaButtonProps {
  variant?: 'topbar' | 'sidebar' | 'banner' | 'login';
  className?: string;
}

export const InstallPwaButton: React.FC<InstallPwaButtonProps> = ({
  variant = 'topbar',
  className = '',
}) => {
  const {
    isInstalled,
    isIOS,
    showInstructions,
    setShowInstructions,
    triggerInstall,
  } = usePwaInstall();

  // If already installed in standalone mode, hide the install button completely
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    await triggerInstall();
  };

  return (
    <>
      {variant === 'topbar' && (
        <button
          onClick={handleClick}
          title="تثبيت التطبيق على الشاشة الرئيسية"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-all shadow-sm active:scale-95 ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-brand-600 animate-pulse" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
          <span className="sm:hidden">تثبيت</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-brand-300 bg-brand-950/40 hover:bg-brand-900/50 border border-brand-500/20 transition-all group ${className}`}
        >
          <div className="w-6 h-6 rounded-lg bg-brand-600/30 flex items-center justify-center text-brand-400 group-hover:bg-brand-600 group-hover:text-white transition-colors">
            <Download className="w-3.5 h-3.5" />
          </div>
          <span className="flex-1 text-right">تثبيت التطبيق على الهاتف</span>
          <span className="text-[10px] bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded border border-brand-500/30">PWA</span>
        </button>
      )}

      {variant === 'banner' && (
        <div className={`p-4 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-2xl shadow-lg border border-brand-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm">ثبّت نظام CRM أولاد يحيى على هاتفك</h4>
              <p className="text-brand-100 text-xs mt-0.5">وصول فوري وشاشة كاملة شبيهة بالتطبيقات الأصلية مع استمرار التزامن وسرعة الاستجابة.</p>
            </div>
          </div>
          <button
            onClick={handleClick}
            className="w-full sm:w-auto px-4 py-2 bg-white text-brand-700 hover:bg-brand-50 rounded-xl font-bold text-xs transition-colors shadow-md shrink-0 flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>تثبيت الآن</span>
          </button>
        </div>
      )}

      {variant === 'login' && (
        <div className={`mt-5 pt-4 border-t border-slate-100 text-center ${className}`}>
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-all shadow-sm"
          >
            <Smartphone className="w-4 h-4 text-brand-600" />
            <span>تثبيت التطبيق على الشاشة الرئيسية للهاتف</span>
          </button>
          <p className="text-[11px] text-slate-400 mt-1">يفتح المنصة مباشرة كبرنامج متكامل على أندرويد وiOS</p>
        </div>
      )}

      {/* Instructions Modal for iOS / unsupported browsers */}
      <PwaInstallModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        isIOS={isIOS}
        isInstalled={isInstalled}
      />
    </>
  );
};
