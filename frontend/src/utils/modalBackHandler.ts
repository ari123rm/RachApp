import { useEffect, useRef, useCallback } from 'react';

type CloseFn = () => void;

const modalCloseStack: Array<{ id: symbol; close: CloseFn }> = [];

export function closeTopModal(): boolean {
  if (modalCloseStack.length === 0) return false;
  const top = modalCloseStack[modalCloseStack.length - 1];
  top.close();
  return true;
}

export function closeAllModals(): void {
  const snapshot = [...modalCloseStack].reverse();
  for (const item of snapshot) {
    try {
      item.close();
    } catch {}
  }
}

function hasScrolledAncestor(target: HTMLElement | null, rootNode: HTMLElement): boolean {
  let el: HTMLElement | null = target;
  while (el && el !== rootNode.parentElement) {
    if (el.scrollTop > 2) {
      return true;
    }
    el = el.parentElement;
  }
  return rootNode.scrollTop > 2;
}

/**
 * Registra o modal aberto na pilha global de botão Voltar (Android hardware back / tecla ESC)
 * e retorna um `sheetRef` para habilitar o gesto de puxar o topo do modal para baixo para fechá-lo.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const cleanupNodeRef = useRef<(() => void) | null>(null);

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

  const sheetRef = useCallback((node: HTMLElement | null) => {
    if (cleanupNodeRef.current) {
      cleanupNodeRef.current();
      cleanupNodeRef.current = null;
    }

    if (!node) return;

    // Reseta possíveis estilos residuais ao abrir
    node.style.transform = '';
    node.style.transition = '';
    node.style.willChange = '';

    let active = false;
    let dragging = false;
    let startedOnHandle = false;
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let isClosing = false;

    const canStartDragFromTarget = (target: HTMLElement | null, clientY: number): boolean => {
      if (!target || isClosing) return false;

      // Se clicou num controle interativo (exceto se o próprio controle for o handle)
      const interactive = target.closest(
        'button, a, input, textarea, select, canvas, [data-no-sheet-drag="true"], [data-horizontal-scroll="true"]'
      );
      const explicitHandle = target.closest('[data-sheet-handle="true"]');
      if (interactive && !explicitHandle) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      const offsetYFromTop = clientY - rect.top;

      // Considera o topo do modal (handle + cabeçalho até 88px do topo visível do card)
      const isTopHeaderArea = Boolean(explicitHandle) || offsetYFromTop <= 88;
      startedOnHandle = isTopHeaderArea;

      if (!isTopHeaderArea && hasScrolledAncestor(target, node)) {
        return false;
      }

      return true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;

      if (!canStartDragFromTarget(target, touch.clientY)) {
        active = false;
        return;
      }

      active = true;
      dragging = false;
      startX = touch.clientX;
      startY = touch.clientY;
      lastY = touch.clientY;
      lastTime = performance.now();
      velocityY = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!dragging) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;

        // Se o usuário arrastar para cima ou para os lados, libera para rolagem normal
        if (dy < 0 || Math.abs(dx) > Math.abs(dy) * 1.1) {
          active = false;
          return;
        }

        const target = e.target as HTMLElement | null;
        if (!startedOnHandle && hasScrolledAncestor(target, node)) {
          active = false;
          return;
        }

        dragging = true;
        startY = touch.clientY;
        lastY = touch.clientY;
        lastTime = performance.now();
        // Desativa animation-fill-mode: forwards do animate-slide-up para liberar o transform
        node.style.animation = 'none';
        node.style.transition = 'none';
        node.style.willChange = 'transform';
      }

      if (dragging) {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();

        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 0) {
          velocityY = (touch.clientY - lastY) / dt;
          lastY = touch.clientY;
          lastTime = now;
        }

        const pullY = Math.max(0, touch.clientY - startY);
        node.style.transform = `translate3d(0, ${pullY}px, 0)`;
      }
    };

    const finishDrag = () => {
      if (!active) return;
      const wasDragging = dragging;
      active = false;
      dragging = false;

      if (!wasDragging) return;

      const pullY = Math.max(0, lastY - startY);
      const shouldClose = pullY > 72 || (pullY > 24 && velocityY > 0.35);

      if (shouldClose) {
        isClosing = true;
        node.style.transition = 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)';
        node.style.transform = 'translate3d(0, 105%, 0)';
        setTimeout(() => {
          onCloseRef.current();
        }, 170);
      } else {
        node.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
        node.style.transform = 'translate3d(0, 0px, 0)';
        setTimeout(() => {
          if (!isClosing) {
            node.style.transition = '';
            node.style.transform = '';
            node.style.willChange = '';
          }
        }, 230);
      }
    };

    // Suporte também para arrastar com o mouse no topo do modal
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const rect = node.getBoundingClientRect();
      const isTopArea =
        Boolean(target?.closest('[data-sheet-handle="true"]')) || e.clientY - rect.top <= 72;
      if (!isTopArea || !canStartDragFromTarget(target, e.clientY)) return;

      active = true;
      dragging = false;
      startedOnHandle = true;
      startX = e.clientX;
      startY = e.clientY;
      lastY = e.clientY;
      lastTime = performance.now();
      velocityY = 0;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!active) return;
        const dy = moveEvent.clientY - startY;
        const dx = moveEvent.clientX - startX;

        if (!dragging) {
          if (Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
          if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
            active = false;
            return;
          }
          dragging = true;
          startY = moveEvent.clientY;
          lastY = moveEvent.clientY;
          lastTime = performance.now();
          node.style.animation = 'none';
          node.style.transition = 'none';
          node.style.willChange = 'transform';
        }

        if (dragging) {
          moveEvent.preventDefault();
          const now = performance.now();
          const dt = now - lastTime;
          if (dt > 0) {
            velocityY = (moveEvent.clientY - lastY) / dt;
            lastY = moveEvent.clientY;
            lastTime = now;
          }
          const pullY = Math.max(0, moveEvent.clientY - startY);
          node.style.transform = `translate3d(0, ${pullY}px, 0)`;
        }
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        finishDrag();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', finishDrag, { passive: true });
    node.addEventListener('touchcancel', finishDrag, { passive: true });
    node.addEventListener('mousedown', onMouseDown);

    cleanupNodeRef.current = () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', finishDrag);
      node.removeEventListener('touchcancel', finishDrag);
      node.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  return sheetRef;
}

/**
 * Comprime uma imagem de comprovante para Base64 JPEG otimizado (~40-100KB)
 * para armazenamento rápido no SQLite local e envio ao backend.
 */
export function compressReceiptImage(
  file: File,
  maxDimension = 960,
  quality = 0.75
): Promise<string> {
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

/**
 * Recorta a imagem ao centro em formato quadrado (1:1) e comprime para Base64 JPEG leve (~15-35KB),
 * ideal para fotos de perfil de usuário e ícones de grupos.
 */
export function compressAvatarImage(
  file: File,
  targetSize = 320,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido (PNG, JPG, WebP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler a imagem selecionada.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const minSide = Math.min(img.width, img.height);
        const sx = Math.round((img.width - minSide) / 2);
        const sy = Math.round((img.height - minSide) / 2);

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
