import { useEffect, useRef } from 'react';

type CloseFn = () => void;

const modalCloseStack: Array<{ id: symbol; close: CloseFn }> = [];

export function closeTopModal(): boolean {
  if (modalCloseStack.length === 0) return false;
  const top = modalCloseStack[modalCloseStack.length - 1];
  top.close();
  return true;
}

/**
 * Registra o modal aberto na pilha global de botão Voltar (Android hardware back / tecla ESC)
 * para que sempre feche o modal mais recente no topo da tela.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const id = Symbol('modal');
    const entry = {
      id,
      close: () => onCloseRef.current(),
    };
    modalCloseStack.push(entry);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const top = modalCloseStack[modalCloseStack.length - 1];
        if (top && top.id === id) {
          e.stopPropagation();
          onCloseRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const idx = modalCloseStack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        modalCloseStack.splice(idx, 1);
      }
    };
  }, [isOpen]);
}

/**
 * Comprime uma imagem de comprovante para Base64 JPEG otimizado (~40-100KB)
 * para armazenamento rápido no SQLite local e envio ao backend.
 */
export function compressReceiptImage(file: File, maxDimension = 960, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido (PNG, JPG, WebP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler a imagem do comprovante.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
