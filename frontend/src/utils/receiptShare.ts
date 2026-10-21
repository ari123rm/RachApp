// src/utils/receiptShare.ts

declare global {
  interface Window {
    AndroidReceiptBridge?: {
      getPendingReceipt: () => string | null;
      clearPendingReceipt: () => void;
      openExternalUrl?: (url: string) => void;
      shareReceipt?: (dataUrl: string, title: string) => void;
    };
    __onNativeSharedReceipt?: (dataUrl: string) => void;
  }
}

/**
 * Limpa completamente qualquer comprovante pendente no cache/bridge para evitar reaberturas acidentais.
 */
export function clearSharedReceipt(): void {
  try {
    localStorage.removeItem('rachapp_pending_shared_receipt');
  } catch {}
  try {
    if (window.AndroidReceiptBridge?.clearPendingReceipt) {
      window.AndroidReceiptBridge.clearPendingReceipt();
    }
  } catch {}
}

/**
 * Converte data URL ou URL para File pronto para compartilhamento nativo.
 */
export async function urlToFile(url: string, filename = 'comprovante-rachapp.jpg'): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  const mime = blob.type || 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : mime.includes('pdf') ? 'pdf' : 'jpg';
  const finalName = filename.includes('.') ? filename : `${filename}.${ext}`;
  return new File([blob], finalName, { type: mime });
}

/**
 * Compartilha o comprovante para outros aplicativos (WhatsApp, Telegram, etc.)
 * utilizando o menu nativo do Android (AndroidReceiptBridge / Intent.ACTION_SEND),
 * Web Share API nos navegadores modernos, ou fallback para download.
 */
export async function shareReceipt(
  receiptUrl: string | null | undefined,
  title = 'Comprovante RachApp'
): Promise<{ success: boolean; fallback?: 'download' | 'copied' | 'none' }> {
  if (!receiptUrl) return { success: false };

  // 1. Prioridade no APK Android (Capacitor): ponte nativa da MainActivity
  // Abre o menu/folha nativa do sistema Android ("Compartilhar com...")
  // com a imagem do comprovante anexada diretamente para WhatsApp, Telegram, etc.
  try {
    const bridge = window.AndroidReceiptBridge;
    if (bridge && typeof bridge.shareReceipt === 'function') {
      bridge.shareReceipt(receiptUrl, title);
      return { success: true };
    }
  } catch (err) {
    console.warn('Erro ao compartilhar via AndroidReceiptBridge:', err);
  }

  // 2. Se for Web com suporte a Web Share API para arquivos (Chrome/Safari)
  try {
    const file = await urlToFile(receiptUrl, 'comprovante-rachapp.jpg');

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title,
        text: 'Comprovante de pagamento do RachApp',
        files: [file],
      });
      return { success: true };
    } else if (navigator.share) {
      await navigator.share({
        title,
        text: 'Comprovante de pagamento do RachApp',
        url: receiptUrl.startsWith('http') ? receiptUrl : undefined,
      });
      return { success: true };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false }; // Usuário cancelou a folha de compartilhamento
    }
    console.warn('Falha no Web Share, aplicando fallback:', err);
  }

  // 3. Fallback Web Desktop: faz o download automático da imagem
  try {
    const a = document.createElement('a');
    a.href = receiptUrl;
    a.download = 'comprovante-rachapp.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { success: true, fallback: 'download' };
  } catch {
    return { success: false };
  }
}

/**
 * Registra listener para capturar comprovantes compartilhados de outros apps para o RachApp.
 */
export function listenForSharedReceipt(onReceiptReceived: (receiptDataUrl: string) => void): () => void {
  // 1. Verifica no localStorage se há comprovante pendente
  try {
    const pendingLocal = localStorage.getItem('rachapp_pending_shared_receipt');
    if (pendingLocal) {
      localStorage.removeItem('rachapp_pending_shared_receipt');
      setTimeout(() => onReceiptReceived(pendingLocal), 300);
    }
  } catch (e) {
    console.error('Erro ao ler comprovante compartilhado no localStorage:', e);
  }

  // 2. Verifica no AndroidReceiptBridge nativo
  try {
    if (window.AndroidReceiptBridge?.getPendingReceipt) {
      const pendingNative = window.AndroidReceiptBridge.getPendingReceipt();
      if (pendingNative) {
        window.AndroidReceiptBridge.clearPendingReceipt();
        setTimeout(() => onReceiptReceived(pendingNative), 300);
      }
    }
  } catch (e) {
    console.error('Erro ao ler comprovante no AndroidReceiptBridge:', e);
  }

  // 3. Listener de evento disparado quando o app já está aberto em background
  const handleCustomEvent = (e: any) => {
    const dataUrl = e?.detail?.dataUrl;
    if (dataUrl) {
      clearSharedReceipt();
      onReceiptReceived(dataUrl);
    }
  };

  window.addEventListener('rachappSharedReceipt', handleCustomEvent);

  // 4. Hook para chamada direta global do WebView
  window.__onNativeSharedReceipt = (dataUrl: string) => {
    if (dataUrl) {
      clearSharedReceipt();
      onReceiptReceived(dataUrl);
    }
  };

  return () => {
    window.removeEventListener('rachappSharedReceipt', handleCustomEvent);
    delete window.__onNativeSharedReceipt;
  };
}
