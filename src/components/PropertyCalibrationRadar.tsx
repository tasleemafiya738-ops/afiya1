import React, { useState } from 'react';
import type { PhysicochemicalProperties } from '../types/discovery';

interface PropertyCalibrationRadarProps {
  properties: PhysicochemicalProperties;
}

interface AxisConfig {
  label: string;
  value: number;
  limit: number;
  unit: string;
}

export const PropertyCalibrationRadar: React.FC<PropertyCalibrationRadarProps> = ({
  properties,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const axes: AxisConfig[] = [
    { label: 'MW', value: properties.molecularWeight, limit: 500, unit: 'g/mol' },
    { label: 'cLogP', value: Math.max(0, properties.cLogP), limit: 5, unit: '' },
    { label: 'TPSA', value: properties.tpsa, limit: 140, unit: 'A^2' },
    { label: 'HBD', value: properties.hbd, limit: 5, unit: '' },
    { label: 'HBA', value: properties.hba, limit: 10, unit: '' },
    { label: 'RotB', value: properties.rotatableBonds, limit: 10, unit: '' },
  ];

  const size = 270;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 86;

  // Lipinski/Veber threshold ring sits at 75% of maxRadius so slight exceedances remain visible inside 100% radius
  const thresholdRadius = maxRadius * 0.76;

  const getPoint = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const clampedRatio = Math.min(1.25, Math.max(0.08, ratio));
    const r = clampedRatio * thresholdRadius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const gridLevels = [0.33, 0.66, 1.0];

  const dataPoints = axes.map((axis, idx) => getPoint(idx, axis.value / axis.limit));
  const dataPolygon = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const thresholdPoints = axes.map((_, idx) => getPoint(idx, 1.0));
  const thresholdPolygon = thresholdPoints
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const hoveredAxis = hoveredIdx !== null ? axes[hoveredIdx] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Oral Drug-Space Calibration
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Normalized against Lipinski &amp; Veber upper limits
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-600">
          QED {properties.qedEstimate.toFixed(2)}
        </span>
      </div>

      <div className="flex justify-center my-2">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          role="img"
          aria-label="Radar chart of molecular descriptors relative to oral drug-likeness thresholds"
        >
          {gridLevels.map((level) => {
            const pts = axes
              .map((_, idx) => {
                const p = getPoint(idx, level);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={level}
                points={pts}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={1}
              />
            );
          })}

          {axes.map((axis, idx) => {
            const outer = getPoint(idx, 1.2);
            const labelPt = getPoint(idx, 1.42);
            return (
              <g key={axis.label}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-600 text-[10px] font-mono font-medium"
                >
                  {axis.label}
                </text>
              </g>
            );
          })}

          <polygon
            points={thresholdPolygon}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.25}
            strokeDasharray="3 3"
          />

          <polygon
            points={dataPolygon}
            fill="rgba(2, 132, 199, 0.16)"
            stroke="#0284c7"
            strokeWidth={2}
          />

          {dataPoints.map((pt, idx) => {
            const exceeded = axes[idx].value > axes[idx].limit;
            return (
              <circle
                key={axes[idx].label}
                cx={pt.x}
                cy={pt.y}
                r={hoveredIdx === idx ? 5 : 3.5}
                fill={exceeded ? '#dc2626' : '#0284c7'}
                stroke="#ffffff"
                strokeWidth={1.5}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        {hoveredAxis ? (
          <div className="font-mono tabular-nums text-slate-700">
            <span>{hoveredAxis.label}: </span>
            <span className="font-semibold text-slate-900">
              {hoveredAxis.value} {hoveredAxis.unit}
            </span>
            <span className="text-slate-400">
              {' '}
              / limit {hoveredAxis.limit} {hoveredAxis.unit}
            </span>
          </div>
        ) : (
          <span className="text-slate-500">
            Dashed polygon marks 100% oral rule boundary
          </span>
        )}
      </div>
    </div>
  );
};
