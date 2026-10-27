// src/services/updateService.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';

export interface AppReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  notes: string;
  publishedAt: string;
  apkDownloadUrl: string;
  otaZipUrl: string;
  htmlUrl: string;
  isNewer: boolean;
  currentVersion: string;
}

export interface VersionManifestJson {
  version: string;
  tagName?: string;
  url?: string;
  updateZipUrl?: string;
  apkUrl?: string;
  notes?: string;
  publishedAt?: string;
}

export type OtaUpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'applying'
  | 'DeferredToNextBoot'
  | 'error';

export interface ReadyOtaBundle {
  id: string;
  version: string;
  tagName: string;
}

const GITHUB_REPO = 'ari123rm/RachApp';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_VERSION_JSON_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/version.json`;

const DISMISSED_VERSION_KEY = 'rachapp_dismissed_update_version';
const LAST_CHECK_KEY = 'rachapp_last_update_check';
const CACHED_RELEASE_KEY = 'rachapp_cached_release_info';
const ACTIVE_OTA_VERSION_KEY = 'rachapp_active_ota_version';
const DEFERRED_OTA_VERSION_KEY = 'rachapp_deferred_ota_version';

const NETWORK_TIMEOUT_MS = 8000;

let appReadyNotified = false;
let activeOtaCheckPromise: Promise<AppReleaseInfo | null> | null = null;

/**
 * Helper de fetch com AbortController para nunca bloquear ou travar caso a internet caia no meio da checagem.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Remove Service Workers do PWA quando rodando dentro do Capacitor nativo
 * para garantir que o WebView carregue sempre os arquivos locais do bundle OTA ativo.
 */
async function clearWebViewServiceWorkerCache(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Ignora falhas silenciosamente
  }
}

/**
 * Notifica o plugin nativo (@capgo/capacitor-updater) que o bundle JS iniciou com sucesso.
 * CRÍTICO para a garantia Offline-First / Rollback:
 * - Deve ser chamado imediatamente no boot do app ANTES de qualquer chamada de rede.
 * - Se um bundle OTA baixado estiver corrompido e o JS não iniciar até o `appReadyTimeout` (10s),
 *   o plugin reverte automaticamente para o bundle nativo embutido no APK (`builtin`).
 */
export async function notifyOtaAppReady(): Promise<void> {
  if (appReadyNotified || !Capacitor.isNativePlatform()) return;
  appReadyNotified = true;

  try {
    await CapacitorUpdater.notifyAppReady();
    clearWebViewServiceWorkerCache().catch(() => {});

    // Verifica se houve falha/rollback automático de algum bundle anterior
    const failedUpdate = await CapacitorUpdater.getFailedUpdate();
    if (failedUpdate?.bundle) {
      console.warn(
        '[OTA] Bundle anterior falhou ao iniciar e sofreu rollback automático para versão segura:',
        failedUpdate.bundle
      );
      try {
        localStorage.removeItem(ACTIVE_OTA_VERSION_KEY);
      } catch {}
    }
  } catch (err) {
    console.warn('[OTA] Aviso ao confirmar notifyAppReady:', err);
  }
}

/**
 * 1. Checagem de Rede via @capacitor/network.
 * Se estiver offline, retorna false silenciosamente sem bloquear o app.
 */
export async function isNetworkConnected(): Promise<boolean> {
  try {
    const status = await Promise.race([
      Network.getStatus(),
      new Promise<{ connected: boolean }>((resolve) =>
        setTimeout(() => resolve({ connected: navigator.onLine }), 2500)
      ),
    ]);
    return Boolean(status?.connected);
  } catch {
    return typeof navigator !== 'undefined' ? navigator.onLine : false;
  }
}

/**
 * Converte string semver (ex: "v0.1.25" ou "0.1.25") em array numérico [0, 1, 25]
 */
export function parseVersion(v: string): number[] {
  return String(v || '')
    .trim()
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
 * Obtém a versão atual do app considerando:
 * 1. O bundle OTA ativo no @capgo/capacitor-updater (se não for o builtin)
 * 2. A versão embutida no build Vite (VITE_APP_VERSION)
 * 3. A versão nativa do APK (@capacitor/app)
 * Retorna sempre a maior versão efetivamente ativa para evitar loops de atualização.
 */
export async function getCurrentAppVersion(): Promise<string> {
  const candidates: string[] = [];

  const envVersion = import.meta.env.VITE_APP_VERSION;
  if (envVersion) {
    candidates.push(String(envVersion).trim().replace(/^v/i, ''));
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const currentBundleInfo = await CapacitorUpdater.current();
      if (currentBundleInfo?.native) {
        candidates.push(String(currentBundleInfo.native).trim().replace(/^v/i, ''));
      }
      if (
        currentBundleInfo?.bundle &&
        currentBundleInfo.bundle.id !== 'builtin' &&
        currentBundleInfo.bundle.version &&
        currentBundleInfo.bundle.version !== 'builtin'
      ) {
        candidates.push(String(currentBundleInfo.bundle.version).trim().replace(/^v/i, ''));
      } else {
        // Se voltou para o bundle builtin (ex: reinstalou APK ou houve rollback), limpa versão OTA antiga se menor que a nativa
        const storedOta = localStorage.getItem(ACTIVE_OTA_VERSION_KEY);
        if (storedOta && currentBundleInfo?.native && !isVersionNewer(currentBundleInfo.native, storedOta)) {
          localStorage.removeItem(ACTIVE_OTA_VERSION_KEY);
        }
      }
    } catch (err) {
      console.warn('[OTA] Erro ao consultar bundle atual do CapacitorUpdater:', err);
    }

    try {
      const info = await CapApp.getInfo();
      if (info?.version) {
        candidates.push(String(info.version).trim().replace(/^v/i, ''));
      }
    } catch (err) {
      console.warn('[OTA] Erro ao obter versão nativa do Capacitor App:', err);
    }

    try {
      const storedOta = localStorage.getItem(ACTIVE_OTA_VERSION_KEY);
      if (storedOta) {
        candidates.push(storedOta.trim().replace(/^v/i, ''));
      }
    } catch {}
  }

  if (candidates.length === 0) {
    return '0.1.38';
  }

  let highest = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (isVersionNewer(highest, candidates[i])) {
      highest = candidates[i];
    }
  }
  return highest;
}

/**
 * Tenta ler o manifesto `version.json` anexado na release (diretamente ou via URL de asset).
 */
async function tryFetchVersionManifest(manifestUrl = GITHUB_VERSION_JSON_URL): Promise<VersionManifestJson | null> {
  try {
    const res = await fetchWithTimeout(manifestUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionManifestJson;
    if (data && typeof data.version === 'string' && data.version.trim()) {
      return data;
    }
  } catch {
    // Fallback silencioso para a API do GitHub Releases caso CORS ou rede bloqueie o redirect direto
  }
  return null;
}

/**
 * 2. Checagem de Versão no GitHub Releases / version.json
 * Verifica primeiro a conectividade via @capacitor/network. Se estiver offline, aborta silenciosamente.
 */
export async function checkAppUpdate(force = false): Promise<AppReleaseInfo | null> {
  if (!Capacitor.isNativePlatform() || import.meta.env.DEV) {
    return null;
  }

  try {
    // 1. Checagem estrita de rede via @capacitor/network
    const connected = await isNetworkConnected();
    if (!connected) {
      console.log('[OTA] Dispositivo offline. Abortando checagem de atualização silenciosamente.');
      return null;
    }

    const now = Date.now();
    const lastCheckStr = localStorage.getItem(LAST_CHECK_KEY);
    const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;

    // Reaproveita cache recente (< 5 min) em checagens automáticas para evitar rate-limit da API do GitHub
    if (!force && now - lastCheck < 5 * 60 * 1000) {
      const cached = localStorage.getItem(CACHED_RELEASE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AppReleaseInfo;
          const currentVersion = await getCurrentAppVersion();
          parsed.currentVersion = currentVersion;
          parsed.isNewer = isVersionNewer(currentVersion, parsed.version || parsed.tagName);
          return parsed;
        } catch {}
      }
    }

    localStorage.setItem(LAST_CHECK_KEY, String(now));
    const currentVersion = await getCurrentAppVersion();

    // Tenta consultar a API oficial do GitHub Releases (possui suporte completo a CORS e lista todos os assets)
    let releaseData: any = null;
    try {
      const response = await fetchWithTimeout(GITHUB_RELEASES_URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
        cache: 'no-store',
      });
      if (response.ok) {
        releaseData = await response.json();
      }
    } catch {
      // Se falhar, tentará via version.json direto abaixo
    }

    // Se a API do GitHub respondeu com a latest release
    if (releaseData && releaseData.tag_name) {
      const latestTag = String(releaseData.tag_name).trim();
      const normalizedVersion = latestTag.replace(/^v/i, '');
      const assets: any[] = Array.isArray(releaseData.assets) ? releaseData.assets : [];

      const apkAsset =
        assets.find((a) => String(a.name || '').toLowerCase() === 'app-release.apk') ||
        assets.find((a) => String(a.name || '').toLowerCase().endsWith('.apk'));

      const zipAsset =
        assets.find((a) => String(a.name || '').toLowerCase() === 'update.zip') ||
        assets.find((a) => String(a.name || '').toLowerCase().endsWith('.zip'));

      const versionJsonAsset = assets.find(
        (a) => String(a.name || '').toLowerCase() === 'version.json'
      );

      let otaZipUrl = zipAsset?.browser_download_url || '';
      let apkDownloadUrl = apkAsset?.browser_download_url || releaseData.html_url || '';
      let finalVersion = normalizedVersion;

      // Se houver version.json anexado e ainda precisarmos confirmar a URL do update.zip
      if (!otaZipUrl && versionJsonAsset?.browser_download_url) {
        const manifest = await tryFetchVersionManifest(versionJsonAsset.browser_download_url);
        if (manifest) {
          otaZipUrl = manifest.updateZipUrl || manifest.url || '';
          if (manifest.apkUrl) apkDownloadUrl = manifest.apkUrl;
          if (manifest.version) finalVersion = manifest.version.replace(/^v/i, '');
        }
      }

      const isNewer = isVersionNewer(currentVersion, finalVersion);

      const releaseInfo: AppReleaseInfo = {
        version: finalVersion,
        tagName: latestTag.startsWith('v') ? latestTag : `v${finalVersion}`,
        name: releaseData.name || latestTag,
        notes: releaseData.body || '',
        publishedAt: releaseData.published_at || '',
        apkDownloadUrl,
        otaZipUrl,
        htmlUrl: releaseData.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
        isNewer,
        currentVersion,
      };

      try {
        localStorage.setItem(CACHED_RELEASE_KEY, JSON.stringify(releaseInfo));
      } catch {}

      return releaseInfo;
    }

    // Fallback: Tenta ler diretamente o arquivo version.json da latest release
    const manifest = await tryFetchVersionManifest(GITHUB_VERSION_JSON_URL);
    if (manifest && manifest.version) {
      const cleanVersion = manifest.version.replace(/^v/i, '');
      const tagName = manifest.tagName || `v${cleanVersion}`;
      const otaZipUrl =
        manifest.updateZipUrl ||
        manifest.url ||
        `https://github.com/${GITHUB_REPO}/releases/download/${tagName}/update.zip`;
      const apkDownloadUrl =
        manifest.apkUrl ||
        `https://github.com/${GITHUB_REPO}/releases/download/${tagName}/app-release.apk`;
      const isNewer = isVersionNewer(currentVersion, cleanVersion);

      const releaseInfo: AppReleaseInfo = {
        version: cleanVersion,
        tagName,
        name: `RachApp ${tagName}`,
        notes: manifest.notes || '',
        publishedAt: manifest.publishedAt || '',
        apkDownloadUrl,
        otaZipUrl,
        htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/${tagName}`,
        isNewer,
        currentVersion,
      };

      try {
        localStorage.setItem(CACHED_RELEASE_KEY, JSON.stringify(releaseInfo));
      } catch {}

      return releaseInfo;
    }

    return null;
  } catch (error) {
    console.warn('[OTA] Não foi possível verificar atualizações (offline ou timeout):', error);
    return null;
  }
}

/**
 * 3 & 4. Download Manual em Background e Aplicação Segura (Blue-Green)
 * - Faz o download e extração do `update.zip` via `@capgo/capacitor-updater`.
 * - Registra o bundle via `CapacitorUpdater.next({ id: bundle.id })` para apontar o próximo boot com segurança.
 * - Se o download falhar ou o `.zip` estiver corrompido, limpa o bundle inválido e mantém o build nativo embutido no APK.
 */
export async function downloadAndStageOtaUpdate(
  releaseInfo: AppReleaseInfo,
  onProgress?: (percent: number) => void
): Promise<ReadyOtaBundle | null> {
  if (!Capacitor.isNativePlatform() || !releaseInfo.otaZipUrl) {
    return null;
  }

  // Confirma novamente se há rede antes de iniciar o download do zip
  const connected = await isNetworkConnected();
  if (!connected) {
    return null;
  }

  let progressListenerHandle: { remove: () => Promise<void> } | null = null;
  let downloadedBundle: BundleInfo | null = null;

  try {
    // Verifica se este bundle já foi baixado anteriormente com sucesso
    try {
      const existingList = await CapacitorUpdater.list();
      const alreadyDownloaded = existingList?.bundles?.find(
        (b) =>
          b.version === releaseInfo.version &&
          (b.status === 'success' || b.status === 'pending') &&
          b.id !== 'builtin'
      );
      if (alreadyDownloaded) {
        await CapacitorUpdater.next({ id: alreadyDownloaded.id });
        onProgress?.(100);
        return {
          id: alreadyDownloaded.id,
          version: releaseInfo.version,
          tagName: releaseInfo.tagName,
        };
      }
    } catch {
      // Prossegue com o download normal se list() falhar
    }

    if (onProgress) {
      try {
        progressListenerHandle = await CapacitorUpdater.addListener('download', (event) => {
          if (typeof event?.percent === 'number') {
            onProgress(Math.min(100, Math.max(0, Math.round(event.percent))));
          }
        });
      } catch {}
    }

    console.log(
      `[OTA] Baixando bundle v${releaseInfo.version} em background de: ${releaseInfo.otaZipUrl}`
    );

    downloadedBundle = await CapacitorUpdater.download({
      url: releaseInfo.otaZipUrl,
      version: releaseInfo.version,
    });

    if (!downloadedBundle || !downloadedBundle.id || downloadedBundle.status === 'error') {
      throw new Error('Bundle OTA baixado retornou status inválido ou corrompido.');
    }

    // Blue-Green: Registra o novo bundle como o próximo a ser carregado pelo WebView
    await CapacitorUpdater.next({ id: downloadedBundle.id });
    onProgress?.(100);

    console.log(
      `[OTA] Bundle v${releaseInfo.version} (id=${downloadedBundle.id}) extraído e preparado com sucesso!`
    );

    return {
      id: downloadedBundle.id,
      version: releaseInfo.version,
      tagName: releaseInfo.tagName,
    };
  } catch (err) {
    console.error(
      '[OTA] Falha ao baixar ou validar update.zip. Mantendo build atual / fallback nativo:',
      err
    );

    // Se um bundle corrompido/parcial chegou a ser criado, remove-o para não afetar o app
    if (downloadedBundle?.id && downloadedBundle.id !== 'builtin') {
      try {
        await CapacitorUpdater.delete({ id: downloadedBundle.id });
      } catch {}
    }

    return null;
  } finally {
    if (progressListenerHandle) {
      try {
        await progressListenerHandle.remove();
      } catch {}
    }
  }
}

/**
 * Ativa imediatamente o novo bundle OTA no WebView (`CapacitorUpdater.set`) e recarrega o app.
 * Caso ocorra qualquer erro na troca, faz fallback seguro mantendo o app funcional.
 */
export async function applyOtaUpdateNow(bundle: ReadyOtaBundle): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !bundle?.id) return false;

  try {
    localStorage.setItem(ACTIVE_OTA_VERSION_KEY, bundle.version);
    localStorage.removeItem(DEFERRED_OTA_VERSION_KEY);
    await clearWebViewServiceWorkerCache();

    // Aponta o WebView imediatamente para a nova pasta local extraída e recarrega a aplicação
    await CapacitorUpdater.set({ id: bundle.id });
    return true;
  } catch (err) {
    console.error('[OTA] Erro ao ativar bundle OTA. Revertendo para versão segura:', err);
    localStorage.removeItem(ACTIVE_OTA_VERSION_KEY);
    try {
      await CapacitorUpdater.reset({ toLastSuccessful: true });
    } catch {
      try {
        await CapacitorUpdater.reset({ toLastSuccessful: false });
      } catch {}
    }
    return false;
  }
}

/**
 * Hook React completo para gerenciar o ciclo de vida OTA Self-Hosted:
 * 1. Confirma o boot do bundle atual (`notifyOtaAppReady`) sem bloquear a renderização
 * 2. Checa rede via `@capacitor/network` (aborta silenciosamente se offline)
 * 3. Checa nova versão no GitHub Releases / `version.json`
 * 4. Faz download e extração em background do `update.zip` via `@capgo/capacitor-updater`
 * 5. Exibe notificação toast suave com contagem regressiva de 3 segundos para recarregar
 *    ou permite adiar para o próximo boot (`CapacitorUpdater.next`).
 */
export function useOtaUpdater(options?: {
  onApkFallbackDetected?: (info: AppReleaseInfo) => void;
}) {
  const [otaStatus, setOtaStatus] = useState<OtaUpdateStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [readyBundle, setReadyBundle] = useState<ReadyOtaBundle | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<AppReleaseInfo | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const onApkFallbackRef = useRef(options?.onApkFallbackDetected);
  onApkFallbackRef.current = options?.onApkFallbackDetected;

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const applyNow = useCallback(async () => {
    if (!readyBundle) return;
    clearCountdown();
    setOtaStatus('applying');
    await applyOtaUpdateNow(readyBundle);
  }, [readyBundle, clearCountdown]);

  const applyOnNextBoot = useCallback(() => {
    clearCountdown();
    if (readyBundle) {
      try {
        localStorage.setItem(DEFERRED_OTA_VERSION_KEY, readyBundle.version);
      } catch {}
    }
    setOtaStatus('DeferredToNextBoot');
  }, [readyBundle, clearCountdown]);

  const startAutoUpdateFlow = useCallback(
    async (force = false): Promise<AppReleaseInfo | null> => {
      if (!Capacitor.isNativePlatform() || import.meta.env.DEV) {
        return null;
      }

      // Evita execuções concorrentes duplicadas no boot
      if (activeOtaCheckPromise && !force) {
        return activeOtaCheckPromise;
      }

      const runPromise = (async () => {
        try {
          if (isMountedRef.current) setOtaStatus('checking');

          const info = await checkAppUpdate(force);
          if (!isMountedRef.current) return info;

          setReleaseInfo(info);

          if (!info || !info.isNewer) {
            setOtaStatus('idle');
            return info;
          }

          // Se o usuário já adiou esta mesma versão para o próximo boot na sessão atual e não foi forçado
          const deferredVersion = localStorage.getItem(DEFERRED_OTA_VERSION_KEY);
          if (!force && deferredVersion === info.version) {
            setOtaStatus('DeferredToNextBoot');
            return info;
          }

          // Se a release possui pacote OTA (update.zip), faz o download transparente em background
          if (info.otaZipUrl) {
            if (isMountedRef.current) {
              setOtaStatus('downloading');
              setDownloadProgress(0);
            }

            const staged = await downloadAndStageOtaUpdate(info, (pct) => {
              if (isMountedRef.current) {
                setDownloadProgress(pct);
              }
            });

            if (!isMountedRef.current) return info;

            if (staged) {
              setReadyBundle(staged);
              setOtaStatus('ready');
              setCountdown(3);
              return info;
            } else {
              // Se o download do OTA falhou (ex: internet caiu durante o download), aborta silenciosamente sem travar o app
              setOtaStatus('error');
              return info;
            }
          } else {
            // Fallback caso uma release antiga tenha apenas o arquivo .apk sem update.zip
            setOtaStatus('idle');
            if (!isUpdateDismissed(info.version)) {
              onApkFallbackRef.current?.(info);
            }
            return info;
          }
        } catch (err) {
          console.warn('[OTA] Erro inesperado no fluxo de atualização em background:', err);
          if (isMountedRef.current) {
            setOtaStatus('idle');
          }
          return null;
        } finally {
          activeOtaCheckPromise = null;
        }
      })();

      if (!force) {
        activeOtaCheckPromise = runPromise;
      }
      return runPromise;
    },
    []
  );

  // Dispara a contagem regressiva de 3 segundos quando o bundle OTA fica pronto
  useEffect(() => {
    if (otaStatus !== 'ready' || !readyBundle || countdown === null) {
      return;
    }

    if (countdown <= 0) {
      applyNow();
      return;
    }

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setCountdown((prev) => (prev !== null ? prev - 1 : null));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [otaStatus, readyBundle, countdown, applyNow]);

  // Inicialização não-bloqueante ao montar o App
  useEffect(() => {
    isMountedRef.current = true;

    // 1. Confirma imediatamente que o bundle JS atual iniciou (previne rollback indevido do watchdog de 10s)
    notifyOtaAppReady().catch(() => {});

    // 2. Inicia a verificação e download OTA em background sem bloquear a UI
    const bootTimer = setTimeout(() => {
      startAutoUpdateFlow(false).catch(() => {});
    }, 600);

    return () => {
      isMountedRef.current = false;
      clearTimeout(bootTimer);
      clearCountdown();
    };
  }, [ clearCountdown, startAutoUpdateFlow]);

  return {
    otaStatus,
    downloadProgress,
    readyBundle,
    releaseInfo,
    countdown,
    applyNow,
    applyOnNextBoot,
    checkAndUpdateNow: () => startAutoUpdateFlow(true),
    setReleaseInfo,
  };
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
 * Dispara o download direto do APK no Android nativo (DownloadManager / Navegador) ou Web (para novas instalações ou atualização manual de APK)
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
    link.download = downloadUrl.split('/').pop() || 'app-release.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    window.location.href = downloadUrl;
    return true;
  }
}
