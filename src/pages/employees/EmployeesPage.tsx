import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  UserPlus,
  X,
  Mail,
  Phone,
  Building,
  Loader2,
  Trash2,
  Edit,
  Key,
  Send,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Card } from '../../components/common/Card';
import { EmployeesService } from '../../services/firebase/employees.service';
import { FirestoreService } from '../../services/firebase/firestore.service';
import { COLLECTIONS } from '../../services/firebase/collections';
import type { Employee, EmployeePresenceStatus } from '../../types/employee.types';
import type { UserProfile, UserRole } from '../../types/auth.types';
import { useAuth } from '../../hooks/useAuth';
import { AutoAssignmentService } from '../../services/assignment/AutoAssignmentService';

export const EmployeesPage: React.FC = () => {
  const { isAdmin, firebaseUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add Employee Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [department, setDepartment] = useState('خدمة العملاء');
  const [maxActiveChats, setMaxActiveChats] = useState(5);

  // Add Employee Recovery State (when auth/email-already-in-use occurs)
  const [alreadyInUseEmail, setAlreadyInUseEmail] = useState<string | null>(null);

  // Edit Employee Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('employee');
  const [editDepartment, setEditDepartment] = useState('خدمة العملاء');
  const [editMaxActiveChats, setEditMaxActiveChats] = useState(5);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editCurrentPassword, setEditCurrentPassword] = useState('');
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailSentSuccess, setResetEmailSentSuccess] = useState(false);

  useEffect(() => {
    const unsub = EmployeesService.subscribeToEmployees(
      (data) => setEmployees(data),
      (err) => console.error('Failed to load employees:', err)
    );
    return () => unsub();
  }, []);

  // 1. Create Employee Handler
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('يرجى ملء اسم الموظف والبريد الإلكتروني.');
      return;
    }

    if (password && password.length < 6) {
      alert('كلمة المرور يجب أن تتكون من 6 خانات على الأقل.');
      return;
    }

    setIsSaving(true);
    setAlreadyInUseEmail(null);
    try {
      await EmployeesService.createEmployeeWithAuth(
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          role,
          department: department.trim() || 'خدمة العملاء',
          isOnline: false,
          activeConversationsCount: 0,
          maxActiveChats: Number(maxActiveChats) || 5,
          assignedChannels: [],
        },
        password.trim() || undefined
      );

      resetAddForm();
      setIsAddModalOpen(false);
      alert('تم إنشاء حساب الموظف بنجاح! يمكن للموظف الآن تسجيل الدخول مباشرة ببريده وكلمة المرور.');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use' || err.message?.includes('auth/email-already-in-use')) {
        setAlreadyInUseEmail(email.trim().toLowerCase());
      } else if (err.message?.includes('permissions') || err.code === 'permission-denied') {
        alert(
          `فشل حفظ الموظف بسبب صلاحيات Firestore (Missing permissions):\n\n` +
          `• معرّف حسابك الفعلي (UID): ${firebaseUser?.uid || 'غير معروف'}\n\n` +
          `يرجى التأكد من تحديث قواعد Rules في Firebase Console للسماح بالإدارة.`
        );
      } else {
        alert(`فشل إنشاء حساب الموظف: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 1b. Force save employee directly into CRM database
  const handleForceSaveEmployeeToCRM = async () => {
    if (!name.trim() || !email.trim()) {
      alert('يرجى إدخال اسم الموظف والبريد الإلكتروني.');
      return;
    }
    setIsSaving(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const authUid = `emp_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const newEmployee: Employee = {
        id: authUid,
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim() || undefined,
        role,
        department: department.trim() || 'خدمة العملاء',
        isOnline: false,
        activeConversationsCount: 0,
        maxActiveChats: Number(maxActiveChats) || 5,
        assignedChannels: [],
        createdAt: Date.now(),
      };

      await FirestoreService.set<Employee>(COLLECTIONS.EMPLOYEES, authUid, newEmployee);

      const userProfile: UserProfile = {
        id: authUid,
        email: cleanEmail,
        displayName: newEmployee.name,
        role: newEmployee.role,
        department: newEmployee.department,
        phoneNumber: newEmployee.phone,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await FirestoreService.set<UserProfile>(COLLECTIONS.USERS, authUid, userProfile);

      resetAddForm();
      setIsAddModalOpen(false);
      alert(
        `تم حفظ الموظف "${newEmployee.name}" في نظام CRM بنجاح!\n\n` +
        `• يظهر الموظف الآن في قائمة فريق العمل ويمكن إسناد المحادثات والمهام له فوراً.`
      );
    } catch (err: any) {
      alert(`فشل الحفظ في CRM: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetAddForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('employee');
    setDepartment('خدمة العملاء');
    setMaxActiveChats(5);
    setAlreadyInUseEmail(null);
  };

  // 2. Open Edit Modal
  const handleOpenEditModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditName(emp.name);
    setEditEmail(emp.email);
    setEditPhone(emp.phone || '');
    setEditRole(emp.role);
    setEditDepartment(emp.department || 'خدمة العملاء');
    setEditMaxActiveChats(emp.maxActiveChats || 5);
    setEditNewPassword('');
    setEditCurrentPassword('');
    setResetEmailSentSuccess(false);
    setIsEditModalOpen(true);
  };

  // 3. Update Employee Handler (Cloud Sync in Firestore & Auth)
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!editName.trim()) {
      alert('يرجى إدخال اسم الموظف.');
      return;
    }

    if (editNewPassword && editNewPassword.length < 6) {
      alert('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    setIsSaving(true);
    try {
      await EmployeesService.updateEmployee(
        selectedEmployee.id,
        {
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim() || undefined,
          role: editRole,
          department: editDepartment.trim() || 'خدمة العملاء',
          maxActiveChats: Number(editMaxActiveChats) || 5,
        },
        editNewPassword.trim() || undefined,
        editCurrentPassword.trim() || undefined
      );

      setIsEditModalOpen(false);
      setSelectedEmployee(null);
      alert('تم تحديث بيانات الموظف سحابياً بنجاح وتمت مزامنة كافة الصلاحيات!');
    } catch (err: any) {
      console.error('Error updating employee:', err);
      alert(`فشل تحديث بيانات الموظف: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Send Password Reset Email directly to employee
  const handleSendResetEmail = async (targetEmail: string) => {
    if (!targetEmail) return;
    setIsSendingResetEmail(true);
    try {
      await EmployeesService.sendPasswordReset(targetEmail);
      setResetEmailSentSuccess(true);
      alert(
        `تم إرسال رابط تعيين كلمة المرور بنجاح إلى:\n${targetEmail}\n\n` +
        `⚠️ تنبيه هام: يرجى فحص مجلد "الرسائل غير المرغوب فيها (Spam / Junk)" أو "الرسائل الترويجية (Promotions)" في بريد Gmail، لأن Google تضع رسائل إعادة التعيين التلقائية هناك غالباً.`
      );
    } catch (err: any) {
      alert(`فشل إرسال رابط إعادة التعيين: ${err.message}`);
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  // 5. Delete Employee Handler
  const handleDeleteEmployee = async (emp: Employee) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف الموظف "${emp.name}" من فريق العمل؟`)) {
      return;
    }

    try {
      await EmployeesService.deleteEmployee(emp.id);
      alert(`تم حذف الموظف "${emp.name}" من النظام بنجاح.`);
    } catch (err: any) {
      alert(`فشل حذف الموظف: ${err.message}`);
    }
  };

  const handleUpdateEmployeePresence = async (empId: string, newStatus: EmployeePresenceStatus) => {
    try {
      const now = Date.now();
      await FirestoreService.set<any>(
        COLLECTIONS.EMPLOYEES,
        empId,
        {
          status: newStatus,
          isOnline: newStatus !== 'offline',
          lastHeartbeatAt: now,
          lastActiveAt: now,
        },
        true
      );
      // Run waiting queue processing immediately if employee became available
      if (newStatus === 'available') {
        AutoAssignmentService.processWaitingQueue().catch(() => {});
      }
    } catch (err: any) {
      alert('فشل تحديث حالة الموظف: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  const getRoleBadge = (empRole: UserRole) => {
    switch (empRole) {
      case 'admin':
        return <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold">مدير نظام</span>;
      case 'manager':
        return <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">مدير فريق</span>;
      default:
        return <span className="text-[10px] bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full font-bold">موظف</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">فريق العمل والموظفين</h1>
          <p className="text-xs text-slate-500 mt-1">
            إدارة صلاحيات الموظفين، تعديل بياناتهم سحابياً، والأدوار (Admin / Manager / Employee).
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              resetAddForm();
              setIsAddModalOpen(true);
            }}
          >
            دعوة موظف جديد
          </Button>
        )}
      </div>

      {/* Employees Grid or Empty State */}
      {employees.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-7 h-7" />}
          title="لم تتم إضافة موظفين بعد"
          description="يمكن لمدير النظام دعوة أعضاء الفريق وتعيين أدوارهم وصلاحياتهم وتحديد القنوات التي يمكنهم إدارتها."
          actionLabel={isAdmin ? "دعوة أول موظف" : undefined}
          onAction={() => {
            resetAddForm();
            setIsAddModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Card key={emp.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shadow-sm">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{emp.name}</h4>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-400" />
                      {emp.department}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {getRoleBadge(emp.role)}
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(emp)}
                        title="تعديل بيانات الموظف سحابياً"
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp)}
                        title="حذف الموظف"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{emp.email}</span>
                </div>
                {emp.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span dir="ltr">{emp.phone}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-400">أقصى محادثات: {emp.maxActiveChats || 5}</span>

                  {/* Presence Status Display & Override */}
                  {isAdmin ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={emp.status || (emp.isOnline ? 'available' : 'offline')}
                        onChange={(e) => handleUpdateEmployeePresence(emp.id, e.target.value as EmployeePresenceStatus)}
                        className={`text-[11px] font-bold rounded-lg px-2 py-0.5 border cursor-pointer focus:outline-none transition-colors ${
                          emp.status === 'available' || (emp.isOnline && !emp.status)
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : emp.status === 'busy'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : emp.status === 'away'
                            ? 'bg-orange-50 text-orange-700 border-orange-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                        title="تغيير حالة التواجد (متاح / مشغول / استراحة / غير متصل)"
                      >
                        <option value="available">🟢 متاح</option>
                        <option value="busy">🟡 مشغول</option>
                        <option value="away">🟠 استراحة</option>
                        <option value="offline">⚪ غير متصل</option>
                      </select>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        emp.status === 'available' || (emp.isOnline && !emp.status)
                          ? 'text-emerald-600'
                          : emp.status === 'busy'
                          ? 'text-amber-600'
                          : emp.status === 'away'
                          ? 'text-orange-600'
                          : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          emp.status === 'available' || (emp.isOnline && !emp.status)
                            ? 'bg-emerald-500'
                            : emp.status === 'busy'
                            ? 'bg-amber-500'
                            : emp.status === 'away'
                            ? 'bg-orange-500'
                            : 'bg-slate-300'
                        }`}
                      />
                      {emp.status === 'available' || (emp.isOnline && !emp.status)
                        ? 'متاح'
                        : emp.status === 'busy'
                        ? 'مشغول'
                        : emp.status === 'away'
                        ? 'استراحة'
                        : 'غير متصل'}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD EMPLOYEE MODAL */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-150 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-200">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">دعوة موظف جديد للفريق</h3>
                  <p className="text-[11px] text-slate-400">إضافة عضو جديد وتحديد دوره وقسمه في CRM</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateEmployee} className="p-5 space-y-4 overflow-y-auto">
              {/* Alert if email is already in use in Firebase Auth */}
              {alreadyInUseEmail && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3.5 animate-in fade-in">
                  <div className="flex items-start gap-2.5 text-amber-900 text-xs font-semibold">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-amber-900">
                        البريد ({alreadyInUseEmail}) مسجل مسبقاً في Firebase Auth!
                      </p>
                      <p className="text-[11px] font-normal text-amber-800 mt-1 leading-relaxed">
                        الحساب موجود بالفعل في خوادم Google بكلمة مرور سابقة. اختر الطريقة الأنسب لك للمتابعة فوراً:
                      </p>
                    </div>
                  </div>

                  {/* Option 1: Fast direct save to CRM */}
                  <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-sm">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 block">
                        1. حفظ الموظف في النظام والـ CRM الآن
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        إضافة الموظف فوراً لقائمة الفريق والأقسام بدون انتظار
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleForceSaveEmployeeToCRM}
                      disabled={isSaving}
                      icon={isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      {isSaving ? 'جارٍ الحفظ...' : 'حفظ في CRM فوراً'}
                    </Button>
                  </div>

                  {/* Option 2: 1-click Delete in Firebase Console */}
                  <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-sm">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 block">
                        2. تصفير الحساب في خوادم Google (خلال 5 ثوانٍ)
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        احذف الإيميل القديم من Firebase، ثم اضغط "إضافة الموظف" بالباسورد الجديد
                      </span>
                    </div>
                    <a
                      href="https://console.firebase.google.com/project/crm-awlad-yahya/authentication/users"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors shrink-0 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح Firebase Users</span>
                    </a>
                  </div>

                  {/* Option 3: Send Reset Email with Spam notice */}
                  <div className="pt-2 border-t border-amber-200 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-amber-800">
                      إرسال رابط جديد للإيميل (افحص الـ Spam):
                    </span>
                    <button
                      type="button"
                      disabled={isSendingResetEmail}
                      onClick={() => handleSendResetEmail(alreadyInUseEmail)}
                      className="font-bold text-brand-700 hover:text-brand-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      {isSendingResetEmail ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>إرسال رابط التعيين مجدداً</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: يوسف عبده"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (alreadyInUseEmail) setAlreadyInUseEmail(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كلمة المرور لتسجيل الدخول *
                </label>
                <input
                  type="password"
                  required
                  placeholder="كلمة مرور للدخول (6 خانات على الأقل)"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  سيستخدم الموظف هذه الكلمة مع بريده لتسجيل الدخول إلى المنصة.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / واتساب</label>
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القسم</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                  >
                    <option value="خدمة العملاء">خدمة العملاء</option>
                    <option value="المبيعات">المبيعات</option>
                    <option value="الدعم الفني">الدعم الفني</option>
                    <option value="الإدارة العامة">الإدارة العامة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الدور والصلاحية</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="employee">موظف (Employee)</option>
                    <option value="manager">مدير فريق (Manager)</option>
                    <option value="admin">مدير نظام (Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">أقصى محادثات نشطة</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={maxActiveChats}
                    onChange={(e) => setMaxActiveChats(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSaving}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                >
                  {isSaving ? 'جاري الحفظ...' : 'إضافة الموظف'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT EMPLOYEE MODAL (تعديل بيانات الموظف وتحديثها سحابياً) */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-150 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-200">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">تعديل بيانات الموظف سحابياً</h3>
                  <p className="text-[11px] text-slate-400">تحديث صلاحيات وقسم وبيانات الحساب وحفظها في السحابة</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateEmployee} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / واتساب</label>
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القسم</label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                  >
                    <option value="خدمة العملاء">خدمة العملاء</option>
                    <option value="المبيعات">المبيعات</option>
                    <option value="الدعم الفني">الدعم الفني</option>
                    <option value="الإدارة العامة">الإدارة العامة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الدور والصلاحية</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="employee">موظف (Employee)</option>
                    <option value="manager">مدير فريق (Manager)</option>
                    <option value="admin">مدير نظام (Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">أقصى محادثات نشطة</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editMaxActiveChats}
                    onChange={(e) => setEditMaxActiveChats(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password Management Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-brand-600" />
                    <span className="text-xs font-bold text-slate-800">أمان الحساب وكلمة المرور</span>
                  </div>
                  <button
                    type="button"
                    disabled={isSendingResetEmail}
                    onClick={() => handleSendResetEmail(editEmail)}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1.5 cursor-pointer hover:underline"
                  >
                    {isSendingResetEmail ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>إرسال رابط تعيين كلمة المرور للموظف</span>
                  </button>
                </div>

                {resetEmailSentSuccess && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تم إرسال رابط إعادة تعيين كلمة المرور إلى بريد الموظف بنجاح!</span>
                  </div>
                )}

                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-500 block">
                    أو قم بتعيين كلمة مرور جديدة مباشرة (اختياري):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="password"
                      placeholder="كلمة المرور الحالية..."
                      value={editCurrentPassword}
                      onChange={(e) => setEditCurrentPassword(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                    />
                    <input
                      type="password"
                      placeholder="كلمة المرور الجديدة..."
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSaving}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                >
                  {isSaving ? 'جارٍ التحديث السحابي...' : 'حفظ التعديلات سحابياً'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
