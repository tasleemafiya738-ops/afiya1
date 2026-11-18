import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileText, AlertTriangle, XCircle } from 'lucide-react';
import type {
  CandidateStage,
  DrugCandidate,
  PersonaRole,
  ReviewDecisionStatus,
} from '../types/discovery';
import { renderSmilesSvg } from '../utils/chemistry';

interface CandidateReviewViewProps {
  candidates: DrugCandidate[];
  initialCandidateId?: string;
  onReviewSaved: (updated: DrugCandidate) => void;
  onInspectInWorkbench: (candidate: DrugCandidate) => void;
}

const PERSONAS: PersonaRole[] = [
  'Medicinal Chemist',
  'Computational Chemist',
  'Pharmacologist',
  'Toxicologist',
];

const DECISIONS: ReviewDecisionStatus[] = [
  'Pending Review',
  'Advance to Hit-to-Lead',
  'Request Wet-Lab Assay',
  'Structural Revision Needed',
  'Rejected — Toxicity Flag',
];

const STAGES: CandidateStage[] = [
  'Hit',
  'Lead Optimization',
  'Preclinical Candidate',
  'Deprioritized',
];

function getDisciplineChecklist(
  role: PersonaRole,
  candidate: DrugCandidate
): Array<{ label: string; value: string; status: 'pass' | 'warn' | 'fail' }> {
  const p = candidate.properties;
  const bio = candidate.analysis.bioactivity;
  const tox = candidate.analysis.toxicity;

  if (role === 'Medicinal Chemist') {
    return [
      {
        label: 'Synthetic Tractability & Stereocenters',
        value: `${p.stereoCenterCount} stereocenters · ${p.ringCount} rings`,
        status: p.stereoCenterCount <= 3 ? 'pass' : 'warn',
      },
      {
        label: 'Lipinski Oral Drug-Likeness',
        value: `${p.lipinskiViolations} violations (MW ${p.molecularWeight} / cLogP ${p.cLogP})`,
        status: p.lipinskiPassed ? 'pass' : 'fail',
      },
      {
        label: 'Proposed Optimization Analogs',
        value: `${candidate.analysis.optimizations.filter((o) => o.validStructure).length} validated scaffolds`,
        status: 'pass',
      },
    ];
  }

  if (role === 'Computational Chemist') {
    return [
      {
        label: 'Estimated Target pIC50',
        value: `${bio.estimatedPic50.toFixed(2)} (${bio.predictedIc50Range})`,
        status: bio.estimatedPic50 >= 7 ? 'pass' : bio.estimatedPic50 >= 6 ? 'warn' : 'fail',
      },
      {
        label: 'Quantitative Drug-Likeness (QED)',
        value: `${p.qedEstimate.toFixed(2)} · TPSA ${p.tpsa} A^2`,
        status: p.qedEstimate >= 0.55 ? 'pass' : 'warn',
      },
      {
        label: 'Model Prediction Confidence',
        value: `${bio.confidencePercent}% (${bio.bindingInteractions.length} pharmacophore contacts)`,
        status: bio.confidencePercent >= 80 ? 'pass' : 'warn',
      },
    ];
  }

  if (role === 'Pharmacologist') {
    return [
      {
        label: 'Predicted Potency Class',
        value: `${bio.activityClass} · ${bio.predictedIc50Range}`,
        status: bio.activityClass === 'Potent' ? 'pass' : bio.activityClass === 'Moderate' ? 'warn' : 'fail',
      },
      {
        label: 'GI Absorption & Veber Rule',
        value: `${tox.giAbsorption} GI · ${p.rotatableBonds} rotatable bonds`,
        status: tox.giAbsorption === 'High' && p.veberPassed ? 'pass' : 'warn',
      },
      {
        label: 'BBB Permeability Window',
        value: `${tox.bbbPenetration} (${p.bbbPermeableWindow ? 'Inside CNS window' : 'Peripheral bias'})`,
        status: 'pass',
      },
    ];
  }

  // Toxicologist
  return [
    {
      label: 'hERG Cardiotoxicity Risk',
      value: tox.hergRisk,
      status: tox.hergRisk === 'Low' ? 'pass' : tox.hergRisk === 'Moderate' ? 'warn' : 'fail',
    },
    {
      label: 'Hepatotoxicity (DILI) & AMES',
      value: `DILI: ${tox.hepatotoxicityRisk} · AMES: ${tox.amesMutagenicityRisk}`,
      status:
        tox.hepatotoxicityRisk === 'Low' && tox.amesMutagenicityRisk === 'Low'
          ? 'pass'
          : tox.hepatotoxicityRisk === 'High' || tox.amesMutagenicityRisk === 'High'
            ? 'fail'
            : 'warn',
    },
    {
      label: 'CYP3A4 & Structural Alerts',
      value: `CYP3A4 ${tox.cyp3a4Inhibition} · ${tox.safetyAlerts.length} alert(s)`,
      status: tox.cyp3a4Inhibition === 'Low' ? 'pass' : 'warn',
    },
  ];
}

