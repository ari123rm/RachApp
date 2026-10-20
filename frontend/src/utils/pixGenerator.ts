// src/utils/pixGenerator.ts
import QRCode from 'qrcode';

function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
}

function formatEMVField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function computeCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Validação de CPF para distinguir entre chave CPF e chave Telefone quando não formatadas
 */
function isValidCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split('').map((el) => +el);
  const rest = (count: number) =>
    ((digits.slice(0, count - 12).reduce((soma, el, index) => soma + el * (count - index), 0) * 10) % 11) % 10;
  return rest(10) === digits[9] && rest(11) === digits[10];
}

/**
 * Normaliza a chave Pix para o padrão oficial do Banco Central (DICT / BR Code EMV):
 * - Telefone celular/fixo: padrão internacional E.164 com +55 (ex: +5511999999999)
 * - CPF / CNPJ: somente números (sem pontos ou traços)
 * - E-mail: minúsculo e sem espaços
 * - EVP (chave aleatória): minúsculo com hífens
 */
export function normalizePixKeyForPayload(rawKey?: string | null): string {
  if (!rawKey) return '';
  const trimmed = rawKey.trim();
  if (!trimmed) return '';

  // 1. E-mail: letras minúsculas
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  // 2. Chave aleatória (UUID): padrão xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // 3. Apenas dígitos
  const digits = trimmed.replace(/\D/g, '');

  // Se já possui o prefixo internacional com + (ex: +55...)
  if (trimmed.startsWith('+')) {
    return '+' + digits;
  }

  // CNPJ: 14 dígitos (apenas números)
  if (digits.length === 14) {
    return digits;
  }

  // Telefone que já começa com 55 (12 ou 13 dígitos): adiciona o '+'
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return '+' + digits;
  }

  // Telefone com 10 dígitos (DDD + 8 dígitos): adiciona '+55'
  if (digits.length === 10) {
    return '+55' + digits;
  }

  // 11 dígitos: CPF ou Telefone celular brasileiro
  if (digits.length === 11) {
    // Se digitou com pontuação de CPF (pontos)
    if (trimmed.includes('.')) {
      return digits;
    }
    // Se digitou com pontuação de telefone (parênteses de DDD)
    if (trimmed.includes('(') || trimmed.includes(')')) {
      return '+55' + digits;
    }
    // Verifica dígitos verificadores do CPF
    if (isValidCPF(digits)) {
      return digits;
    }
    // Celular brasileiro (formato E.164 exigido pelo Bacen para o Pix)
    return '+55' + digits;
  }

  return trimmed;
}

export interface PixPayloadParams {
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: number;
  description?: string;
  txid?: string;
}

/**
 * Gera o código oficial EMVCo BR Code ("Pix Copia e Cola") segundo padrão do Banco Central do Brasil.
 * Compatível com todos os aplicativos bancários (Nubank, Inter, Itaú, BB, Bradesco, Santander, Caixa, C6, etc.).
 */
export function generatePixCopiaECola({
  pixKey,
  merchantName = 'RachApp',
  merchantCity = 'BRASILIA',
  amount,
  txid = '***',
}: PixPayloadParams): string {
  const cleanKey = normalizePixKeyForPayload(pixKey);
  if (!cleanKey) return '';

  // 00 - Payload Format Indicator (01)
  const f00 = formatEMVField('00', '01');

  // 01 - Point of Initiation Method: 11 = QR Code Estático (MANDATÓRIO em vários apps de bancos)
  const f01 = formatEMVField('01', '11');

  // 26 - Merchant Account Information - Pix
  const guiField = formatEMVField('00', 'br.gov.bcb.pix');
  const keyField = formatEMVField('01', cleanKey);
  const merchantAccountInfo = formatEMVField('26', `${guiField}${keyField}`);

  // 52 - Merchant Category Code (0000)
  const mcc = formatEMVField('52', '0000');

  // 53 - Transaction Currency (986 = Real Brasileiro / BRL)
  const currency = formatEMVField('53', '986');

  // 54 - Transaction Amount (opcional, só inclui se for maior que 0)
  const numericAmount = Number(amount || 0);
  const amountField =
    numericAmount > 0.005 ? formatEMVField('54', numericAmount.toFixed(2)) : '';

  // 58 - Country Code (BR)
  const country = formatEMVField('58', 'BR');

  // 59 - Merchant Name (max 25 chars, sem acentos, maiúsculo)
  const cleanName = (removeAccents(merchantName) || 'RACHAPP').toUpperCase().substring(0, 25);
  const nameField = formatEMVField('59', cleanName);

  // 60 - Merchant City (max 15 chars, sem acentos, maiúsculo)
  const cleanCity = (removeAccents(merchantCity) || 'BRASILIA').toUpperCase().substring(0, 15);
  const cityField = formatEMVField('60', cleanCity);

  // 62 - Additional Data Field Template (txid / Reference Label)
  const cleanTxid =
    txid && txid !== '***' ? removeAccents(txid).replace(/\s+/g, '').substring(0, 25) : '***';
  const txidField = formatEMVField('05', cleanTxid || '***');
  const additionalData = formatEMVField('62', txidField);

  // Monta payload e calcula CRC16 (Tag 63)
  const payloadWithoutCRC =
    f00 +
    f01 +
    merchantAccountInfo +
    mcc +
    currency +
    amountField +
    country +
    nameField +
    cityField +
    additionalData +
    '6304';

  const crc = computeCRC16(payloadWithoutCRC);
  return `${payloadWithoutCRC}${crc}`;
}

export async function generatePixQRCodeDataUrl(payload: string): Promise<string> {
  if (!payload) return '';
  return QRCode.toDataURL(payload, {
    width: 240,
    margin: 2,
    color: {
      dark: '#05080f',
      light: '#ffffff',
    },
  });
}
