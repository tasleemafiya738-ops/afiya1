import React, { useState } from 'react';
import type { DrugCandidate } from '../types/discovery';

interface ChemicalSpacePlotProps {
  candidates: DrugCandidate[];
  selectedCandidateId?: string;
  onSelectCandidate: (candidate: DrugCandidate) => void;
}

export const ChemicalSpacePlot: React.FC<ChemicalSpacePlotProps> = ({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
}) => {
  const [hovered, setHovered] = useState<DrugCandidate | null>(null);

  const width = 560;
  const height = 270;
  const pad = { top: 20, right: 24, bottom: 38, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const minLogP = -1;
  const maxLogP = 7;
  const minTpsa = 0;
  const maxTpsa = 180;

  const xScale = (val: number) =>
    pad.left + ((Math.min(maxLogP, Math.max(minLogP, val)) - minLogP) / (maxLogP - minLogP)) * plotW;

  const yScale = (val: number) =>
    pad.top + plotH - ((Math.min(maxTpsa, Math.max(minTpsa, val)) - minTpsa) / (maxTpsa - minTpsa)) * plotH;

  // GI Absorption envelope (TPSA <= 140, cLogP <= 5)
  const giRect = {
    x: xScale(-0.5),
    y: yScale(140),
    w: xScale(5) - xScale(-0.5),
    h: yScale(0) - yScale(140),
  };

  // BBB Permeability window (TPSA <= 90, cLogP 0.5..4.5)
  const bbbRect = {
    x: xScale(0.5),
    y: yScale(90),
    w: xScale(4.5) - xScale(0.5),
    h: yScale(0) - yScale(90),
  };

  const xTicks = [-1, 0, 1, 2, 3, 4, 5, 6, 7];
  const yTicks = [0, 45, 90, 140, 180];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Chemical Space &amp; Permeability Envelope (cLogP vs. TPSA)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any compound marker to inspect its full screening dossier
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-100 border border-sky-400" />
            GI Absorptive (TPSA &le; 140)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-100 border border-emerald-500" />
            BBB Window (TPSA &lt; 90)
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[290px] select-none"
          role="img"
          aria-label="Scatter plot of cLogP versus TPSA for screened drug candidates"
        >
          {/* GI Absorption region */}
          <rect
            x={giRect.x}
            y={giRect.y}
            width={giRect.w}
            height={giRect.h}
            fill="rgba(14, 165, 233, 0.06)"
            stroke="#bae6fd"
            strokeWidth={1}
            strokeDasharray="4 3"
          />

          {/* BBB Permeability region */}
          <rect
            x={bbbRect.x}
            y={bbbRect.y}
            width={bbbRect.w}
            height={bbbRect.h}
            fill="rgba(16, 185, 129, 0.07)"
            stroke="#a7f3d0"
            strokeWidth={1}
          />

          {/* Gridlines */}
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={xScale(tick)}
                y1={pad.top}
                x2={xScale(tick)}
                y2={pad.top + plotH}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
              <text
                x={xScale(tick)}
                y={pad.top + plotH + 16}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}

          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={pad.left}
                y1={yScale(tick)}
                x2={pad.left + plotW}
                y2={yScale(tick)}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line
            x1={pad.left}
            y1={pad.top + plotH}
            x2={pad.left + plotW}
            y2={pad.top + plotH}
            stroke="#cbd5e1"
            strokeWidth={1}
          />
          <line
            x1={pad.left}
            y1={pad.top}
            x2={pad.left}
            y2={pad.top + plotH}
            stroke="#cbd5e1"
            strokeWidth={1}
          />

          <text
            x={pad.left + plotW / 2}
            y={height - 6}
            textAnchor="middle"
            className="fill-slate-600 text-[10px] font-mono"
          >
            cLogP (Lipophilicity)
          </text>
          <text
            x={14}
            y={pad.top + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
            className="fill-slate-600 text-[10px] font-mono"
          >
            TPSA (A^2)
          </text>

          {/* Candidate points */}
          {candidates.map((cand) => {
            const cx = xScale(cand.properties.cLogP);
            const cy = yScale(cand.properties.tpsa);
            const isSelected = cand.id === selectedCandidateId;
            const riskColor =
              cand.analysis.toxicity.overallRisk === 'High'
                ? '#dc2626'
                : cand.analysis.toxicity.overallRisk === 'Moderate'
                  ? '#d97706'
                  : '#0284c7';

            return (
              <g
                key={cand.id}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(cand)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectCandidate(cand)}
              >
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={hovered?.id === cand.id ? 6.5 : 5}
                  fill={riskColor}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </svg>

        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs min-h-[24px]">
          {hovered ? (
            <div className="font-mono tabular-nums text-slate-700 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900 font-sans">{hovered.name}</span>
              <span aria-hidden="true">·</span>
              <span>cLogP {hovered.properties.cLogP}</span>
              <span aria-hidden="true">·</span>
              <span>TPSA {hovered.properties.tpsa} A^2</span>
              <span aria-hidden="true">·</span>
              <span>pIC50 {hovered.analysis.bioactivity.estimatedPic50.toFixed(2)}</span>
              <span aria-hidden="true">·</span>
              <span>Tox: {hovered.analysis.toxicity.overallRisk}</span>
            </div>
          ) : (
            <span className="text-slate-500">
              Showing {candidates.length} screened molecules · Color encodes overall toxicity risk
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
