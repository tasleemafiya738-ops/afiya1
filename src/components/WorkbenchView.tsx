import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  BiologicalTarget,
  DrugCandidate,
  RiskLevel,
  ScreeningCampaign,
} from '../types/discovery';
import {
  parseAndAnalyzeSmiles,
  REFERENCE_COMPOUNDS,
  renderSmilesSvg,
} from '../utils/chemistry';
import { MoleculeCanvas } from './MoleculeCanvas';
import { PropertyCalibrationRadar } from './PropertyCalibrationRadar';

interface WorkbenchViewProps {
  targets: BiologicalTarget[];
  campaigns: ScreeningCampaign[];
  activeCandidate: DrugCandidate | null;
  onCandidateAnalyzed: (candidate: DrugCandidate) => void;
  onOpenReview: (candidate: DrugCandidate) => void;
  initialTargetId?: string;
}

function RiskLabel({ level, label }: { level: RiskLevel; label?: string }) {
  if (level === 'Low') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{label ?? 'Low Risk'}</span>
      </span>
    );
  }
  if (level === 'Moderate') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{label ?? 'Moderate Risk'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{label ?? 'High Risk'}</span>
    </span>
  );
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  targets,
  campaigns,
  activeCandidate,
  onCandidateAnalyzed,
  onOpenReview,
  initialTargetId,
}) => {
  const [compoundName, setCompoundName] = useState<string>(
    activeCandidate?.name ?? REFERENCE_COMPOUNDS[0].name
  );
  const [smilesInput, setSmilesInput] = useState<string>(
    activeCandidate?.smiles ?? REFERENCE_COMPOUNDS[0].smiles
  );
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    initialTargetId ?? activeCandidate?.targetId ?? targets[0]?.id ?? 'tgt-egfr'
  );
  const [customTargetName, setCustomTargetName] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    activeCandidate?.campaignId ?? campaigns[0]?.id ?? ''
  );
  const [saveToCampaign, setSaveToCampaign] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Sync when user selects a different candidate from Campaigns / Review
  React.useEffect(() => {
    if (activeCandidate) {
      setCompoundName(activeCandidate.name);
      setSmilesInput(activeCandidate.smiles);
      setSelectedTargetId(activeCandidate.targetId);
      setSelectedCampaignId(activeCandidate.campaignId);
    }
  }, [activeCandidate]);

  React.useEffect(() => {
    if (initialTargetId) {
      setSelectedTargetId(initialTargetId);
    }
  }, [initialTargetId]);

  const parsed = useMemo(() => parseAndAnalyzeSmiles(smilesInput), [smilesInput]);

  // Show the saved AI analysis if the current SMILES & target match the activeCandidate
  const matchingAnalysis =
    activeCandidate &&
    parsed.valid &&
    parsed.properties?.canonicalSmiles === activeCandidate.properties.canonicalSmiles &&
    selectedTargetId === activeCandidate.targetId
      ? activeCandidate
      : null;

  const handleLoadReference = (ref: (typeof REFERENCE_COMPOUNDS)[number]) => {
    setCompoundName(ref.name);
    setSmilesInput(ref.smiles);
    setSelectedTargetId(ref.suggestedTargetId);
    setApiError(null);
  };

  const handleRunScreening = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!parsed.valid) return;
    if (selectedTargetId === 'custom' && !customTargetName.trim()) {
      setApiError('Enter a custom biological target name before running AI screening.');
      return;
    }

    setIsAnalyzing(true);
    setApiError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: compoundName,
          smiles: smilesInput,
          targetId: selectedTargetId === 'custom' ? undefined : selectedTargetId,
          customTargetName: selectedTargetId === 'custom' ? customTargetName : undefined,
          campaignId: selectedCampaignId,
          saveToCampaign,
        }),
      });

      const data = (await response.json()) as { candidate?: DrugCandidate; error?: string };
      if (!response.ok || !data.candidate) {
        throw new Error(data.error || `Screening failed with status ${response.status}.`);
      }

      onCandidateAnalyzed(data.candidate);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to complete AI screening.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadAnalog = (title: string, modifiedSmiles: string) => {
    setCompoundName(`${compoundName.split(' (')[0]} — ${title.slice(0, 26)}`);
    setSmilesInput(modifiedSmiles);
    setApiError(null);
  };

  const activeProps = parsed.properties;

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Control & Parameter Column */}
        <aside className="w-full lg:w-[350px] shrink-0 space-y-5">
          <form
            onSubmit={handleRunScreening}
            className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
          >
            <div>
              <h1 className="font-display text-base font-semibold text-slate-900">
                Molecular Screening Input
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter SMILES notation to evaluate descriptors, target activity, and toxicity.
              </p>
            </div>

            <div>
              <label
                htmlFor="compound-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Compound Identifier
              </label>
              <input
                id="compound-name"
                type="text"
                value={compoundName}
                onChange={(e) => setCompoundName(e.target.value)}
                placeholder="e.g., MV-502 Kinase Lead"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="smiles-input" className="text-xs font-medium text-slate-700">
                  SMILES Notation
                </label>
                {parsed.valid && parsed.properties ? (
                  <span className="text-xs font-mono text-emerald-700">
                    Valid · {parsed.properties.formula}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-rose-600">Invalid syntax</span>
                )}
              </div>
              <textarea
                id="smiles-input"
                rows={3}
                value={smilesInput}
                onChange={(e) => setSmilesInput(e.target.value)}
                placeholder="Enter SMILES string, e.g., CC(=O)Oc1ccccc1C(=O)O"
                spellCheck={false}
                className="w-full px-3 py-2 text-xs font-mono leading-relaxed bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
              />
              {!parsed.valid && parsed.error && (
                <p className="text-xs text-rose-600 mt-1">{parsed.error}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="target-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Biological Target
              </label>
              <select
                id="target-select"
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.geneSymbol} — {t.name}
                  </option>
                ))}
                <option value="custom">Custom Therapeutic Target...</option>
              </select>
            </div>

            {selectedTargetId === 'custom' && (
              <div>
                <label
                  htmlFor="custom-target"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Custom Target Name
                </label>
                <input
                  id="custom-target"
                  type="text"
                  value={customTargetName}
                  onChange={(e) => setCustomTargetName(e.target.value)}
                  placeholder="e.g., BRAF V600E Kinase"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="campaign-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Screening Campaign
              </label>
              <select
                id="campaign-select"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveToCampaign}
                onChange={(e) => setSaveToCampaign(e.target.checked)}
                className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
              <span>Save screened candidate to campaign library</span>
            </label>

            {apiError && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800"
              >
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={!parsed.valid || isAnalyzing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Predicting Activity &amp; Toxicity...</span>
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4" />
                  <span>Run AI Screening</span>
                </>
              )}
            </button>
          </form>

          {/* Reference Compounds Library */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Reference Compound Library
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Load validated clinical scaffolds for rapid benchmarking
            </p>
            <div className="divide-y divide-slate-100">
              {REFERENCE_COMPOUNDS.map((ref) => (
                <button
                  key={ref.name}
                  type="button"
                  onClick={() => handleLoadReference(ref)}
                  className="w-full py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 px-1.5 -mx-1.5 rounded transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 group-hover:text-sky-700 truncate">
                      {ref.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{ref.classLabel}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-700 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Viewport Stage */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          <MoleculeCanvas
            compoundName={compoundName}
            svg={parsed.svg}
            error={parsed.error}
            properties={activeProps}
          />

          {/* Physicochemical Descriptors + Radar */}
          {activeProps && (
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
              <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        Physicochemical &amp; Drug-Likeness Profile
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Deterministic descriptors calculated directly from SMILES graph
                      </p>
                    </div>
                    <div className="text-xs font-medium">
                      {activeProps.lipinskiPassed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            Lipinski Pass ({activeProps.lipinskiViolations} violations)
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>
                            Lipinski Fail ({activeProps.lipinskiViolations} violations)
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 pt-4">
                    <div>
                      <div className="text-xs text-slate-500">Molecular Weight</div>
                      <div className="mt-0.5 font-mono tabular-nums">
                        <span className="text-xl font-semibold text-slate-900">
                          {activeProps.molecularWeight.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">g/mol</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Exact Mass</div>
                      <div className="mt-0.5 font-mono tabular-nums">
                        <span className="text-xl font-semibold text-slate-900">
                          {activeProps.exactMass.toFixed(4)}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">Da</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">cLogP (Octanol/Water)</div>
                      <div className="mt-0.5 font-mono tabular-nums">
                        <span className="text-xl font-semibold text-slate-900">
                          {activeProps.cLogP.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Polar Surface Area</div>
                      <div className="mt-0.5 font-mono tabular-nums">
                        <span className="text-xl font-semibold text-slate-900">
                          {activeProps.tpsa.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">A^2</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Aqueous Solubility (cLogS)</div>
                      <div className="mt-0.5 font-mono tabular-nums">
                        <span className="text-xl font-semibold text-slate-900">
                          {activeProps.cLogS.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">logM</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">H-Bond Donors / Acceptors</div>
                      <div className="mt-0.5 font-mono tabular-nums">
                        <span className="text-xl font-semibold text-slate-900">
                          {activeProps.hbd} / {activeProps.hba}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
                  <span>Rotatable Bonds: {activeProps.rotatableBonds}</span>
                  <span aria-hidden="true">·</span>
                  <span>Stereocenters: {activeProps.stereoCenterCount}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Veber Oral Rule: {activeProps.veberPassed ? 'Pass' : 'Exceeds Limit'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    BBB Window: {activeProps.bbbPermeableWindow ? 'Permeable' : 'Restricted'}
                  </span>
                </div>
              </div>

              <div className="xl:col-span-5">
                <PropertyCalibrationRadar properties={activeProps} />
              </div>
            </section>
          )}

          {/* AI Bioactivity, Toxicity & Optimization Dossier */}
          {matchingAnalysis ? (
            <div className="space-y-6">
              {/* Executive Summary */}
              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      AI Screening Assessment
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>Target: {matchingAnalysis.analysis.bioactivity.targetName}</span>
                      <span aria-hidden="true">·</span>
                      <span>Stage: {matchingAnalysis.stage}</span>
                      <span aria-hidden="true">·</span>
                      <span>Review: {matchingAnalysis.review.decision}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReview(matchingAnalysis)}
                    className="px-3 py-1.5 text-xs font-medium text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Open Candidate Review
                  </button>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {matchingAnalysis.analysis.executiveSummary}
                </p>
              </section>

              {/* Bioactivity & Toxicity Split */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Bioactivity Card */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        Biological Activity Prediction
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {matchingAnalysis.analysis.bioactivity.targetName}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-sky-700">
                      {matchingAnalysis.analysis.bioactivity.activityClass} ·{' '}
                      {matchingAnalysis.analysis.bioactivity.confidencePercent}% conf.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">Predicted IC50 / Ki</div>
                      <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                        {matchingAnalysis.analysis.bioactivity.predictedIc50Range}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Estimated pIC50</div>
                      <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                        {matchingAnalysis.analysis.bioactivity.estimatedPic50.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">
                      Mechanism Hypothesis
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {matchingAnalysis.analysis.bioactivity.mechanismHypothesis}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1.5">
                      Predicted Binding Interactions
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {matchingAnalysis.analysis.bioactivity.bindingInteractions.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-mono text-slate-400 shrink-0">
                            0{i + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Selectivity: </span>
                    {matchingAnalysis.analysis.bioactivity.selectivityNotes}
                  </div>
                </div>

                {/* ADMET & Toxicity Card */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        ADMET &amp; Toxicity Assessment
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Safety pharmacology, CYP liability &amp; absorption
                      </p>
                    </div>
                    <RiskLabel level={matchingAnalysis.analysis.toxicity.overallRisk} />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">hERG Cardiotoxicity</span>
                      <RiskLabel
                        level={matchingAnalysis.analysis.toxicity.hergRisk}
                        label={matchingAnalysis.analysis.toxicity.hergRisk}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">Hepatotoxicity (DILI)</span>
                      <RiskLabel
                        level={matchingAnalysis.analysis.toxicity.hepatotoxicityRisk}
                        label={matchingAnalysis.analysis.toxicity.hepatotoxicityRisk}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">AMES Mutagenicity</span>
                      <RiskLabel
                        level={matchingAnalysis.analysis.toxicity.amesMutagenicityRisk}
                        label={matchingAnalysis.analysis.toxicity.amesMutagenicityRisk}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">CYP3A4 Inhibition</span>
                      <RiskLabel
                        level={matchingAnalysis.analysis.toxicity.cyp3a4Inhibition}
                        label={matchingAnalysis.analysis.toxicity.cyp3a4Inhibition}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-600">GI Absorption</span>
                      <span className="font-mono font-medium text-slate-800">
                        {matchingAnalysis.analysis.toxicity.giAbsorption}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-600">BBB Penetration</span>
                      <span className="font-mono font-medium text-slate-800">
                        {matchingAnalysis.analysis.toxicity.bbbPenetration}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">
                      Metabolic Stability &amp; Clearance
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {matchingAnalysis.analysis.toxicity.metabolicStability}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                      <span>Structural Safety Alerts</span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {matchingAnalysis.analysis.toxicity.safetyAlerts.map((alert, idx) => (
                        <li key={idx}>• {alert}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                    {matchingAnalysis.analysis.toxicity.toxicologySummary}
                  </div>
                </div>
              </section>

              {/* Medicinal Chemistry Structural Optimizations */}
              {matchingAnalysis.analysis.optimizations.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="mb-4">
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      Recommended Structural Optimizations
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      AI-proposed medicinal chemistry analogs verified against OpenChemLib valence rules
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {matchingAnalysis.analysis.optimizations.map((opt, idx) => {
                      const thumbSvg = opt.validStructure
                        ? renderSmilesSvg(opt.modifiedSmiles, 230, 120)
                        : null;

                      return (
                        <div
                          key={idx}
                          className="border border-slate-200 rounded-md p-4 flex flex-col justify-between gap-3 bg-slate-50/40"
                        >
                          <div className="space-y-2.5">
                            <div className="text-sm font-semibold text-slate-900">
                              {opt.title}
                            </div>

                            {thumbSvg ? (
                              <div
                                className="h-[120px] bg-white border border-slate-200 rounded flex items-center justify-center overflow-hidden"
                                dangerouslySetInnerHTML={{ __html: thumbSvg }}
                              />
                            ) : (
                              <div className="h-[120px] bg-white border border-slate-200 rounded flex items-center justify-center px-3 text-center text-xs text-slate-500">
                                Preview unavailable for proposed SMILES
                              </div>
                            )}

                            {opt.validStructure && opt.formula && (
                              <div className="text-[11px] font-mono tabular-nums text-slate-600 flex flex-wrap gap-x-2 gap-y-0.5">
                                <span>{opt.formula}</span>
                                <span aria-hidden="true">·</span>
                                <span>MW {opt.molecularWeight?.toFixed(1)}</span>
                                <span aria-hidden="true">·</span>
                                <span>cLogP {opt.cLogP?.toFixed(2)}</span>
                              </div>
                            )}

                            <p className="text-xs text-slate-600 leading-relaxed">
                              {opt.rationale}
                            </p>
                            <p className="text-xs text-slate-700 font-medium">
                              {opt.expectedImpact}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              disabled={!opt.validStructure}
                              onClick={() => handleLoadAnalog(opt.title, opt.modifiedSmiles)}
                              className="w-full px-3 py-1.5 text-xs font-medium text-sky-700 hover:text-white bg-white hover:bg-sky-700 disabled:opacity-40 border border-sky-200 rounded transition-colors whitespace-nowrap shrink-0"
                            >
                              Load Analog into Workbench
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <section className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Ready for AI Bioactivity &amp; Toxicity Screening
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                  Physicochemical properties above are calculated in real time. Click{' '}
                  <span className="font-medium text-slate-900">Run AI Screening</span> in the left
                  panel to predict target IC50 affinity, binding pocket interactions, hERG/DILI
                  toxicity alerts, and structural optimization analogs.
                </p>
              </div>
              <button
                type="button"
                disabled={!parsed.valid || isAnalyzing}
                onClick={() => handleRunScreening()}
                className="px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {isAnalyzing ? 'Screening...' : 'Run AI Screening'}
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