export const CandidateReviewView: React.FC<CandidateReviewViewProps> = ({
  candidates,
  initialCandidateId,
  onReviewSaved,
  onInspectInWorkbench,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialCandidateId ?? candidates[0]?.id ?? ''
  );
  const [activePersona, setActivePersona] = useState<PersonaRole>('Medicinal Chemist');

  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0] ?? null;

  const [decision, setDecision] = useState<ReviewDecisionStatus>(
    selected?.review.decision ?? 'Pending Review'
  );
  const [stage, setStage] = useState<CandidateStage>(selected?.stage ?? 'Hit');
  const [reviewerName, setReviewerName] = useState<string>(
    selected?.review.reviewerName ?? 'Dr. Elena Rostova'
  );
  const [notes, setNotes] = useState<string>(selected?.review.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialCandidateId && candidates.some((c) => c.id === initialCandidateId)) {
      setSelectedId(initialCandidateId);
    }
  }, [initialCandidateId, candidates]);

  useEffect(() => {
    if (selected) {
      setDecision(selected.review.decision);
      setStage(selected.stage);
      setReviewerName(selected.review.reviewerName);
      setNotes(selected.review.notes);
      setSaveMessage(null);
    }
  }, [selected?.id]);

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/candidates/${selected.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewerRole: activePersona,
          reviewerName,
          notes,
          stage,
        }),
      });
      const data = (await res.json()) as { candidate?: DrugCandidate; error?: string };
      if (!res.ok || !data.candidate) {
        throw new Error(data.error || 'Failed to save review decision.');
      }
      onReviewSaved(data.candidate);
      setSaveMessage('Review decision recorded and persisted.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save review.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadJson = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dossier.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    if (!selected) return;
    const p = selected.properties;
    const md = `# Candidate Screening Dossier: ${selected.name}

- **Canonical SMILES:** \`${p.canonicalSmiles}\`
- **Formula:** ${p.formula}
- **Target:** ${selected.targetName}
- **Stage:** ${selected.stage}
- **Current Decision:** ${selected.review.decision} (${selected.review.reviewerRole} — ${selected.review.reviewerName})

## Physicochemical Properties
- Molecular Weight: ${p.molecularWeight} g/mol
- Exact Mass: ${p.exactMass} Da
- cLogP: ${p.cLogP}
- cLogS: ${p.cLogS}
- TPSA: ${p.tpsa} A^2
- HBD / HBA: ${p.hbd} / ${p.hba}
- Rotatable Bonds: ${p.rotatableBonds}
- Lipinski Violations: ${p.lipinskiViolations} (${p.lipinskiPassed ? 'Pass' : 'Fail'})

## Biological Activity Prediction
- Predicted IC50 / Ki: ${selected.analysis.bioactivity.predictedIc50Range}
- Estimated pIC50: ${selected.analysis.bioactivity.estimatedPic50}
- Mechanism: ${selected.analysis.bioactivity.mechanismHypothesis}

## ADMET & Toxicity Summary
- Overall Risk: ${selected.analysis.toxicity.overallRisk}
- hERG: ${selected.analysis.toxicity.hergRisk} | Hepatotoxicity: ${selected.analysis.toxicity.hepatotoxicityRisk} | AMES: ${selected.analysis.toxicity.amesMutagenicityRisk}
- Summary: ${selected.analysis.toxicity.toxicologySummary}

## Reviewer Notes
${selected.review.notes}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!selected) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-12 text-center text-sm text-slate-500">
        No candidates are currently queued for review. Screen a molecule in the Workbench first.
      </div>
    );
  }

  const checklist = getDisciplineChecklist(activePersona, selected);
  const svgThumb = renderSmilesSvg(selected.smiles, 280, 170);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Candidate Queue */}
        <aside className="w-full lg:w-[320px] shrink-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Candidate Review Queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {candidates.length} compounds awaiting or completed review
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {candidates.map((cand) => {
              const isSelected = cand.id === selected.id;
              return (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => setSelectedId(cand.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-medium truncate ${
                        isSelected ? 'text-sky-900' : 'text-slate-900'
                      }`}
                    >
                      {cand.name}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                      pIC50 {cand.analysis.bioactivity.estimatedPic50.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {cand.properties.formula} · {cand.stage}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 font-medium">
                    {cand.review.decision}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Multidisciplinary Review Dossier */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  {selected.name}
                </h1>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2 font-mono tabular-nums">
                  <span>{selected.properties.formula}</span>
                  <span aria-hidden="true">·</span>
                  <span>MW {selected.properties.molecularWeight} g/mol</span>
                  <span aria-hidden="true">·</span>
                  <span>{selected.targetName}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onInspectInWorkbench(selected)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Open in Workbench
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Report (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Dossier (.json)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-5 items-center">
              <div className="md:col-span-5 border border-slate-200 rounded-md bg-slate-50/40 flex items-center justify-center h-[190px] overflow-hidden">
                {svgThumb ? (
                  <div dangerouslySetInnerHTML={{ __html: svgThumb }} />
                ) : (
                  <span className="text-xs text-slate-400">Structure unavailable</span>
                )}
              </div>

              <div className="md:col-span-7 space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-700 mb-2">
                    Discipline Review Perspective
                  </div>
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-md">
                    {PERSONAS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setActivePersona(role)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          activePersona === role
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md px-4">
                  {checklist.map((item) => (
                    <div
                      key={item.label}
                      className="py-2.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <span className="text-slate-600">{item.label}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono tabular-nums font-medium ${
                          item.status === 'pass'
                            ? 'text-emerald-700'
                            : item.status === 'warn'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {item.status === 'pass' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {item.status === 'warn' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                        {item.status === 'fail' && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                        <span>{item.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Formal Decision Recording Form */}
          <form
            onSubmit={handleSaveReview}
            className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
          >
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Record Candidate Progression Decision
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sign off as {activePersona} to advance, queue for wet-lab assay, or flag for revision.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Review Decision
                </label>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as ReviewDecisionStatus)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                >
                  {DECISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as CandidateStage)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reviewer Name
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scientific Rationale &amp; Assay Next Steps
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document SAR observations, hERG margins, or required wet-lab assays..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="text-xs text-slate-500">
                {saveMessage ? (
                  <span className="text-emerald-700 font-medium">{saveMessage}</span>
                ) : (
                  <span>
                    Last updated {new Date(selected.review.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {saving ? 'Saving Decision...' : 'Save Review Decision'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};
