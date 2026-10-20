// src/utils/phoneFormatter.ts
import { Capacitor } from '@capacitor/core';

/**
 * Remove caracteres não numéricos e retira o DDI +55 caso o número possua 12 ou 13 dígitos.
 * Retorna apenas DDD + Número (10 ou 11 dígitos).
 */
export function stripCountryCode(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  // Se começou com 0 (ex: 085...), remove o zero inicial do DDD
  if (digits.length > 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Se o usuário digitou +55 ou 55 na frente do DDD + número (12 ou 13 dígitos)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 11);
}

/**
 * Compara dois números de telefone brasileiros ignorando formatação, DDI +55 e variações do 9º dígito.
 */
export function getCanonicalPhoneKey(raw?: string | null): string {
  if (!raw) return '';
  const digits = stripCountryCode(raw);
  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2);
    const last8 = digits.slice(-8);
    return `${ddd}_${last8}`;
  }
  return digits;
}

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
