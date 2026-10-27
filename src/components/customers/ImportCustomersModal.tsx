import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Globe,
  Tag,
  RefreshCw,
  PhoneCall,
  Info,
} from 'lucide-react';
import { Button } from '../common/Button';
import {
  parseCustomerExcel,
  downloadSampleExcelTemplate,
  type ParseExcelResult,
} from '../../utils/excelCustomerUtils';
import { SUPPORTED_COUNTRIES } from '../../utils/phoneUtils';
import { CustomersService } from '../../services/firebase/customers.service';
import type { LeadStatus } from '../../types/customer.types';

interface ImportCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const ImportCustomersModal: React.FC<ImportCustomersModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseExcelResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Settings
  const [defaultCountryCode, setDefaultCountryCode] = useState('+20');
  const [defaultLeadStatus, setDefaultLeadStatus] = useState<LeadStatus>('new');
  const [defaultChannel, setDefaultChannel] = useState('whatsapp');
  const [additionalTag, setAdditionalTag] = useState('استيراد_اكسل');
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  // Progress
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [importCompleted, setImportCompleted] = useState<{
    added: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  if (!isOpen) return null;

  // Handler for file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);
    setImportCompleted(null);

    try {
      const buffer = await file.arrayBuffer();
      setFileBuffer(buffer);
      const result = await parseCustomerExcel(buffer, file.name, {
        defaultCountryCode,
        defaultLeadStatus,
        defaultChannel,
        additionalTag,
      });
      setParseResult(result);
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      setParseError(err.message || 'حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من صيغة الملف.');
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  // Re-run parser if options change and buffer exists
  const handleCountryCodeChange = async (newCode: string) => {
    setDefaultCountryCode(newCode);
    if (fileBuffer && selectedFile) {
      setIsParsing(true);
      try {
        const result = await parseCustomerExcel(fileBuffer, selectedFile.name, {
          defaultCountryCode: newCode,
          defaultLeadStatus,
          defaultChannel,
          additionalTag,
        });
        setParseResult(result);
      } catch (err: any) {
        setParseError(err.message);
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleLeadStatusChange = async (newStatus: LeadStatus) => {
    setDefaultLeadStatus(newStatus);
    if (fileBuffer && selectedFile) {
      const result = await parseCustomerExcel(fileBuffer, selectedFile.name, {
        defaultCountryCode,
        defaultLeadStatus: newStatus,
        defaultChannel,
        additionalTag,
      });
      setParseResult(result);
    }
  };

  const handleChannelChange = async (newChannel: string) => {
    setDefaultChannel(newChannel);
    if (fileBuffer && selectedFile) {
      const result = await parseCustomerExcel(fileBuffer, selectedFile.name, {
        defaultCountryCode,
        defaultLeadStatus,
        defaultChannel: newChannel,
        additionalTag,
      });
      setParseResult(result);
    }
  };

  // Drag & drop handlers
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Confirm and start import into Firestore
  const handleStartImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) return;

    setIsImporting(true);
    setImportProgress({ done: 0, total: parseResult.rows.length });

    try {
      const result = await CustomersService.importBatchCustomers(parseResult.rows, {
        overwriteExisting,
        onProgress: (done, total) => {
          setImportProgress({ done, total });
        },
      });

      setImportCompleted(result);
      onSuccess(result.added + result.updated);
    } catch (err: any) {
      alert(`حدث خطأ أثناء الحفظ السحابي: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetModal = () => {
    setSelectedFile(null);
    setFileBuffer(null);
    setParseResult(null);
    setParseError(null);
    setImportCompleted(null);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>استيراد العملاء والـ Leads من Excel</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  .xlsx / .xls / .csv
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تنظيم وتنسيق أرقام الهواتف بكود الدولة تلقائياً وإضافتها لسجل الـ CRM
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={downloadSampleExcelTemplate}
              className="text-xs"
            >
              تحميل نموذج Excel جاهز
            </Button>
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Success state after completion */}
          {importCompleted ? (
            <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-950">
                  تم استيراد بيانات العملاء بنجاح!
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  تمت مزامنة كافة السجلات في قاعدة بيانات CRM وتنسيق أرقام الهواتف بالأكواد الدولية.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto pt-2">
                <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-sm">
                  <span className="text-[11px] text-slate-500 block font-medium">تمت إضافتهم كجدد</span>
                  <span className="text-xl font-black text-emerald-600">{importCompleted.added}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-sm">
                  <span className="text-[11px] text-slate-500 block font-medium">تم تحديث بياناتهم</span>
                  <span className="text-xl font-black text-blue-600">{importCompleted.updated}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-sm">
                  <span className="text-[11px] text-slate-500 block font-medium">تم تخطيهم (تكرار)</span>
                  <span className="text-xl font-black text-slate-600">{importCompleted.skipped}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-sm">
                  <span className="text-[11px] text-slate-500 block font-medium">فشل الاستيراد</span>
                  <span className="text-xl font-black text-red-500">{importCompleted.failed}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    handleResetModal();
                    onClose();
                  }}
                >
                  إغلاق وعرض العملاء في الجدول
                </Button>
                <Button type="button" variant="outline" onClick={handleResetModal}>
                  استيراد ملف آخر
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* File Dropzone & Configuration Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Column 1 & 2: Dropzone / Selected File */}
                <div className="lg:col-span-2 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    ملف الإكسل أو الـ CSV *
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {!selectedFile ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-emerald-500/80 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white group-hover:bg-emerald-50 border border-slate-200 group-hover:border-emerald-200 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-sm">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="mt-1">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 block">
                          اضغط هنا لاختيار شيت الإكسل، أو اسحب الملف وأفلته
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          يدعم ملفات .xlsx و .xls و .csv (باللغة العربية والإنجليزية)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 block truncate">
                            {selectedFile.name}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            الحجم: {(selectedFile.size / 1024).toFixed(1)} كيلوبايت
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isParsing || isImporting}
                        >
                          تغيير الملف
                        </Button>
                      </div>
                    </div>
                  )}

                  {parseError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}
                </div>

                {/* Column 3: Normalization & Country Code Settings */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Globe className="w-4 h-4 text-brand-600 shrink-0" />
                    <span className="font-bold text-xs text-slate-800">إعدادات كود الدولة التلقائي</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      كود الدولة الافتراضي للأرقام المحلية *
                    </label>
                    <select
                      value={defaultCountryCode}
                      onChange={(e) => handleCountryCodeChange(e.target.value)}
                      disabled={isParsing || isImporting}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      {SUPPORTED_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.nameAr} ({c.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      💡 الأرقام المحلية التي تبدأ بـ 0 (أو التي حذف الإكسل منها الصفر الأول) سيتم دمجها مع هذا الكود تلقائياً.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      حالة الـ Lead الافتراضية
                    </label>
                    <select
                      value={defaultLeadStatus}
                      onChange={(e) => handleLeadStatusChange(e.target.value as LeadStatus)}
                      disabled={isParsing || isImporting}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      <option value="new">جديد (New)</option>
                      <option value="contacted">تم التواصل (Contacted)</option>
                      <option value="qualified">مهتم / مؤهل (Qualified)</option>
                      <option value="proposal">تم تقديم عرض (Proposal)</option>
                      <option value="won">صفقة ناجحة (Won)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      القناة / المصدر الافتراضي
                    </label>
                    <select
                      value={defaultChannel}
                      onChange={(e) => handleChannelChange(e.target.value)}
                      disabled={isParsing || isImporting}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      <option value="whatsapp">واتساب (WhatsApp)</option>
                      <option value="facebook">فيسبوك (Facebook)</option>
                      <option value="instagram">انستجرام (Instagram)</option>
                      <option value="website">الموقع الإلكتروني (Website)</option>
                      <option value="campaign">حملة تسويقية (Marketing)</option>
                      <option value="excel_import">استيراد إكسل (Excel Import)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      وسم إضافي للعملاء المستوردين
                    </label>
                    <div className="relative">
                      <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="مثال: حملة_أكتوبر"
                        value={additionalTag}
                        onChange={(e) => setAdditionalTag(e.target.value)}
                        disabled={isParsing || isImporting}
                        className="w-full pr-8 pl-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overwriteExisting}
                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                        disabled={isParsing || isImporting}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-[11px] text-slate-700 font-medium">
                        تحديث بيانات العميل إذا كان مسجلاً مسبقاً بنفس الهاتف
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                  <span>جارٍ قراءة بيانات ملف الإكسل ومعالجة أرقام الهواتف...</span>
                </div>
              )}

              {/* Preview Table & Metrics */}
              {parseResult && !isParsing && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Metric Chips */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-bold text-slate-800">
                        إجمالي السجلات: <span className="text-brand-600 font-black">{parseResult.totalRows}</span>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        أرقام صالحة بكود الدولة: {parseResult.validPhonesCount}
                      </span>
                      {parseResult.warningsCount > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            تنبيهات بأرقام غير مكتملة: {parseResult.warningsCount}
                          </span>
                        </>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500">
                      معاينة لأول {Math.min(parseResult.rows.length, 10)} صفوف
                    </span>
                  </div>

                  {/* Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 w-10">#</th>
                          <th className="p-2.5">اسم العميل</th>
                          <th className="p-2.5">الهاتف المنسق بكود الدولة</th>
                          <th className="p-2.5">الرقم الأصلي</th>
                          <th className="p-2.5">البريد</th>
                          <th className="p-2.5">حالة الـ Lead</th>
                          <th className="p-2.5">المدينة</th>
                          <th className="p-2.5">الوسوم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parseResult.rows.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                              {row.rowNumber}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">{row.name}</td>
                            <td className="p-2.5">
                              {row.phoneNormalized ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-[11px] border border-emerald-200/60" dir="ltr">
                                  <PhoneCall className="w-3 h-3 text-emerald-500" />
                                  {row.phoneNormalized}
                                </span>
                              ) : (
                                <span className="text-amber-600 text-[10px]">بدون رقم</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-400 font-mono text-[11px]" dir="ltr">
                              {row.phoneRaw || '-'}
                            </td>
                            <td className="p-2.5 text-slate-600">{row.email || '-'}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {row.leadStatus}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-600">{row.city || '-'}</td>
                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {row.tags.slice(0, 2).map((t, ti) => (
                                  <span
                                    key={ti}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600"
                                  >
                                    #{t}
                                  </span>
                                ))}
                                {row.tags.length > 2 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{row.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Informational tip */}
                  <div className="p-2.5 bg-brand-50/60 border border-brand-200/60 rounded-xl flex items-start gap-2 text-[11px] text-brand-900">
                    <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                    <span>
                      بمجرد استيراد العملاء، سيتعرف نظام الـ CRM وبوابة الواتساب على هؤلاء العملاء تلقائياً عند مراسلتهم للرقم، وسيظهر تاريخهم وبياناتهم فوراً في شاشة المحادثات.
                    </span>
                  </div>
                </div>
              )}

              {/* Importing progress bar */}
              {isImporting && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                      <span>جارٍ استيراد بيانات العملاء وحفظها سحابياً في Firestore...</span>
                    </span>
                    <span>
                      {importProgress.done} من {importProgress.total} (
                      {Math.round((importProgress.done / (importProgress.total || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-brand-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (importProgress.done / (importProgress.total || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!importCompleted && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {parseResult ? (
                <>جاهز للاستيراد: <strong className="text-slate-800">{parseResult.rows.length} عميل</strong></>
              ) : (
                'يرجى اختيار ملف إكسل للمتابعة'
              )}
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isImporting}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!parseResult || parseResult.rows.length === 0 || isImporting || isParsing}
                onClick={handleStartImport}
                icon={isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              >
                {isImporting ? 'جارٍ الاستيراد...' : `بدء استيراد ${parseResult?.rows.length || ''} عميل`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
