import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Filter } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Card } from '../../components/common/Card';
import { CustomersService } from '../../services/firebase/customers.service';
import type { Customer } from '../../types/customer.types';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const unsubscribe = CustomersService.subscribeToCustomers(
      (data) => {
        setCustomers(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching customers:', err);
        setError('تعذر تحميل سجل العملاء من قاعدة البيانات.');
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">إدارة العملاء والـ Leads</h1>
          <p className="text-xs text-slate-500 mt-1">
            سجل شامل ببيانات العملاء، وتاريخ المحادثات والأنشطة والوسوم.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" icon={<UserPlus className="w-4 h-4" />}>
            إضافة عميل جديد
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف أو البريد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />}>
              تصفية حسب الحالة
            </Button>
          </div>
        </div>
      </Card>

      {/* Customers List or Empty State */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">
          جاري تحميل بيانات العملاء...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title={search ? 'لم يتم العثور على نتائج مطابقة' : 'لم يتم إضافة عملاء بعد'}
          description={
            search
              ? 'جرّب البحث بكلمات أخرى أو مسح حقل البحث.'
              : 'عندما يبدأ أي عميل محادثة عبر واتساب أو ماسنجر أو الموقع، أو عند إضافة عميل يدويًا، سيتم تسجيله وتوثيق كل تفاعلاته هنا في Firestore.'
          }
          actionLabel={search ? 'مسح البحث' : 'إضافة أول عميل'}
          onAction={() => (search ? setSearch('') : alert('جاهز للربط مع فورم إضافة العميل'))}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">الاسم</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">حالة الـ Lead</th>
                  <th className="p-3">القناة الأولى</th>
                  <th className="p-3">تاريخ الإضافة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold">{c.name}</td>
                    <td className="p-3 text-slate-500">{c.phone || '-'}</td>
                    <td className="p-3">{c.leadStatus}</td>
                    <td className="p-3">{c.sourceChannel}</td>
                    <td className="p-3 text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
