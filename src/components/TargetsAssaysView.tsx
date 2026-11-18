import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { AssayRecord, BiologicalTarget, DrugCandidate } from '../types/discovery';

interface TargetsAssaysViewProps {
  targets: BiologicalTarget[];
  assays: AssayRecord[];
  candidates: DrugCandidate[];
  onScreenTarget: (targetId: string) => void;
}

export const TargetsAssaysView: React.FC<TargetsAssaysViewProps> = ({
  targets,
  assays,
  candidates,
  onScreenTarget,
}) => {
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const areas = ['All', ...Array.from(new Set(targets.map((t) => t.therapeuticArea)))];

  const filteredTargets =
    selectedArea === 'All'
      ? targets
      : targets.filter((t) => t.therapeuticArea === selectedArea);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Biological Targets &amp; Assay Panels
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Structural binding pockets, PDB crystal references, and downstream validation assays.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
          {areas.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setSelectedArea(area)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedArea === area
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Targets Directory Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredTargets.map((target) => {
          const screenedCount = candidates.filter((c) => c.targetId === target.id).length;
          const targetAssays = assays.filter((a) => a.targetId === target.id);

          return (
            <div
              key={target.id}
              className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {target.geneSymbol} · PDB {target.pdbId} · {target.proteinClass}
                  </div>
                  <h2 className="font-display text-base font-semibold text-slate-900 mt-1">
                    {target.name}
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5">{target.therapeuticArea}</div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700">Binding Site Profile</div>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {target.bindingSiteProfile}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700">Primary Assay Protocol</div>
                  <p className="text-xs text-slate-600 mt-1">{target.assayProtocol}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {screenedCount} screened · {targetAssays.length} assays
                </span>
                <button
                  type="button"
                  onClick={() => onScreenTarget(target.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 hover:text-white bg-sky-50 hover:bg-sky-700 border border-sky-200 rounded transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Screen Target</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Assay Protocols Matrix */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Standardized Screening &amp; Safety Assay Panels
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Wet-lab and ADMET validation criteria linked to discovery target series
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-5">Assay Name</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Primary Readout</th>
                <th className="py-2.5 px-4">Format</th>
                <th className="py-2.5 px-5">Go / No-Go Acceptance Criteria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {assays.map((assay) => (
                <tr key={assay.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5 font-medium text-slate-900">{assay.name}</td>
                  <td className="py-3 px-4 text-slate-600">{assay.assayType}</td>
                  <td className="py-3 px-4 font-mono text-slate-700">{assay.readoutMetric}</td>
                  <td className="py-3 px-4 text-slate-600">{assay.throughput}</td>
                  <td className="py-3 px-5 text-slate-700">{assay.acceptanceCriteria}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
