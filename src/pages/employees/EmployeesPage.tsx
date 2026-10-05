import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Card } from '../../components/common/Card';
import { EmployeesService } from '../../services/firebase/employees.service';
import type { Employee } from '../../types/employee.types';
import { useAuth } from '../../hooks/useAuth';

export const EmployeesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    const unsub = EmployeesService.subscribeToEmployees((data) => setEmployees(data));
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">فريق العمل والموظفين</h1>
          <p className="text-xs text-slate-500 mt-1">
            إدارة صلاحيات الموظفين، الأدوار (Admin / Manager / Employee) وتوزيع المحادثات.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" size="sm" icon={<UserPlus className="w-4 h-4" />}>
            دعوة موظف جديد
          </Button>
        )}
      </div>

      {employees.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-7 h-7" />}
          title="لم تتم إضافة موظفين بعد"
          description="يمكن لمدير النظام دعوة أعضاء الفريق وتعيين أدوارهم وصلاحياتهم وتحديد القنوات التي يمكنهم إدارتها."
          actionLabel={isAdmin ? "دعوة أول موظف" : undefined}
          onAction={() => alert('هيكل إدارة الموظفين مهيأ في Firestore')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Card key={emp.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
                  {emp.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">{emp.name}</h4>
                  <p className="text-[11px] text-slate-400">{emp.email}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
