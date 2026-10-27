export interface CountryCodeInfo {
  code: string;       // e.g. '+20'
  dialCode: string;   // e.g. '20'
  nameAr: string;     // e.g. 'مصر'
  flag: string;       // e.g. '🇪🇬'
  example: string;    // e.g. '01012345678'
  digitsLength?: number; // typical national length without leading zero
}

export const SUPPORTED_COUNTRIES: CountryCodeInfo[] = [
  { code: '+20', dialCode: '20', nameAr: 'مصر', flag: '🇪🇬', example: '01012345678', digitsLength: 10 },
  { code: '+966', dialCode: '966', nameAr: 'السعودية', flag: '🇸🇦', example: '0512345678', digitsLength: 9 },
  { code: '+971', dialCode: '971', nameAr: 'الإمارات', flag: '🇦🇪', example: '0501234567', digitsLength: 9 },
  { code: '+965', dialCode: '965', nameAr: 'الكويت', flag: '🇰🇼', example: '91234567', digitsLength: 8 },
  { code: '+974', dialCode: '974', nameAr: 'قطر', flag: '🇶🇦', example: '55123456', digitsLength: 8 },
  { code: '+968', dialCode: '968', nameAr: 'عمان', flag: '🇴🇲', example: '91234567', digitsLength: 8 },
  { code: '+973', dialCode: '973', nameAr: 'البحرين', flag: '🇧🇭', example: '39123456', digitsLength: 8 },
  { code: '+962', dialCode: '962', nameAr: 'الأردن', flag: '🇯🇴', example: '0791234567', digitsLength: 9 },
  { code: '+964', dialCode: '964', nameAr: 'العراق', flag: '🇮🇶', example: '07701234567', digitsLength: 10 },
  { code: '+218', dialCode: '218', nameAr: 'ليبيا', flag: '🇱🇾', example: '0911234567', digitsLength: 9 },
  { code: '+249', dialCode: '249', nameAr: 'السودان', flag: '🇸🇩', example: '0912345678', digitsLength: 9 },
  { code: '+212', dialCode: '212', nameAr: 'المغرب', flag: '🇲🇦', example: '0612345678', digitsLength: 9 },
  { code: '+213', dialCode: '213', nameAr: 'الجزائر', flag: '🇩🇿', example: '0551234567', digitsLength: 9 },
  { code: '+216', dialCode: '216', nameAr: 'تونس', flag: '🇹🇳', example: '21234567', digitsLength: 8 },
  { code: '+1', dialCode: '1', nameAr: 'أمريكا / كندا', flag: '🇺🇸', example: '4155552671', digitsLength: 10 },
  { code: '+44', dialCode: '44', nameAr: 'المملكة المتحدة', flag: '🇬🇧', example: '07911123456', digitsLength: 10 },
  { code: '+90', dialCode: '90', nameAr: 'تركيا', flag: '🇹🇷', example: '05321234567', digitsLength: 10 },
  { code: '+49', dialCode: '49', nameAr: 'ألمانيا', flag: '🇩🇪', example: '015112345678', digitsLength: 10 },
];

export interface NormalizedPhoneResult {
  formatted: string;       // International standard with '+' (e.g. '+201012345678')
  cleanDigits: string;     // Digits only without '+' (e.g. '201012345678')
  countryCode: string;     // e.g. '+20'
  nationalNumber: string;  // e.g. '1012345678'
  isValid: boolean;        // Whether the number looks structurally valid
  rawInput: string;
}

/**
 * Normalizes phone numbers from Excel / CSV or manual inputs
 * Handles:
 *  - Excel stripping leading zero: '1012345678' -> '+201012345678' (for Egypt)
 *  - 00 prefix: '00201012345678' -> '+201012345678'
 *  - Without plus: '201012345678' -> '+201012345678'
 *  - Local numbers: '01012345678' -> '+201012345678' (uses selected defaultCountryCode)
 *  - Preserves other country codes if already present
 */
