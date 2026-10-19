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

export interface PixPayloadParams {
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: number;
  description?: string;
  txid?: string;
}

/**
 * Gera o código oficial EMVCo BRCode ("Pix Copia e Cola") segundo padrão do Banco Central do Brasil.
 */
export function generatePixCopiaECola({
  pixKey,
  merchantName = 'RachApp',
  merchantCity = 'FORTALEZA',
  amount,
  description,
  txid = '***',
}: PixPayloadParams): string {
  const cleanKey = pixKey.trim();
  if (!cleanKey) return '';

  const guiField = formatEMVField('00', 'br.gov.bcb.pix');
  const keyField = formatEMVField('01', cleanKey);
  const descClean = description ? removeAccents(description).substring(0, 25) : '';
  const descField = descClean ? formatEMVField('02', descClean) : '';

  const merchantAccountInfo = formatEMVField('26', `${guiField}${keyField}${descField}`);
  const mcc = formatEMVField('52', '0000');
  const currency = formatEMVField('53', '986');
  const amountField =
    amount && amount > 0 ? formatEMVField('54', amount.toFixed(2)) : '';
  const country = formatEMVField('58', 'BR');

  const cleanName = (removeAccents(merchantName) || 'RACHAPP').toUpperCase().substring(0, 25);
  const nameField = formatEMVField('59', cleanName);

  const cleanCity = (removeAccents(merchantCity) || 'FORTALEZA').toUpperCase().substring(0, 15);
  const cityField = formatEMVField('60', cleanCity);

  const txidField = formatEMVField('05', txid || '***');
  const additionalData = formatEMVField('62', txidField);

  const payloadWithoutCRC =
    formatEMVField('00', '01') +
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
