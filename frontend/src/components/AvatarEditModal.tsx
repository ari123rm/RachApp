// src/components/AvatarEditModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  Trash2,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LoaderCircle,
  Move,
  Upload,
} from 'lucide-react';
import { useModalBackHandler } from '../utils/modalBackHandler';

export interface AvatarEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string | null;
  title?: string;
  maskShape?: 'circle' | 'square';
  onSave: (croppedDataUrl: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

export function AvatarEditModal({
  isOpen,
  onClose,
  currentAvatarUrl,
  title = 'Editar Foto',
  maskShape = 'circle',
  onSave,
  onDelete,
}: AvatarEditModalProps) {
  useModalBackHandler(isOpen, onClose);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewportSize, setViewportSize] = useState(280);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number }>({
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const touchDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);

  // Carrega ou reseta a imagem quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setImageSrc(currentAvatarUrl || null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setIsSaving(false);
      setIsDeleting(false);
    }
  }, [isOpen, currentAvatarUrl]);

  // Mede o tamanho real do viewport quadrado
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const size = containerRef.current.clientWidth;
      if (size > 0) {
        setViewportSize(size);
      }
    }
  }, [isOpen, imageSrc]);

  // Carrega as dimensões naturais da imagem
  useEffect(() => {
    if (!imageSrc) {
      setImageDimensions(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setImageDimensions(null);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Cálculos de escala para preenchimento total do quadrado
  const baseScale = imageDimensions
    ? Math.max(viewportSize / imageDimensions.width, viewportSize / imageDimensions.height)
    : 1;

  const currentScale = baseScale * zoom;
  const renderedWidth = imageDimensions ? imageDimensions.width * currentScale : viewportSize;
  const renderedHeight = imageDimensions ? imageDimensions.height * currentScale : viewportSize;

  const clampOffset = useCallback(
    (x: number, y: number, targetZoom = zoom) => {
      if (!imageDimensions) return { x: 0, y: 0 };
      const scale = baseScale * targetZoom;
      const rw = imageDimensions.width * scale;
      const rh = imageDimensions.height * scale;
      const maxX = Math.max(0, (rw - viewportSize) / 2);
      const maxY = Math.max(0, (rh - viewportSize) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [baseScale, imageDimensions, viewportSize, zoom]
  );

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.min(3, Math.max(1, Number(newZoom.toFixed(3))));
    setZoom(clampedZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, clampedZoom));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!imageSrc || !imageDimensions) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = dragStartRef.current.offsetX + dx;
    const newY = dragStartRef.current.offsetY + dy;
    setOffset(clampOffset(newX, newY));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
  };

  // Pinch-to-zoom para celulares touch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
      initialPinchZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchDistanceRef.current;
      handleZoomChange(initialPinchZoomRef.current * factor);
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageSrc(result);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    reader.onerror = () => {
      alert('Erro ao carregar a imagem selecionada.');
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleSalvarRecorte = async () => {
    if (!imageSrc || !imageDimensions) return;

    setIsSaving(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Falha ao processar imagem para recorte.'));
        img.src = imageSrc;
      });

      // Mapeamento das coordenadas renderizadas para as coordenadas naturais
      const cropXRendered = (renderedWidth - viewportSize) / 2 - offset.x;
      const cropYRendered = (renderedHeight - viewportSize) / 2 - offset.y;

      let sx = cropXRendered / currentScale;
      let sy = cropYRendered / currentScale;
      let sWidth = viewportSize / currentScale;
      let sHeight = viewportSize / currentScale;

      // Garantir limites dentro da imagem original
      sx = Math.max(0, Math.min(imageDimensions.width - sWidth, sx));
      sy = Math.max(0, Math.min(imageDimensions.height - sHeight, sy));
      sWidth = Math.min(sWidth, imageDimensions.width - sx);
      sHeight = Math.min(sHeight, imageDimensions.height - sy);

      // Renderiza em canvas quadrado de alta definição (400x400)
      const outputSize = 400;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Falha ao inicializar contexto do Canvas.');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outputSize, outputSize);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      await onSave(croppedDataUrl);
      onClose();
    } catch {
      alert('Não foi possível salvar o recorte da imagem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('Tem certeza que deseja apagar esta imagem?')) {
      setIsDeleting(true);
      try {
        await onDelete();
        onClose();
      } catch {
        alert('Erro ao apagar imagem.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (!isOpen) return null;

  const hasPhoto = !!imageSrc;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl p-5 sm:p-6 animate-slide-up relative max-h-[95dvh] overflow-y-auto border border-white/10 shadow-2xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 sm:hidden shrink-0" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={isSaving || isDeleting}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors active:scale-95 disabled:opacity-40"
          title="Fechar"
        >
          <X size={24} />
        </button>

        {/* Título */}
        <h2 className="text-xl font-bold text-white mb-1 pr-8">{title}</h2>
        <p className="text-xs text-gray-400 mb-5">
          {hasPhoto
            ? 'Arraste a foto e use o zoom para enquadrar o quadrado perfeito.'
            : 'Selecione uma imagem do seu dispositivo para recortar.'}
        </p>

        {/* Input oculto para carregar arquivo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Área do Recortador / Viewport Quadrado */}
        {hasPhoto ? (
          <div className="flex flex-col items-center">
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`w-[260px] h-[260px] sm:w-[280px] sm:h-[280px] relative rounded-2xl overflow-hidden bg-black/80 border-2 border-[#2DD4BF]/60 select-none touch-none shadow-2xl cursor-grab ${
                isDragging ? 'cursor-grabbing border-[#2DD4BF]' : ''
              }`}
            >
              {/* Imagem sendo recortada */}
              <img
                src={imageSrc}
                alt="Enquadramento"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${renderedWidth}px`,
                  height: `${renderedHeight}px`,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />

              {/* Grade de Enquadramento 3x3 (Regra dos Terços) */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>

              {/* Máscara de pré-visualização (circular ou com cantos arredondados) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none select-none">
                <defs>
                  <mask id="avatar-crop-guide-mask">
                    <rect width="100%" height="100%" fill="white" />
                    {maskShape === 'circle' ? (
                      <circle cx="50%" cy="50%" r="48%" fill="black" />
                    ) : (
                      <rect x="4%" y="4%" width="92%" height="92%" rx="20" fill="black" />
                    )}
                  </mask>
                </defs>
                {/* Sombra escura fora do guia */}
                <rect
                  width="100%"
                  height="100%"
                  fill="black"
                  fillOpacity="0.45"
                  mask="url(#avatar-crop-guide-mask)"
                />
                {/* Linha guia de contorno */}
                {maskShape === 'circle' ? (
                  <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke="#2DD4BF"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.85"
                  />
                ) : (
                  <rect
                    x="4%"
                    y="4%"
                    width="92%"
                    height="92%"
                    rx="20"
                    fill="none"
                    stroke="#2DD4BF"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.85"
                  />
                )}
              </svg>

              {/* Marcadores de cantos de recorte estilo câmera */}
              <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#2DD4BF] pointer-events-none" />
              <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#2DD4BF] pointer-events-none" />
              <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#2DD4BF] pointer-events-none" />
              <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#2DD4BF] pointer-events-none" />
            </div>

            {/* Dica de arrastar */}
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-gray-400">
              <Move size={12} className="text-[#2DD4BF]" />
              <span>Arraste para mover a imagem</span>
            </div>

            {/* Controles de Zoom */}
            <div className="w-full max-w-[280px] mt-3.5 bg-[#141a23] border border-white/10 rounded-2xl p-2.5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleZoomChange(zoom - 0.2)}
                disabled={zoom <= 1}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/5 active:scale-90 transition-transform"
                title="Diminuir zoom"
              >
                <ZoomOut size={16} />
              </button>

              <input
                type="range"
                min="1"
                max="3"
                step="0.02"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-[#2c2c2e] rounded-lg appearance-none cursor-pointer accent-[#2DD4BF]"
              />

              <button
                type="button"
                onClick={() => handleZoomChange(zoom + 0.2)}
                disabled={zoom >= 3}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/5 active:scale-90 transition-transform"
                title="Aumentar zoom"
              >
                <ZoomIn size={16} />
              </button>

              <div className="w-px h-4 bg-white/10 mx-0.5" />

              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 text-gray-400 hover:text-[#2DD4BF] rounded-lg hover:bg-white/5 active:scale-90 transition-transform"
                title="Redefinir enquadramento"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
        ) : (
          /* Estado Vazio - Nenhuma Imagem Selecionada */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-[260px] h-[260px] sm:w-[280px] sm:h-[280px] mx-auto rounded-2xl border-2 border-dashed border-white/20 hover:border-[#2DD4BF]/60 bg-black/40 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-[#2DD4BF]/15 flex items-center justify-center text-[#2DD4BF] mb-3 group-hover:scale-105 transition-transform">
              <Camera size={30} />
            </div>
            <p className="text-white font-semibold text-sm mb-1">Escolher imagem</p>
            <p className="text-gray-400 text-xs">Toque para selecionar uma foto da galeria</p>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="mt-6 space-y-2.5">
          {hasPhoto ? (
            <>
              {/* Botão Principal Salvar Recorte */}
              <button
                type="button"
                onClick={handleSalvarRecorte}
                disabled={isSaving || isDeleting}
                className="w-full py-3 px-4 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#2DD4BF]/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    <span>Salvando recorte...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} className="stroke-[2.5px]" />
                    <span>Salvar recorte</span>
                  </>
                )}
              </button>

              {/* Linha com Botão Editar (Trocar Foto) e Apagar Imagem */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving || isDeleting}
                  className="flex-1 py-2.5 px-3 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-white/10 transition-colors active:scale-95 disabled:opacity-50"
                >
                  <Camera size={15} className="text-[#2DD4BF]" />
                  <span>Trocar foto</span>
                </button>

                {onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="flex-1 py-2.5 px-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-red-500/20 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <LoaderCircle size={15} className="animate-spin" />
                        <span>Apagando...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} />
                        <span>Apagar imagem</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Botão quando ainda não tem imagem selecionada */
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#2DD4BF]/20 transition-all active:scale-[0.98]"
            >
              <Upload size={18} className="stroke-[2.5px]" />
              <span>Selecionar foto</span>
            </button>
          )}

          {/* Botão Cancelar */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="w-full py-2.5 text-gray-400 hover:text-white text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
