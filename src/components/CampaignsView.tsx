import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Search, Trash2, AlertTriangle, XCircle } from 'lucide-react';
import type {
  BiologicalTarget,
  CandidateStage,
  DrugCandidate,
  RiskLevel,
  ScreeningCampaign,
} from '../types/discovery';
import { renderSmilesSvg } from '../utils/chemistry';
import { ChemicalSpacePlot } from './ChemicalSpacePlot';

interface CampaignsViewProps {
  campaigns: ScreeningCampaign[];
  targets: BiologicalTarget[];
  candidates: DrugCandidate[];
  onInspectCandidate: (candidate: DrugCandidate) => void;
  onCreateCampaign: (campaign: ScreeningCampaign) => void;
  onDeleteCandidate: (id: string) => void;
  onOpenBatchModal: () => void;
}

function RiskText({ risk }: { risk: RiskLevel }) {
  if (risk === 'Low') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Low</span>
      </span>
    );
  }
  if (risk === 'Moderate') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Moderate</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
      <XCircle className="w-3.5 h-3.5" />
      <span>High</span>
    </span>
  );
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  targets,
  candidates,
  onInspectCandidate,
  onCreateCampaign,
  onDeleteCandidate,
  onOpenBatchModal,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<CandidateStage | 'All'>('All');
  const [showNewForm, setShowNewForm] = useState<boolean>(false);

  // New campaign state
  const [newName, setNewName] = useState('');
  const [newTargetId, setNewTargetId] = useState(targets[0]?.id ?? '');
  const [newLead, setNewLead] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [creating, setCreating] = useState(false);

  const campaignCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (selectedCampaignId !== 'all' && c.campaignId !== selectedCampaignId) return false;
      if (stageFilter !== 'All' && c.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.smiles.toLowerCase().includes(q) ||
          c.targetName.toLowerCase().includes(q) ||
          c.properties.formula.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [candidates, selectedCampaignId, stageFilter, searchQuery]);

  const metrics = useMemo(() => {
    const scope =
      selectedCampaignId === 'all'
        ? candidates
        : candidates.filter((c) => c.campaignId === selectedCampaignId);
    const total = scope.length;
    const potent = scope.filter((c) => c.analysis.bioactivity.activityClass === 'Potent').length;
    const lipinskiPass = scope.filter((c) => c.properties.lipinskiPassed).length;
    const lowTox = scope.filter((c) => c.analysis.toxicity.overallRisk === 'Low').length;
    return {
      total,
      potent,
      lipinskiRate: total > 0 ? Math.round((lipinskiPass / total) * 100) : 0,
      lowTox,
    };
  }, [candidates, selectedCampaignId]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTargetId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          targetId: newTargetId,
          leadScientist: newLead,
          objective: newObjective,
        }),
      });
      if (res.ok) {
        const created = (await res.json()) as ScreeningCampaign;
        onCreateCampaign(created);
        setSelectedCampaignId(created.id);
        setNewName('');
        setNewLead('');
        setNewObjective('');
        setShowNewForm(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
      {/* Header & Campaign Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Molecular Screening Campaigns
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Compare screened compounds, permeability envelopes, and lead progression stages.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewForm((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
          <button
            type="button"
            onClick={onOpenBatchModal}
            className="px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Batch Screen Library
          </button>
        </div>
      </div>

      {showNewForm && (
        <form
          onSubmit={handleCreateCampaign}
          className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Campaign Title
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., KRAS Switch-II Optimization"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Primary Target
            </label>
            <select
              value={newTargetId}
              onChange={(e) => setNewTargetId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.geneSymbol} — {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Lead Scientist
            </label>
            <input
              type="text"
              value={newLead}
              onChange={(e) => setNewLead(e.target.value)}
              placeholder="e.g., Dr. Elena Rostova"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-md whitespace-nowrap shrink-0"
            >
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Campaign Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSelectedCampaignId('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            selectedCampaignId === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Campaigns ({candidates.length})
        </button>
        {campaigns.map((cmp) => (
          <button
            key={cmp.id}
            type="button"
            onClick={() => setSelectedCampaignId(cmp.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              selectedCampaignId === cmp.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {cmp.name}
          </button>
        ))}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Screened Candidates</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {metrics.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Potent Target Hits</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {metrics.potent}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Lipinski Oral Compliance</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {metrics.lipinskiRate}
            <span className="text-xs text-slate-400 ml-1">%</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Low Toxicity Risk</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {metrics.lowTox}
          </div>
        </div>
      </div>

      {/* Chemical Space Scatter Plot */}
      <ChemicalSpacePlot
        candidates={campaignCandidates}
        onSelectCandidate={onInspectCandidate}
      />

      {/* Screening Data Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, formula, target, SMILES..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
            {(['All', 'Hit', 'Lead Optimization', 'Preclinical Candidate', 'Deprioritized'] as const).map(
              (stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(stage)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    stageFilter === stage
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {stage}
                </button>
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Structure</th>
                <th className="py-2.5 px-4">Compound &amp; Target</th>
                <th className="py-2.5 px-4 text-right">MW (g/mol)</th>
                <th className="py-2.5 px-4 text-right">cLogP</th>
                <th className="py-2.5 px-4 text-right">TPSA</th>
                <th className="py-2.5 px-4 text-right">pIC50</th>
                <th className="py-2.5 px-4">Toxicity</th>
                <th className="py-2.5 px-4">Stage / Review</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {campaignCandidates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    No drug candidates match the current campaign or filter criteria.
                  </td>
                </tr>
              ) : (
                campaignCandidates.map((cand) => {
                  const thumb = renderSmilesSvg(cand.smiles, 96, 52);
                  return (
                    <tr
                      key={cand.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2 px-4 w-[110px]">
                        {thumb ? (
                          <div
                            className="w-24 h-12 bg-white border border-slate-200 rounded flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => onInspectCandidate(cand)}
                            dangerouslySetInnerHTML={{ __html: thumb }}
                          />
                        ) : (
                          <span className="font-mono text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 max-w-[260px]">
                        <button
                          type="button"
                          onClick={() => onInspectCandidate(cand)}
                          className="font-medium text-sm text-slate-900 hover:text-sky-700 text-left block truncate max-w-full"
                        >
                          {cand.name}
                        </button>
                        <div className="text-slate-500 mt-0.5 truncate">
                          {cand.properties.formula} · {cand.targetName}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">
                        {cand.properties.molecularWeight.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">
                        {cand.properties.cLogP.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">
                        {cand.properties.tpsa.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 font-medium">
                        {cand.analysis.bioactivity.estimatedPic50.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4">
                        <RiskText risk={cand.analysis.toxicity.overallRisk} />
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="text-slate-900 font-medium">{cand.stage}</div>
                        <div className="text-slate-500">{cand.review.decision}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectCandidate(cand)}
                            className="px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 border border-sky-200 rounded transition-colors"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCandidate(cand.id)}
                            aria-label={`Remove ${cand.name}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