export function normalizePhoneNumber(
  rawInput: string | number | undefined | null,
  defaultCountryCode = '+20'
): NormalizedPhoneResult {
  if (rawInput === undefined || rawInput === null) {
    return {
      formatted: '',
      cleanDigits: '',
      countryCode: defaultCountryCode,
      nationalNumber: '',
      isValid: false,
      rawInput: '',
    };
  }

  const rawStr = String(rawInput).trim();
  if (!rawStr) {
    return {
      formatted: '',
      cleanDigits: '',
      countryCode: defaultCountryCode,
      nationalNumber: '',
      isValid: false,
      rawInput: '',
    };
  }

  // Convert eastern arabic numerals (٠-٩) to western (0-9)
  const convertedStr = rawStr.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

  // Remove whitespace, dashes, parens, dots, slashes
  let cleaned = convertedStr.replace(/[\s\-\(\)\.\/\\]/g, '');

  // Handle leading '00' international prefix
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // Digits only representation
  const digitsOnly = cleaned.replace(/\D/g, '');

  if (!digitsOnly) {
    return {
      formatted: cleaned,
      cleanDigits: '',
      countryCode: defaultCountryCode,
      nationalNumber: '',
      isValid: false,
      rawInput: rawStr,
    };
  }

  const cleanDefaultCode = defaultCountryCode.startsWith('+')
    ? defaultCountryCode
    : `+${defaultCountryCode}`;
  const defaultDial = cleanDefaultCode.replace('+', '');

  // 1. If explicit '+' prefix is present
  if (cleaned.startsWith('+')) {
    // Check known countries
    for (const country of SUPPORTED_COUNTRIES) {
      if (digitsOnly.startsWith(country.dialCode)) {
        const national = digitsOnly.slice(country.dialCode.length);
        return {
          formatted: `+${digitsOnly}`,
          cleanDigits: digitsOnly,
          countryCode: country.code,
          nationalNumber: national,
          isValid: national.length >= 6 && national.length <= 13,
          rawInput: rawStr,
        };
      }
    }
    // Generic with '+'
    return {
      formatted: `+${digitsOnly}`,
      cleanDigits: digitsOnly,
      countryCode: `+${digitsOnly.slice(0, 3)}`,
      nationalNumber: digitsOnly.slice(3),
      isValid: digitsOnly.length >= 8 && digitsOnly.length <= 15,
      rawInput: rawStr,
    };
  }

  // 2. Check if digitsOnly already starts with a known country dialCode (e.g., starts with '201...', '9665...')
  // Priority: match against selected defaultCountryCode first if matching
  if (digitsOnly.startsWith(defaultDial) && digitsOnly.length > defaultDial.length + 5) {
    const national = digitsOnly.slice(defaultDial.length);
    return {
      formatted: `+${digitsOnly}`,
      cleanDigits: digitsOnly,
      countryCode: cleanDefaultCode,
      nationalNumber: national,
      isValid: national.length >= 6 && national.length <= 12,
      rawInput: rawStr,
    };
  }

  // Match against other countries dial codes (longer dial codes first)
  const sortedCountries = [...SUPPORTED_COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );
  for (const country of sortedCountries) {
    if (digitsOnly.startsWith(country.dialCode) && digitsOnly.length >= country.dialCode.length + 7) {
      const national = digitsOnly.slice(country.dialCode.length);
      return {
        formatted: `+${digitsOnly}`,
        cleanDigits: digitsOnly,
        countryCode: country.code,
        nationalNumber: national,
        isValid: national.length >= 6 && national.length <= 12,
        rawInput: rawStr,
      };
    }
  }

  // 3. Handle Local Egyptian formats specifically (since Egypt is primary)
  if (cleanDefaultCode === '+20') {
    // Case A: 11 digits starting with 01 (010, 011, 012, 015)
    if (digitsOnly.startsWith('01') && digitsOnly.length === 11) {
      const national = digitsOnly.slice(1); // '1012345678'
      return {
        formatted: `+20${national}`,
        cleanDigits: `20${national}`,
        countryCode: '+20',
        nationalNumber: national,
        isValid: true,
        rawInput: rawStr,
      };
    }

    // Case B: Excel stripped leading zero! 10 digits starting with '1' (10, 11, 12, 15)
    if (
      digitsOnly.length === 10 &&
      (digitsOnly.startsWith('10') ||
        digitsOnly.startsWith('11') ||
        digitsOnly.startsWith('12') ||
        digitsOnly.startsWith('15'))
    ) {
      return {
        formatted: `+20${digitsOnly}`,
        cleanDigits: `20${digitsOnly}`,
        countryCode: '+20',
        nationalNumber: digitsOnly,
        isValid: true,
        rawInput: rawStr,
      };
    }
  }

  // 4. Handle Saudi format when default is +966
  if (cleanDefaultCode === '+966') {
    // 05XXXXXXXX (10 digits)
    if (digitsOnly.startsWith('05') && digitsOnly.length === 10) {
      const national = digitsOnly.slice(1);
      return {
        formatted: `+966${national}`,
        cleanDigits: `966${national}`,
        countryCode: '+966',
        nationalNumber: national,
        isValid: true,
        rawInput: rawStr,
      };
    }
    // Excel stripped 0: 5XXXXXXXX (9 digits)
    if (digitsOnly.startsWith('5') && digitsOnly.length === 9) {
      return {
        formatted: `+966${digitsOnly}`,
        cleanDigits: `966${digitsOnly}`,
        countryCode: '+966',
        nationalNumber: digitsOnly,
        isValid: true,
        rawInput: rawStr,
      };
    }
  }

  // 5. Generic local number with leading '0'
  if (digitsOnly.startsWith('0')) {
    const national = digitsOnly.slice(1);
    const full = `${defaultDial}${national}`;
    return {
      formatted: `+${full}`,
      cleanDigits: full,
      countryCode: cleanDefaultCode,
      nationalNumber: national,
      isValid: national.length >= 7 && national.length <= 11,
      rawInput: rawStr,
    };
  }

  // 6. Generic number without leading zero, prepend default country code
  const full = `${defaultDial}${digitsOnly}`;
  return {
    formatted: `+${full}`,
    cleanDigits: full,
    countryCode: cleanDefaultCode,
    nationalNumber: digitsOnly,
    isValid: digitsOnly.length >= 7 && digitsOnly.length <= 11,
    rawInput: rawStr,
  };
}
