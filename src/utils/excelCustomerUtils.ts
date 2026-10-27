import * as XLSX from 'xlsx';
import { normalizePhoneNumber } from './phoneUtils';
import type { Customer, LeadStatus } from '../types/customer.types';

export interface ParsedCustomerRow {
  name: string;
  phoneRaw: string;
  phoneNormalized: string;
  phoneCleanDigits: string;
  isPhoneValid: boolean;
  countryCode: string;
  email?: string;
  leadStatus: LeadStatus;
  sourceChannel: string;
  city?: string;
  country?: string;
  tags: string[];
  notes?: string;
  rowNumber: number;
  originalData: Record<string, any>;
  hasWarning?: boolean;
  warningMessage?: string;
}

export interface ParseExcelOptions {
  defaultCountryCode?: string;
  defaultLeadStatus?: LeadStatus;
  defaultChannel?: string;
  additionalTag?: string;
}

export interface ParseExcelResult {
  rows: ParsedCustomerRow[];
  totalRows: number;
  validPhonesCount: number;
  warningsCount: number;
  fileName: string;
  headers: string[];
}

/**
 * Standardizes common Arabic and English column header names
 */
function findColumnValue(row: Record<string, any>, possibleKeys: string[]): any {
  const rowKeys = Object.keys(row);
  for (const pKey of possibleKeys) {
    const cleanPKey = pKey.trim().toLowerCase();
    const foundKey = rowKeys.find((k) => k.trim().toLowerCase() === cleanPKey);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return row[foundKey];
    }
  }

  // Partial substring match if exact not found
  for (const pKey of possibleKeys) {
    const cleanPKey = pKey.trim().toLowerCase();
    const foundKey = rowKeys.find((k) => k.trim().toLowerCase().includes(cleanPKey));
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return row[foundKey];
    }
  }

  return undefined;
}

/**
 * Maps Lead Status from Arabic or English text
 */
function detectLeadStatus(rawVal: any, fallback: LeadStatus = 'new'): LeadStatus {
  if (!rawVal) return fallback;
  const str = String(rawVal).trim().toLowerCase();

  if (str.includes('جديد') || str === 'new') return 'new';
  if (str.includes('تواصل') || str.includes('تم التواصل') || str === 'contacted') return 'contacted';
  if (str.includes('مهتم') || str.includes('مؤهل') || str === 'qualified' || str.includes('interested')) return 'qualified';
  if (str.includes('عرض') || str === 'proposal') return 'proposal';
  if (str.includes('صفقة') || str.includes('ناجح') || str.includes('رابح') || str === 'won') return 'won';
  if (str.includes('خاسر') || str.includes('ملغي') || str.includes('غير مهتم') || str === 'lost') return 'lost';

  return fallback;
}

/**
 * Parses an Excel or CSV ArrayBuffer/File
 */
export async function parseCustomerExcel(
  fileData: ArrayBuffer,
  fileName: string,
  options: ParseExcelOptions = {}
): Promise<ParseExcelResult> {
  const defaultCountryCode = options.defaultCountryCode || '+20';
  const defaultLeadStatus = options.defaultLeadStatus || 'new';
  const defaultChannel = options.defaultChannel || 'whatsapp';
  const additionalTag = options.additionalTag?.trim();

  const workbook = XLSX.read(fileData, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('الملف فارغ أو لا يحتوي على صفحات عمل.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  // Parse rows as raw objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false, // Reads formatted strings to avoid scientific notation on big phone numbers
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('لم يتم العثور على أي صفوف أو بيانات داخل ملف الإكسل.');
  }

  const headers = Object.keys(rawRows[0] || {});

  const parsedRows: ParsedCustomerRow[] = [];
  let validPhonesCount = 0;
  let warningsCount = 0;

  rawRows.forEach((row, index) => {
    // 1. Name detection
    const rawName = findColumnValue(row, [
      'اسم العميل',
      'الاسم',
      'الاسم بالكامل',
      'اسم',
      'name',
      'customer name',
      'full name',
      'client',
    ]);
    const name = rawName ? String(rawName).trim() : `عميل ${index + 1}`;

    // 2. Phone detection
    const rawPhone = findColumnValue(row, [
      'رقم الهاتف',
      'الهاتف',
      'الموبايل',
      'الجوال',
      'تليفون',
      'الرقم',
      'phone',
      'mobile',
      'phone number',
      'mobile number',
      'tel',
      'whatsapp',
      'واتساب',
    ]);

    // Optional country code column
    const rawCountryCode = findColumnValue(row, [
      'كود الدولة',
      'مفتاح الدولة',
      'الدولة',
      'country code',
      'code',
    ]);

    const activeDefaultCode = rawCountryCode ? String(rawCountryCode).trim() : defaultCountryCode;
    const phoneResult = normalizePhoneNumber(rawPhone, activeDefaultCode);

    if (phoneResult.isValid) {
      validPhonesCount++;
    }

    // 3. Email
    const rawEmail = findColumnValue(row, [
      'البريد الإلكتروني',
      'البريد',
      'الايميل',
      'email',
      'e-mail',
      'mail',
    ]);
    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : undefined;

    // 4. Lead Status
    const rawStatus = findColumnValue(row, [
      'حالة الـ lead',
      'الحالة',
      'حالة العميل',
      'lead status',
      'status',
      'stage',
    ]);
    const leadStatus = detectLeadStatus(rawStatus, defaultLeadStatus);

    // 5. Source / Channel
    const rawChannel = findColumnValue(row, [
      'القناة',
      'المصدر',
      'قناة التواصل',
      'channel',
      'source',
      'platform',
    ]);
    const sourceChannel = rawChannel ? String(rawChannel).trim().toLowerCase() : defaultChannel;

    // 6. City / Governorate
    const rawCity = findColumnValue(row, [
      'المدينة',
      'المحافظة',
      'city',
      'governorate',
      'address',
      'العنوان',
    ]);
    const city = rawCity ? String(rawCity).trim() : undefined;

    // 7. Tags
    const rawTags = findColumnValue(row, ['الوسوم', 'التاجات', 'التصنيف', 'tags', 'labels']);
    const tagsSet = new Set<string>();
    if (rawTags) {
      String(rawTags)
        .split(/[,،;|]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => tagsSet.add(t));
    }
    if (additionalTag) {
      tagsSet.add(additionalTag);
    }
    if (sourceChannel) {
      tagsSet.add(sourceChannel);
    }
    const tags = Array.from(tagsSet);

    // 8. Notes
    const rawNotes = findColumnValue(row, ['ملاحظات', 'الملاحظات', 'تفاصيل', 'notes', 'remarks', 'note']);
    const notes = rawNotes ? String(rawNotes).trim() : undefined;

    // Warnings detection
    let hasWarning = false;
    let warningMessage = '';

    if (!rawPhone || !phoneResult.cleanDigits) {
      hasWarning = true;
      warningMessage = 'لا يوجد رقم هاتف في هذا الصف.';
      warningsCount++;
    } else if (!phoneResult.isValid) {
      hasWarning = true;
      warningMessage = 'صيغة رقم الهاتف قد تكون غير مكتملة.';
      warningsCount++;
    }

    parsedRows.push({
      name,
      phoneRaw: String(rawPhone || ''),
      phoneNormalized: phoneResult.formatted,
      phoneCleanDigits: phoneResult.cleanDigits,
      isPhoneValid: phoneResult.isValid,
      countryCode: phoneResult.countryCode,
      email,
      leadStatus,
      sourceChannel,
      city,
      country: phoneResult.countryCode,
      tags,
      notes,
      rowNumber: index + 2, // Account for header row in Excel
      originalData: row,
      hasWarning,
      warningMessage,
    });
  });

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validPhonesCount,
    warningsCount,
    fileName,
    headers,
  };
}

