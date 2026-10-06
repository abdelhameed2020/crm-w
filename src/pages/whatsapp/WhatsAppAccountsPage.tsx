import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Smartphone,
  Users,
  RefreshCw,
  Power,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  Loader2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { WhatsAppAccountsService } from '../../services/firebase/whatsappAccounts.service';
import { EmployeesService } from '../../services/firebase/employees.service';
import { GatewayApiClient } from '../../services/channels/gatewayApiClient';
import type { WhatsAppAccount, WhatsAppConnectionStatus } from '../../types/whatsapp.types';
import type { Employee } from '../../types/employee.types';

export const WhatsAppAccountsPage: React.FC = () => {
  const { isAdmin } = useAuth();

  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gatewayStatus, setGatewayStatus] = useState<{ isOnline: boolean; error?: string; uptime?: number }>({
    isOnline: false,
  });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activeAccountForQr, setActiveAccountForQr] = useState<WhatsAppAccount | null>(null);
  const [currentQrDataUrl, setCurrentQrDataUrl] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<WhatsAppConnectionStatus>('connecting');
  const [qrError, setQrError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Form State for Add Account
  const [newAccountName, setNewAccountName] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Check Gateway health
  const refreshGatewayHealth = async () => {
    const health = await GatewayApiClient.checkHealth();
    setGatewayStatus(health);
  };

  useEffect(() => {
    refreshGatewayHealth();
    const timer = setInterval(refreshGatewayHealth, 10000);
    return () => clearInterval(timer);
  }, []);

  // 2. Subscribe to WhatsApp accounts & Employees
  useEffect(() => {
    setIsLoading(true);

    const unsubAccounts = WhatsAppAccountsService.subscribeToAccounts(
      (data) => {
        setAccounts(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Failed to load WhatsApp accounts:', err);
        setIsLoading(false);
      }
    );

    const unsubEmployees = EmployeesService.subscribeToEmployees(
      (data) => setEmployees(data),
      (err) => console.error('Failed to load employees:', err)
    );

    return () => {
      unsubAccounts();
      unsubEmployees();
    };
  }, []);

  // 3. QR Polling when modal is open
  useEffect(() => {
    if (!isQrModalOpen || !activeAccountForQr) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const pollStatus = async () => {
      try {
        const res = await GatewayApiClient.getQrStatus(activeAccountForQr.id);
        setQrStatus(res.status);

        if (res.qrDataUrl) {
          setCurrentQrDataUrl(res.qrDataUrl);
        }

        if (res.status === 'connected') {
          // Connected successfully! Update local Firestore state if needed
          await WhatsAppAccountsService.updateAccount(activeAccountForQr.id, {
            status: 'connected',
            phoneNumber: res.phoneNumber || activeAccountForQr.phoneNumber,
            lastConnectedAt: Date.now(),
          });
        }
      } catch (err: any) {
        setQrError(err.message || 'تعذر جلب رمز الاستجابة السريعة');
      }
    };

    // First poll immediately
    pollStatus();
    // Then every 2.5 seconds
    pollingRef.current = setInterval(pollStatus, 2500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isQrModalOpen, activeAccountForQr]);

  // Handle open QR modal
  const handleOpenQrModal = async (account: WhatsAppAccount) => {
    setActiveAccountForQr(account);
    setCurrentQrDataUrl(null);
    setQrStatus('connecting');
    setQrError(null);
    setIsQrModalOpen(true);

    try {
      const res = await GatewayApiClient.initializeSession(account.id);
      setQrStatus(res.status);
      if (res.qrDataUrl) {
        setCurrentQrDataUrl(res.qrDataUrl);
      }
    } catch (err: any) {
      setQrError(err.message || 'فشل تشغيل جلسة واتساب في البوابة');
    }
  };

  // Handle Reconnect
  const handleReconnect = async (account: WhatsAppAccount) => {
    setIsActionLoading(true);
    try {
      await GatewayApiClient.reconnectSession(account.id);
      handleOpenQrModal(account);
    } catch (err: any) {
      alert(`فشل إعادة الاتصال: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async (account: WhatsAppAccount) => {
    if (!confirm(`هل أنت متأكد من رغبتك في قطع اتصال الحساب "${account.displayName}"؟`)) {
      return;
    }

    setIsActionLoading(true);
    try {
      await GatewayApiClient.disconnectSession(account.id, true);
      await WhatsAppAccountsService.updateAccount(account.id, {
        status: 'disconnected',
      });
    } catch (err: any) {
      alert(`فشل قطع الاتصال: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Delete Account
  const handleDeleteAccount = async (account: WhatsAppAccount) => {
    if (!confirm(`هل أنت متأكد من حذف الحساب "${account.displayName}" نهائياً؟`)) {
      return;
    }

    setIsActionLoading(true);
    try {
      await GatewayApiClient.disconnectSession(account.id, true).catch(() => {});
      await WhatsAppAccountsService.deleteAccount(account.id);
    } catch (err: any) {
      alert(`فشل حذف الحساب: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Create Account Form
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    setIsActionLoading(true);
    const newId = `wa_${Date.now()}`;
    const newAccount: WhatsAppAccount = {
      id: newId,
      displayName: newAccountName.trim(),
      status: 'disconnected',
      provider: 'web',
      assignedEmployees: selectedEmployees,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await WhatsAppAccountsService.createAccount(newAccount);
      setNewAccountName('');
      setSelectedEmployees([]);
      setIsAddModalOpen(false);

      // Automatically launch QR scanning modal
      handleOpenQrModal(newAccount);
    } catch (err: any) {
      alert(`فشل إنشاء الحساب: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: WhatsAppConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <Badge variant="success">متصل ونشط</Badge>;
      case 'waiting_for_qr':
        return <Badge variant="warning">بانتظار مسح الباركود</Badge>;
      case 'connecting':
      case 'reconnecting':
        return <Badge variant="info">جارٍ الاتصال...</Badge>;
      case 'error':
        return <Badge variant="danger">خطأ في الاتصال</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="neutral">غير متصل</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">حسابات واتساب (WhatsApp Web Gateway)</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                إدارة أرقام واتساب التجريبية وربط الأجهزة عبر الباركود بدون الحاجة لـ WhatsApp Cloud API
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Gateway Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              gatewayStatus.isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>{gatewayStatus.isOnline ? 'خادم البوابة متصل (:5001)' : 'خادم البوابة غير متصل'}</span>
            <button
              onClick={refreshGatewayHealth}
              title="تحديث حالة الخادم"
              className="hover:rotate-180 transition-transform duration-300 ml-1"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {isAdmin && (
            <Button
              variant="primary"
              className="flex items-center gap-2 shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حساب جديد</span>
            </Button>
          )}
        </div>
      </div>

      {/* Experimental Warning Alert */}
      <div className="bg-amber-50/90 border border-amber-200/80 p-4 rounded-xl flex items-start gap-3 text-amber-900">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-amber-800">
            تنبيه خاص بالمرحلة التجريبية (Experimental Phase)
          </p>
          <p className="text-amber-700 leading-relaxed">
            هذه البوابة مبنية باستخدام محاكي بروتوكول واتساب ويب (Baileys) وهي مخصصة حصرياً لأغراض الاختبار الداخلي وتجربة منصة OmniCRM قبل الحصول على ترخيص Meta الرسمي. لا تستخدم أرقاماً حساسة لتجنب سياسات حظر WhatsApp Web عند الإرسال الكثيف.
          </p>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <span>الأرقام والحسابات المضافة</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
              {accounts.length}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p>جارٍ تحميل حسابات واتساب...</p>
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            title="لا توجد حسابات واتساب بعد"
            description="قم بإضافة خط واتساب جديد ومسح الرمز (QR Code) لبدء استقبال وإرسال الرسائل مباشرة."
            actionLabel={isAdmin ? 'إضافة حساب جديد' : undefined}
            onAction={isAdmin ? () => setIsAddModalOpen(true) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-medium">
                <tr>
                  <th className="py-3 px-4">اسم الحساب</th>
                  <th className="py-3 px-4">رقم الهاتف</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">الموظفون المصرح لهم</th>
                  <th className="py-3 px-4">آخر اتصال</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => {
                  const assignedCount = acc.assignedEmployees?.length || 0;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span>{acc.displayName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-700">
                        {acc.phoneNumber || <span className="text-slate-400 italic">بانتظار المسح</span>}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(acc.status)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>
                            {assignedCount === 0
                              ? 'متاح للجميع'
                              : `${assignedCount} موظف`}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-500 text-xs">
                        {acc.lastConnectedAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{new Date(acc.lastConnectedAt).toLocaleString('ar-EG')}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {acc.status !== 'connected' ? (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-xs flex items-center gap-1.5"
                              onClick={() => handleOpenQrModal(acc)}
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>مسح الباركود</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs flex items-center gap-1.5"
                              onClick={() => handleDisconnect(acc)}
                              disabled={isActionLoading}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>قطع الاتصال</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            title="إعادة الاتصال"
                            className="text-slate-600 hover:text-slate-900"
                            onClick={() => handleReconnect(acc)}
                            disabled={isActionLoading}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>

                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="حذف الحساب"
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleDeleteAccount(acc)}
                              disabled={isActionLoading}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Add Account */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>إضافة خط واتساب جديد</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  اسم الحساب أو الخط <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: خط المبيعات الرئيسي أو خدمة العملاء"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  الموظفون المصرح لهم باستخدام هذا الخط
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  اترك القائمة فارغة للسماح لجميع الموظفين بالرد والإرسال، أو حدد موظفين بعينهم:
                </p>
                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-3 space-y-2 bg-slate-50/50">
                  {employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees([...selectedEmployees, emp.id]);
                          } else {
                            setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id));
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-800 font-medium">{emp.name}</span>
                      <span className="text-xs text-slate-400">({emp.role})</span>
                    </label>
                  ))}
                  {employees.length === 0 && (
                    <p className="text-xs text-slate-400 italic">لا يوجد موظفون مسجلون حالياً</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="ghost" type="button" onClick={() => setIsAddModalOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isActionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isActionLoading ? 'جارٍ الإنشاء...' : 'إنشاء وبدء الربط'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Live QR Code Scanner */}
      {isQrModalOpen && activeAccountForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  <span>ربط حساب: {activeAccountForQr.displayName}</span>
                </h3>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6 text-center space-y-6">
              {/* QR Display Area */}
              <div className="flex flex-col items-center justify-center min-h-[260px]">
                {qrStatus === 'connected' ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-emerald-600 py-6">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">تم الربط بنجاح!</h4>
                    <p className="text-sm text-slate-500">
                      أصبح الحساب متصلاً وجاهزاً لإرسال واستقبال الرسائل في OmniCRM.
                    </p>
                  </div>
                ) : qrError ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-rose-600 py-6">
                    <XCircle className="w-12 h-12 text-rose-500" />
                    <p className="text-sm font-semibold">{qrError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenQrModal(activeAccountForQr)}
                    >
                      إعادة المحاولة
                    </Button>
                  </div>
                ) : currentQrDataUrl ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white border-2 border-dashed border-emerald-500 rounded-2xl shadow-inner inline-block">
                      <img
                        src={currentQrDataUrl}
                        alt="WhatsApp QR Code"
                        className="w-56 h-56 mx-auto object-contain rounded-lg"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>في انتظار المسح من تطبيق واتساب على هاتفك...</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
                    <p className="text-sm">جارٍ إنشاء رمز الاستجابة السريعة (QR Code)...</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              {qrStatus !== 'connected' && (
                <div className="text-right bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs text-slate-600">
                  <p className="font-bold text-slate-800 text-sm mb-1">خطوات الربط:</p>
                  <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                    <li>افتح تطبيق واتساب على هاتفك المحمول.</li>
                    <li>
                      انقر على القائمة (⁝ أو الإعدادات) واختر <strong>الأجهزة المرتبطة (Linked Devices)</strong>.
                    </li>
                    <li>
                      انقر على <strong>ربط جهاز (Link a Device)</strong>.
                    </li>
                    <li>وجّه كاميرا الهاتف نحو الرمز الموضح أعلاه.</li>
                  </ol>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="primary"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setIsQrModalOpen(false)}
                >
                  {qrStatus === 'connected' ? 'إغلاق ومتابعة' : 'إلغاء'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
