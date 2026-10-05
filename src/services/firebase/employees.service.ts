import { orderBy, type Unsubscribe } from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import type { Employee } from '../../types/employee.types';

export class EmployeesService {
  static subscribeToEmployees(
    callback: (employees: Employee[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return FirestoreService.subscribe<Employee>(
      COLLECTIONS.EMPLOYEES,
      [orderBy('name', 'asc')],
      callback,
      onError
    );
  }

  static async getEmployee(id: string): Promise<Employee | null> {
    return FirestoreService.getById<Employee>(COLLECTIONS.EMPLOYEES, id);
  }

  static async saveEmployee(employee: Employee): Promise<void> {
    await FirestoreService.set<Employee>(COLLECTIONS.EMPLOYEES, employee.id, employee);
  }
}
