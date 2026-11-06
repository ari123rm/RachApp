// src/utils/phoneFormatter.ts
import { Capacitor } from '@capacitor/core';

/**
 * Remove caracteres não numéricos e retira o DDI +55 caso o número possua 12 ou 13 dígitos.
 * Retorna apenas DDD + Número (10 ou 11 dígitos).
 */
export function stripCountryCode(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 11);
}

/**
 * Compara dois números de telefone brasileiros ignorando formatação, DDI +55 e variações do 9º dígito.
 */
export function phonesMatchBR(rawA?: string | null, rawB?: string | null): boolean {
  const a = stripCountryCode(rawA);
  const b = stripCountryCode(rawB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10) {
    const dddA = a.slice(0, 2);
    const dddB = b.slice(0, 2);
    const last8A = a.slice(-8);
    const last8B = b.slice(-8);
    if (dddA === dddB && last8A === last8B) {
      return true;
    }
  }
  if (a.length >= 8 && b.length >= 8) {
    const last8A = a.slice(-8);
    const last8B = b.slice(-8);
    if (last8A === last8B) {
      if (a.length >= 10 && b.length >= 10) {
        return a.slice(0, 2) === b.slice(0, 2);
      }
      return true;
    }
  }
  return false;
}

export function normalizeNameForComparison(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function areContactsSame(
  contactA?: { name?: string | null; nome?: string | null; phone?: string | null; telefone?: string | null } | null,
  contactB?: { name?: string | null; nome?: string | null; phone?: string | null; telefone?: string | null } | null
): boolean {
  if (!contactA || !contactB) return false;

  const phoneA = stripCountryCode(contactA.phone || contactA.telefone);
  const phoneB = stripCountryCode(contactB.phone || contactB.telefone);

  // 1. Se ambos têm telefone válido (8+ dígitos), a comparação de telefone é prioritária
  if (phoneA.length >= 8 && phoneB.length >= 8) {
    if (phonesMatchBR(phoneA, phoneB)) return true;
    if (phoneA.length >= 10 && phoneB.length >= 10) return false;
  }

  const nameA = normalizeNameForComparison(contactA.name || contactA.nome);
  const nameB = normalizeNameForComparison(contactB.name || contactB.nome);

  // 2. Se os nomes forem idênticos (sem acento, minúsculas):
  if (nameA && nameB && nameA === nameB) {
    if (!phoneA || !phoneB) return true;
    return phonesMatchBR(phoneA, phoneB);
  }

  // 3. Se um nome contiver o outro ou compartilharem o primeiro nome
  if (nameA && nameB) {
    const wordsA = nameA.split(' ');
    const wordsB = nameB.split(' ');
    const sameFirstName = wordsA[0] && wordsB[0] && wordsA[0] === wordsB[0];

    if (sameFirstName && phoneA && phoneB && phonesMatchBR(phoneA, phoneB)) {
      return true;
    }
    if ((nameA.includes(nameB) || nameB.includes(nameA)) && (!phoneA || !phoneB)) {
      return true;
    }
  }

  return false;
}

/**
 * Formata o telefone no padrão brasileiro: (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX
 * Aceita entrada com ou sem +55.
 */
export function formatPhoneBR(raw?: string | null): string {
  if (!raw) return '';
  const digits = stripCountryCode(raw);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Valida se o telefone possui DDD válido (2 dígitos) + 8 ou 9 dígitos.
 */
export function isValidPhoneBR(raw?: string | null): boolean {
  const digits = stripCountryCode(raw);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

/**
 * Retorna o número pronto para link do WhatsApp (wa.me/55DDDNUMERO) sem duplicar o 55.
 */
export function toWhatsAppNumber(raw?: string | null): string {
  const digits = stripCountryCode(raw);
  if (!digits) return '';
  return `55${digits}`;
}

/**
 * Abre o WhatsApp de forma compatível tanto no APK Android/iOS (via Deep Link nativo whatsapp://send)
 * quanto no navegador Web (via https://wa.me), evitando o erro net::ERR_UNKNOWN_URL_SCHEME na WebView.
 */
export function openWhatsApp(rawPhone?: string | null, message: string = ''): void {
  const fullPhone = toWhatsAppNumber(rawPhone);
  const encodedMessage = encodeURIComponent(message);

  if (Capacitor.isNativePlatform()) {
    const nativeUrl = fullPhone
      ? `whatsapp://send?phone=${fullPhone}&text=${encodedMessage}`
      : `whatsapp://send?text=${encodedMessage}`;

    const link = document.createElement('a');
    link.href = nativeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const webUrl = fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  window.open(webUrl, '_blank', 'noopener,noreferrer');
}
