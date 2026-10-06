import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';

export const LoginPage: React.FC = () => {
  const { user, login, isFirebaseReady } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@crm.local');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول. يرجى التحقق من البيانات.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 p-8 text-center text-white relative">
          <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">تسجيل الدخول للمنصة</h2>
          <p className="text-brand-100 text-xs mt-1">نظام إدارة المحادثات الموحدة وCRM</p>

          {!isFirebaseReady && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] bg-amber-400/20 text-amber-200 border border-amber-300/30">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>وضع المعاينة المعمارية (بدون مفاتيح Firebase)</span>
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 text-sm font-bold shadow-md shadow-brand-500/25"
              isLoading={isLoading}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              دخول المنصة
            </Button>
          </div>

          <p className="text-[11px] text-center text-slate-400">
            صلاحيات الحساب (مدير النظام / مدير فريق / موظف) يتم جلبها مباشرة من السجلات الآمنة في Firestore.
          </p>
        </form>
      </div>
    </div>
  );
};
