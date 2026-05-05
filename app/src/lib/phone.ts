import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const toE164 = (raw: string, defaultCountry: 'IT' = 'IT'): string | null => {
  if (!raw || !raw.trim()) return null;
  try {
    const p = parsePhoneNumberFromString(raw.trim(), defaultCountry);
    if (!p || !p.isValid()) return null;
    return p.number;
  } catch {
    return null;
  }
};
