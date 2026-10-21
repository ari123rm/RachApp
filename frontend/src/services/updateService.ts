// src/services/updateService.ts
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface AppReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  notes: string;
  publishedAt: string;
  apkDownloadUrl: string;
  htmlUrl: string;
  isNewer: boolean;
  currentVersion: string;
}

const GITHUB_REPO = 'ari123rm/RachApp';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const DISMISSED_VERSION_KEY = 'rachapp_dismissed_update_version';
const LAST_CHECK_KEY = 'rachapp_last_update_check';

/**
 * Obtém a versão atual do app instalada (pelo Capacitor no APK nativo ou pelo Vite)
 */
export async function getCurrentAppVersion(): Promise<string> {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await CapApp.getInfo();
      if (info?.version) return info.version;
    }
  } catch (err) {
    console.warn('Erro ao obter versão nativa do Capacitor:', err);
  }

  const envVersion = import.meta.env.VITE_APP_VERSION;
  if (envVersion) return String(envVersion).trim();

  return '0.1.24';
}

/**
 * Converte string semver (ex: "v0.1.25" ou "0.1.25") em array numérico [0, 1, 25]
 */
export function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split(/[-+]/)[0]
    .split('.')
    .map((num) => parseInt(num, 10) || 0);
}

/**
 * Retorna true se a versão 'latest' for estritamente mais recente que 'current'
 */
export function isVersionNewer(current: string, latest: string): boolean {
  const p1 = parseVersion(current);
  const p2 = parseVersion(latest);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num2 > num1) return true;
    if (num2 < num1) return false;
  }
  return false;
}

/**
 * Consulta a última Release no GitHub e compara com a versão instalada.
 */
export async function checkAppUpdate(force = false): Promise<AppReleaseInfo | null> {
  try {
    const now = Date.now();
    const lastCheckStr = localStorage.getItem(LAST_CHECK_KEY);
    const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;

    // Se não for verificação manual/forçada, aguarda ao menos 20 min entre checagens para não estourar rate limit
    if (!force && now - lastCheck < 20 * 60 * 1000) {
      return null;
    }

    localStorage.setItem(LAST_CHECK_KEY, String(now));

    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const release = await response.json();
    if (!release || !release.tag_name) {
      return null;
    }

    const currentVersion = await getCurrentAppVersion();
    const latestTag = release.tag_name;
    const isNewer = isVersionNewer(currentVersion, latestTag);

    // Encontra o asset com extensão .apk
    const apkAsset = Array.isArray(release.assets)
      ? release.assets.find((a: any) => (a.name || '').toLowerCase().endsWith('.apk'))
      : null;

    const apkDownloadUrl = apkAsset?.browser_download_url || release.html_url || '';

    return {
      version: latestTag.replace(/^v/i, ''),
      tagName: latestTag,
      name: release.name || latestTag,
      notes: release.body || '',
      publishedAt: release.published_at || '',
      apkDownloadUrl,
      htmlUrl: release.html_url || '',
      isNewer,
      currentVersion,
    };
  } catch (error) {
    console.warn('Não foi possível verificar atualizações do app:', error);
    return null;
  }
}

/**
 * Checa se o usuário já dispensou o aviso desta versão específica
 */
export function isUpdateDismissed(version: string): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
    return dismissed === version;
  } catch {
    return false;
  }
}

/**
 * Salva a versão dispensada para não incomodar novamente na mesma sessão
 */
export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch {}
}

/**
 * Dispara o download direto do APK no navegador / gerenciador de downloads do Android
 */
export function triggerApkDownload(downloadUrl: string): void {
  if (!downloadUrl) return;

  if (Capacitor.isNativePlatform()) {
    // No Android (Capacitor), abre a URL no navegador nativo para disparar o Download Manager
    window.open(downloadUrl, '_system');
  } else {
    // No browser desktop ou PWA
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = downloadUrl.split('/').pop() || 'RachApp-release.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
