// src/services/updateService.ts
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
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
const CACHED_RELEASE_KEY = 'rachapp_cached_release_info';

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

    // Se a última checagem foi recente (< 5 min) e não for verificação manual/forçada,
    // reutiliza a informação de release cacheada para não bater no rate limit do GitHub
    if (!force && now - lastCheck < 5 * 60 * 1000) {
      const cached = localStorage.getItem(CACHED_RELEASE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AppReleaseInfo;
          const currentVersion = await getCurrentAppVersion();
          parsed.currentVersion = currentVersion;
          parsed.isNewer = isVersionNewer(currentVersion, parsed.tagName);
          return parsed;
        } catch {}
      }
    }

    localStorage.setItem(LAST_CHECK_KEY, String(now));

    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      // Se a requisição falhar (ex: offline), tenta responder com o cache existente
      const cached = localStorage.getItem(CACHED_RELEASE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AppReleaseInfo;
          const currentVersion = await getCurrentAppVersion();
          parsed.currentVersion = currentVersion;
          parsed.isNewer = isVersionNewer(currentVersion, parsed.tagName);
          return parsed;
        } catch {}
      }
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

    const releaseInfo: AppReleaseInfo = {
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

    // Salva em cache para reaproveitamento rápido
    try {
      localStorage.setItem(CACHED_RELEASE_KEY, JSON.stringify(releaseInfo));
    } catch {}

    return releaseInfo;
  } catch (error) {
    console.warn('Não foi possível verificar atualizações do app:', error);
    // Tenta fallback do cache se disponível
    try {
      const cached = localStorage.getItem(CACHED_RELEASE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AppReleaseInfo;
        const currentVersion = await getCurrentAppVersion();
        parsed.currentVersion = currentVersion;
        parsed.isNewer = isVersionNewer(currentVersion, parsed.tagName);
        return parsed;
      }
    } catch {}
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
 * Dispara o download direto do APK no Android nativo (DownloadManager / Navegador) ou Web
 */
export async function triggerApkDownload(downloadUrl: string): Promise<boolean> {
  if (!downloadUrl) return false;

  console.log('[updateService] Disparando download do APK:', downloadUrl);

  // 1. Tenta via ponte nativa da MainActivity (AndroidReceiptBridge) se disponível
  try {
    const bridge = (window as any).AndroidReceiptBridge;
    if (bridge && typeof bridge.openExternalUrl === 'function') {
      bridge.openExternalUrl(downloadUrl);
      return true;
    }
  } catch (err) {
    console.warn('[updateService] Erro ao chamar AndroidReceiptBridge.openExternalUrl:', err);
  }

  // 2. Tenta via @capacitor/browser (abre no navegador do sistema Android com suporte a download)
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: downloadUrl, windowName: '_system' });
      return true;
    }
  } catch (err) {
    console.warn('[updateService] Erro ao abrir via @capacitor/browser:', err);
  }

  // 3. Fallback Web / Desktop
  try {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = downloadUrl.split('/').pop() || 'RachApp-release.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    window.location.href = downloadUrl;
    return true;
  }
}
