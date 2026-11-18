import React, { useState } from 'react';
import { Check, Copy, Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { PhysicochemicalProperties } from '../types/discovery';

interface MoleculeCanvasProps {
  compoundName: string;
  svg: string | undefined;
  error: string | undefined;
  properties: PhysicochemicalProperties | undefined;
}

export const MoleculeCanvas: React.FC<MoleculeCanvasProps> = ({
  compoundName,
  svg,
  error,
  properties,
}) => {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  const handleCopySmiles = async () => {
    if (!properties?.canonicalSmiles) return;
    try {
      await navigator.clipboard.writeText(properties.canonicalSmiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  const handleDownloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${compoundName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'molecule'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorCoords({
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    });
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
            {compoundName || '2D Molecular Structure Viewport'}
          </h2>
          {properties ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              <span>{properties.formula}</span>
              <span aria-hidden="true">·</span>
              <span>{properties.heavyAtomCount} heavy atoms</span>
              <span aria-hidden="true">·</span>
              <span>{properties.bondCount} bonds</span>
              <span aria-hidden="true">·</span>
              <span>{properties.ringCount} rings</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">
              Awaiting valid SMILES syntax
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
            aria-label="Zoom out structure"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
            className="px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.15).toFixed(2))))}
            aria-label="Zoom in structure"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Fit to viewport"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={!svg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 rounded border border-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorCoords(null)}
        className="relative h-[300px] w-full flex items-center justify-center overflow-hidden cursor-crosshair bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] bg-white"
      >
        {svg ? (
          <div
            className="transition-transform duration-150 ease-out select-none"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="max-w-md px-6 py-4 bg-white border border-rose-200 rounded-md text-center">
            <p className="text-sm font-medium text-rose-700">Unable to Render Structure</p>
            <p className="text-xs text-slate-600 mt-1">
              {error || 'Enter a valid SMILES notation string in the control rail.'}
            </p>
          </div>
        )}

        <div className="absolute bottom-2.5 right-3 pointer-events-none text-[11px] font-mono tabular-nums text-slate-400 bg-white/90 px-2 py-0.5 border border-slate-200 rounded">
          {cursorCoords ? `X:${cursorCoords.x} Y:${cursorCoords.y}` : '2D Coordinate Plane'}
        </div>
      </div>

      {properties && (
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-slate-500 shrink-0">Canonical SMILES</span>
            <code className="text-xs font-mono text-slate-800 truncate">
              {properties.canonicalSmiles}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopySmiles}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
};