/**
 * Downloads a pre-formatted Excel template for the user
 */
export function downloadSampleExcelTemplate(): void {
  const sampleData = [
    {
      'اسم العميل': 'محمد علي إبراهيم',
      'رقم الهاتف': '01012345678',
      'البريد الإلكتروني': 'mohamed.ali@example.com',
      'حالة الـ Lead': 'جديد',
      'المصدر': 'واتساب',
      'المدينة': 'القاهرة',
      'الوسوم': 'عميل_محتمل, حملة_أكتوبر',
      'ملاحظات': 'مهتم بعروض المنتجات ويريد قائمة الأسعار',
    },
    {
      'اسم العميل': 'سارة أحمد محمود',
      'رقم الهاتف': '01298765432',
      'البريد الإلكتروني': 'sara.ahmed@example.com',
      'حالة الـ Lead': 'تم التواصل',
      'المصدر': 'إعلانات فيسبوك',
      'المدينة': 'الجيزة',
      'الوسوم': 'متابعة_عاجلة',
      'ملاحظات': 'طلبت إعادة الاتصال بها مساءً',
    },
    {
      'اسم العميل': 'عبدالله الشمري',
      'رقم الهاتف': '0501234567',
      'البريد الإلكتروني': 'abdullah@example.com',
      'حالة الـ Lead': 'مهتم',
      'المصدر': 'الموقع الإلكتروني',
      'المدينة': 'الرياض',
      'الوسوم': 'عميل_VIP',
      'ملاحظات': 'استفسار عن الشحن الدولي',
    },
    {
      'اسم العميل': 'خالد المنصوري',
      'رقم الهاتف': '+971501234567',
      'البريد الإلكتروني': 'khaled@example.ae',
      'حالة الـ Lead': 'مؤهل',
      'المصدر': 'حملة تيك توك',
      'المدينة': 'دبي',
      'الوسوم': 'تسجيل_جديد',
      'ملاحظات': 'يرغب في مقابلة ممثل المبيعات',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for comfortable viewing in Excel
  ws['!cols'] = [
    { wch: 22 }, // اسم العميل
    { wch: 18 }, // رقم الهاتف
    { wch: 26 }, // البريد الإلكتروني
    { wch: 15 }, // حالة الـ Lead
    { wch: 16 }, // المصدر
    { wch: 14 }, // المدينة
    { wch: 25 }, // الوسوم
    { wch: 40 }, // ملاحظات
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'العملاء المستهدفين');

  XLSX.writeFile(wb, 'نموذج_استيراد_بيانات_العملاء_CRM.xlsx');
}

/**
 * Exports current customers to an organized Excel file
 */
export function exportCustomersToExcel(customers: Customer[], fileNamePrefix = 'قائمة_العملاء'): void {
  const exportRows = customers.map((c, index) => ({
    '#': index + 1,
    'اسم العميل': c.name || '-',
    'رقم الهاتف الدولي': c.phone || '-',
    'البريد الإلكتروني': c.email || '-',
    'حالة الـ Lead': c.leadStatus || 'new',
    'القناة الأولى': c.sourceChannel || 'whatsapp',
    'المدينة': c.city || '-',
    'الموظف المسؤول': c.assignedEmployeeName || 'غير مسند',
    'الوسوم': (c.tags || []).join('، '),
    'تاريخ التسجيل': c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-EG') : '-',
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 24 },
    { wch: 20 },
    { wch: 26 },
    { wch: 15 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 24 },
    { wch: 15 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'العملاء');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${fileNamePrefix}_${todayStr}.xlsx`);
}
