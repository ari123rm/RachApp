// src/utils/phoneFormatter.ts

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
