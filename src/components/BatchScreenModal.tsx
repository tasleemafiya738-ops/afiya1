import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { BiologicalTarget, DrugCandidate, ScreeningCampaign } from '../types/discovery';

interface BatchScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: BiologicalTarget[];
  campaigns: ScreeningCampaign[];
  onBatchComplete: (newCandidates: DrugCandidate[]) => void;
}

const SAMPLE_BATCH = `Osimertinib | COc1cc(N(C)CCN(C)C)c(NC(=O)C=C)cc1Nc1nccc(-c2cn(C)c3ccccc23)n1
Lapatinib | CS(=O)(=O)CCNCCc1ccc(-c2ccc3ncnc(Nc4ccc(OCc5cccc(F)c5)c(Cl)c4)c3c2)o1
Afatinib | CN(C)CC=CC(=O)Nc1cc2c(Nc3ccc(F)c(Cl)c3)ncnc2cc1OC1CCOC1`;

export const BatchScreenModal: React.FC<BatchScreenModalProps> = ({
  isOpen,
  onClose,
  targets,
  campaigns,
  onBatchComplete,
}) => {
  const [rawInput, setRawInput] = useState<string>(SAMPLE_BATCH);
  const [targetId, setTargetId] = useState<string>(targets[0]?.id ?? 'tgt-egfr');
  const [campaignId, setCampaignId] = useState<string>(campaigns[0]?.id ?? '');
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<
    Array<{ name: string; status: 'success' | 'error'; error?: string }> | null
  >(null);

  if (!isOpen) return null;

  const parseLines = (text: string) => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        if (line.includes('|')) {
          const [name, ...rest] = line.split('|');
          return { name: name.trim(), smiles: rest.join('|').trim() };
        }
        return { name: `Batch-CMP-${index + 1}`, smiles: line };
      });
  };

  const handleRunBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const entries = parseLines(rawInput);
    if (entries.length === 0) {
      setError('Enter at least one SMILES line.');
      return;
    }
    if (entries.length > 8) {
      setError('Maximum 8 molecules per batch screening request.');
      return;
    }

    setRunning(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch('/api/batch-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, targetId, campaignId }),
      });
      const data = (await res.json()) as {
        results?: Array<{
          name: string;
          status: 'success' | 'error';
          candidate?: DrugCandidate;
          error?: string;
        }>;
        error?: string;
      };

      if (!res.ok || !data.results) {
        throw new Error(data.error || 'Batch screening failed.');
      }

      const successful = data.results
        .filter((r): r is { name: string; status: 'success'; candidate: DrugCandidate } =>
          r.status === 'success' && Boolean(r.candidate)
        )
        .map((r) => r.candidate);

      setSummary(data.results.map((r) => ({ name: r.name, status: r.status, error: r.error })));

      if (successful.length > 0) {
        onBatchComplete(successful);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to execute batch screening.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="batch-modal-title" className="font-display text-base font-semibold text-slate-900">
              Batch SMILES Library Screening
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Screen up to 8 compounds simultaneously for target activity, ADMET, and drug-likeness.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRunBatch} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Protein
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
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
                Destination Campaign
              </label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Compound List (one per line: <code className="font-mono">Name | SMILES</code>)
              </label>
              <button
                type="button"
                onClick={() => setRawInput(SAMPLE_BATCH)}
                className="text-xs text-sky-700 hover:underline"
              >
                Load EGFR Sample Set
              </button>
            </div>
            <textarea
              rows={5}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              spellCheck={false}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
              {error}
            </div>
          )}

          {summary && (
            <div className="border border-slate-200 rounded-md divide-y divide-slate-100 text-xs max-h-36 overflow-y-auto">
              {summary.map((item, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  {item.status === 'success' ? (
                    <span className="text-emerald-700 font-medium">Screened &amp; Saved</span>
                  ) : (
                    <span className="text-rose-700">{item.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              {running ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Screening Batch...</span>
                </>
              ) : (
                <span>Execute Batch Screen</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
