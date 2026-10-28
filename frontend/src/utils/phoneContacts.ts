// src/utils/phoneContacts.ts
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface RawContactItem {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string;
}

interface RachAppContactsPluginInterface {
  getContacts(): Promise<{
    contacts?: Array<{ name?: string; phone?: string }>;
    status?: string;
  }>;
}

const RachAppContacts = registerPlugin<RachAppContactsPluginInterface>('RachAppContacts');

const CONTACTS_CACHE_KEY = 'rachapp_phone_contacts_cache';

export function cleanBrazilPhone(raw?: string | null): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0055') && digits.length > 12) {
    digits = digits.slice(4);
  } else if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  while (digits.length > 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

export function formatPhoneDisplay(digits?: string | null): string {
  if (!digits) return '';
  const d = cleanBrazilPhone(digits);
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return digits;
}

export function normalizeRawContacts(
  rawList: Array<{ name?: string; phone?: string }>
): RawContactItem[] {
  const seen = new Set<string>();
  const normalized: RawContactItem[] = [];

  rawList.forEach((item, idx) => {
    const rawName = (item.name || '').trim();
    const rawPhone = (item.phone || '').trim();
    const cleanPhone = cleanBrazilPhone(rawPhone);
    if (!rawName && !cleanPhone) return;

    const dedupKey = `${rawName.toLowerCase()}|${cleanPhone.slice(-8)}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    normalized.push({
      id: `contact-${idx}-${cleanPhone || rawName}`,
      name: rawName || formatPhoneDisplay(cleanPhone) || 'Contato sem nome',
      phone: rawPhone,
      cleanPhone,
    });
  });

  normalized.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return normalized;
}

export function getCachedPhoneContacts(): RawContactItem[] {
  try {
    const raw = localStorage.getItem(CONTACTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeRawContacts(parsed);
  } catch {
    return [];
  }
}

export function saveCachedPhoneContacts(contacts: RawContactItem[]): void {
  try {
    const minimal = contacts.map((c) => ({ name: c.name, phone: c.cleanPhone || c.phone }));
    localStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(minimal));
  } catch {
    // ignore storage errors
  }
}

export function hasWebContactPickerSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).contacts?.select === 'function'
  );
}

export function hasNativeAndroidContactsSupport(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.AndroidReceiptBridge?.requestContacts === 'function') return true;
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('RachAppContacts')) return true;
  return false;
}

export function isOutdatedNativeApkWithoutContacts(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Capacitor.isNativePlatform() &&
    !hasNativeAndroidContactsSupport() &&
    !hasWebContactPickerSupport()
  );
}

export async function requestDeviceContacts(): Promise<{
  contacts: RawContactItem[];
  status: 'ok' | 'permission_denied' | 'unsupported_apk' | 'unsupported_browser' | 'cancelled' | 'error';
}> {
  // 1. Tenta via Capacitor Plugin nativo (RachAppContacts) - dispara o diálogo nativo de permissão do Android
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await RachAppContacts.getContacts();
      if (res && res.status === 'permission_denied') {
        return { contacts: [], status: 'permission_denied' };
      }
      if (res && Array.isArray(res.contacts)) {
        const list = normalizeRawContacts(res.contacts);
        saveCachedPhoneContacts(list);
        return { contacts: list, status: 'ok' };
      }
    } catch {
      // Fallback para AndroidReceiptBridge abaixo caso o plugin não esteja registrado no APK atual
    }
  }

  // 2. Tenta via AndroidReceiptBridge (JavaScriptInterface no WebView)
  if (typeof window !== 'undefined' && typeof window.AndroidReceiptBridge?.requestContacts === 'function') {
    return new Promise((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        window.removeEventListener('rachappContactsLoaded', onLoaded);
        const cached = getCachedPhoneContacts();
        if (cached.length > 0) {
          resolve({ contacts: cached, status: 'ok' });
        } else {
          resolve({ contacts: [], status: 'error' });
        }
      }, 15000);

      const onLoaded = (ev: Event) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('rachappContactsLoaded', onLoaded);
        const detail = (ev as CustomEvent<{
          contacts?: Array<{ name?: string; phone?: string }>;
          status?: string;
        }>).detail;

        if (detail?.status === 'permission_denied') {
          resolve({ contacts: [], status: 'permission_denied' });
          return;
        }
        if (detail?.status === 'error') {
          resolve({ contacts: [], status: 'error' });
          return;
        }
        const list = normalizeRawContacts(Array.isArray(detail?.contacts) ? detail.contacts : []);
        saveCachedPhoneContacts(list);
        resolve({ contacts: list, status: 'ok' });
      };

      window.addEventListener('rachappContactsLoaded', onLoaded);
      try {
        window.AndroidReceiptBridge!.requestContacts!();
      } catch {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          window.removeEventListener('rachappContactsLoaded', onLoaded);
          resolve({ contacts: [], status: 'error' });
        }
      }
    });
  }

  // 3. Tenta via Web Contact Picker API (Chrome Android / PWA)
  if (hasWebContactPickerSupport()) {
    try {
      const picked = await (navigator as any).contacts.select(['name', 'tel'], {
        multiple: true,
      });
      if (!picked || picked.length === 0) {
        return { contacts: [], status: 'cancelled' };
      }
      const raw: Array<{ name?: string; phone?: string }> = [];
      picked.forEach((c: { name?: string[]; tel?: string[] }) => {
        const name = (c.name?.[0] || '').trim();
        const phones = Array.isArray(c.tel) && c.tel.length > 0 ? c.tel : [''];
        phones.forEach((tel) => {
          raw.push({ name, phone: tel });
        });
      });
      const list = normalizeRawContacts(raw);
      saveCachedPhoneContacts(list);
      return { contacts: list, status: 'ok' };
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'InvalidStateError') {
        return { contacts: [], status: 'cancelled' };
      }
      return { contacts: [], status: 'error' };
    }
  }

  if (Capacitor.isNativePlatform()) {
    return { contacts: [], status: 'unsupported_apk' };
  }

  return { contacts: [], status: 'unsupported_browser' };
}

export function parseVCardContacts(vcfText: string): RawContactItem[] {
  const raw: Array<{ name?: string; phone?: string }> = [];
  const cards = vcfText.split(/BEGIN:VCARD/i);

  for (const card of cards) {
    if (!/END:VCARD/i.test(card)) continue;
    const lines = card.split(/\r?\n/);
    let fullName = '';
    const phones: string[] = [];

    for (const line of lines) {
      if (/^FN[;:]/i.test(line)) {
        const val = line.split(':').slice(1).join(':').trim();
        if (val) fullName = decodeQuotedPrintableIfNeeded(line, val);
      } else if (!fullName && /^N[;:]/i.test(line)) {
        const val = line.split(':').slice(1).join(':').trim();
        const parts = val
          .split(';')
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length > 0) {
          fullName = decodeQuotedPrintableIfNeeded(line, parts.reverse().join(' '));
        }
      } else if (/^TEL[;:]/i.test(line)) {
        const val = line.split(':').slice(1).join(':').trim();
        if (val) phones.push(val);
      }
    }

    if (phones.length === 0 && fullName) {
      raw.push({ name: fullName, phone: '' });
    } else {
      for (const p of phones) {
        raw.push({ name: fullName, phone: p });
      }
    }
  }

  const normalized = normalizeRawContacts(raw);
  if (normalized.length > 0) {
    saveCachedPhoneContacts(normalized);
  }
  return normalized;
}

function decodeQuotedPrintableIfNeeded(headerLine: string, value: string): string {
  if (!/ENCODING=QUOTED-PRINTABLE/i.test(headerLine)) {
    return value;
  }
  try {
    const hexMatches = value.replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < hexMatches.length; i++) {
      if (hexMatches[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hexMatches.slice(i + 1, i + 3))) {
        bytes.push(parseInt(hexMatches.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(hexMatches.charCodeAt(i));
      }
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}
