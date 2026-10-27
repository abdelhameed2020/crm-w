import React from 'react';
import { X, Share2, PlusSquare, Smartphone, CheckCircle2, MoreVertical, Globe, ShieldCheck } from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  isInstalled: boolean;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  isInstalled,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all text-slate-800"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shadow-inner">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">تثبيت CRM أولاد يحيى</h3>
              <p className="text-brand-100 text-xs">كتطبيق مستقل على شاشة هاتفك الرئيسية</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {isInstalled ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <p className="font-bold text-emerald-800 text-sm">التطبيق مثبت بالفعل على جهازك!</p>
              <p className="text-emerald-600 text-xs mt-1">يمكنك فتحه مباشرة من الشاشة الرئيسية لهاتفك كأي تطبيق رسمي.</p>
            </div>
          ) : isIOS ? (
            /* iOS Safari Instructions */
            <div className="space-y-4">
              <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200/60 p-3 rounded-xl flex items-start gap-2">
                <Globe className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  على أجهزة <strong>iPhone و iPad</strong>، يرجى فتح الرابط في متصفح <strong>Safari</strong> لتثبيت التطبيق باتباع الخطوات التالية:
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      اضغط على زر المشاركة
                      <Share2 className="w-4 h-4 text-brand-600 inline" />
                    </p>
                    <p className="text-slate-500 mt-0.5">تجد هذا الزر في شريط أدوات Safari بالأسفل (أو بالأعلى على أجهزة iPad).</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      اختر «إضافة إلى الشاشة الرئيسية»
                      <PlusSquare className="w-4 h-4 text-brand-600 inline" />
                    </p>
                    <p className="text-slate-500 mt-0.5">مرر القائمة لأسفل حتى تجد خيار (Add to Home Screen).</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">اضغط على زر «إضافة» (Add)</p>
                    <p className="text-slate-500 mt-0.5">ستجده في الزاوية العلوية؛ وستظهر أيقونة التطبيق فوراً على شاشة هاتفك.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Android / Chrome / Desktop Generic Instructions */
            <div className="space-y-4">
              <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200/60 p-3 rounded-xl flex items-start gap-2">
                <Globe className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <span>
                  إذا لم تظهر لك نافذة التثبيت التلقائية، يمكنك تثبيت التطبيق يدوياً من قائمة المتصفح:
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      افتح قائمة المتصفح
                      <MoreVertical className="w-4 h-4 text-slate-600 inline" />
                    </p>
                    <p className="text-slate-500 mt-0.5">اضغط على أيقونة الثلاث نقاط في أعلى أو أسفل المتصفح.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»</p>
                    <p className="text-slate-500 mt-0.5">ابحث عن خيار (Install app) أو (Add to Home screen).</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">تأكيد التثبيت</p>
                    <p className="text-slate-500 mt-0.5">اضغط تثبيت، وسيفتح النظام كبرنامج كامل بدون شريط المتصفح.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Features note */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              تشفير وأمان بيانات كامل
            </span>
            <span>يدعم أندرويد وiOS</span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-brand-500/20"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
};
