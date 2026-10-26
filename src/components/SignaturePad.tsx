import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  signatoryRole: string;
  signatoryName?: string;
  onSave: (dataUrl: string) => void;
  initialValue?: string;
  required?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  signatoryRole,
  signatoryName,
  onSave,
  initialValue,
  required = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(initialValue);

  useEffect(() => {
    if (initialValue) {
      setPreviewUrl(initialValue);
      setHasDrawn(true);
    }
  }, [initialValue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置高分辨率适配
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    // 笔迹色取自令牌层 --color-text：用一个隐藏探针让浏览器把 var() 解析成实际色值，
    // 全程不出现任何硬编码颜色（Hallmark gate 05）
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--color-text)';
    document.body.appendChild(probe);
    const inkColor = getComputedStyle(probe).color || 'currentColor';
    probe.remove();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setPreviewUrl(undefined);
    onSave('');
  };

  return (
    <div className="border border-border bg-surface rounded-sm p-3 shadow-raise flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="w-4 h-4 text-ok" />
          <span className="text-sm font-semibold text-text-2">{label}</span>
          <span className="tag num">
            {signatoryRole}
          </span>
          {signatoryName && (
            <span className="tag">
              {signatoryName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasDrawn && (
            <span className="text-xs text-ok flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5" /> 已签字
            </span>
          )}
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-text-3 hover:text-danger flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-2 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> 重签
          </button>
        </div>
      </div>

      <div className="relative border border-dashed border-border-2 rounded-sm bg-bg/70 overflow-hidden touch-none h-28 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-text-3 gap-1 select-none">
            <span className="text-xs font-sans tracking-wide">请在此区域手写工整电子签名</span>
            <span className="text-xs text-text-3/80">支持触控板、鼠标及平板手写</span>
          </div>
        )}
      </div>
      {required && !hasDrawn && (
        <p className="text-xs text-accent">※ 此项为出库/审计必要凭证，请完成手写签名</p>
      )}
    </div>
  );
};
