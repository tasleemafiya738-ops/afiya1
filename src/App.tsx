/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { BatchScreenModal } from './components/BatchScreenModal';
import { CampaignsView } from './components/CampaignsView';
import { CandidateReviewView } from './components/CandidateReviewView';
import { TargetsAssaysView } from './components/TargetsAssaysView';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { WorkbenchView } from './components/WorkbenchView';
import type {
  DrugCandidate,
  ScreeningCampaign,
  WorkspaceSnapshot,
} from './types/discovery';

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('workbench');
  const [activeCandidate, setActiveCandidate] = useState<DrugCandidate | null>(null);
  const [reviewCandidateId, setReviewCandidateId] = useState<string | undefined>(undefined);
  const [preferredTargetId, setPreferredTargetId] = useState<string | undefined>(undefined);
  const [batchModalOpen, setBatchModalOpen] = useState<boolean>(false);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/workspace');
      if (!res.ok) {
        throw new Error(`Workspace request failed (${res.status}).`);
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      setWorkspace(data);
      setActiveCandidate((prev) => prev ?? data.candidates[0] ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load discovery workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleCandidateAnalyzed = (candidate: DrugCandidate) => {
    setActiveCandidate(candidate);
    setWorkspace((prev) => {
      if (!prev) return prev;
      const exists = prev.candidates.some((c) => c.id === candidate.id);
      return {
        ...prev,
        candidates: exists
          ? prev.candidates.map((c) => (c.id === candidate.id ? candidate : c))
          : [candidate, ...prev.candidates],
      };
    });
  };

  const handleBatchComplete = (newCandidates: DrugCandidate[]) => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        candidates: [...newCandidates, ...prev.candidates],
      };
    });
    if (newCandidates[0]) {
      setActiveCandidate(newCandidates[0]);
    }
  };

  const handleCreateCampaign = (campaign: ScreeningCampaign) => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        campaigns: [campaign, ...prev.campaigns],
      };
    });
  };

  const handleDeleteCandidate = async (id: string) => {
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setWorkspace((prev) => {
        if (!prev) return prev;
        const remaining = prev.candidates.filter((c) => c.id !== id);
        if (activeCandidate?.id === id) {
          setActiveCandidate(remaining[0] ?? null);
        }
        return { ...prev, candidates: remaining };
      });
    } catch {
      // Ignore transient delete errors
    }
  };

  const handleReviewSaved = (updated: DrugCandidate) => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        candidates: prev.candidates.map((c) => (c.id === updated.id ? updated : c)),
      };
    });
    if (activeCandidate?.id === updated.id) {
      setActiveCandidate(updated);
    }
  };

  const handleInspectCandidate = (candidate: DrugCandidate) => {
    setActiveCandidate(candidate);
    setPreferredTargetId(candidate.targetId);
    setActiveTab('workbench');
  };

  const handleOpenReview = (candidate: DrugCandidate) => {
    setReviewCandidateId(candidate.id);
    setActiveTab('review');
  };

  const handleScreenTarget = (targetId: string) => {
    setPreferredTargetId(targetId);
    setActiveTab('workbench');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBatchModal={() => setBatchModalOpen(true)}
      />

      <div className="flex-1">
        {loading ? (
          <div className="max-w-[1440px] mx-auto px-6 py-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-[350px] h-[460px] bg-white border border-slate-200 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-6">
                <div className="h-[360px] bg-white border border-slate-200 rounded-lg animate-pulse" />
                <div className="h-[240px] bg-white border border-slate-200 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        ) : loadError || !workspace ? (
          <div className="max-w-lg mx-auto px-6 py-16 text-center">
            <div className="bg-white border border-rose-200 rounded-lg p-6">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Unable to Load Discovery Workspace
              </h2>
              <p className="text-xs text-slate-600 mt-1.5">
                {loadError || 'Unexpected workspace initialization error.'}
              </p>
              <button
                type="button"
                onClick={fetchWorkspace}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-md"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'workbench' && (
              <WorkbenchView
                targets={workspace.targets}
                campaigns={workspace.campaigns}
                activeCandidate={activeCandidate}
                onCandidateAnalyzed={handleCandidateAnalyzed}
                onOpenReview={handleOpenReview}
                initialTargetId={preferredTargetId}
              />
            )}

            {activeTab === 'campaigns' && (
              <CampaignsView
                campaigns={workspace.campaigns}
                targets={workspace.targets}
                candidates={workspace.candidates}
                onInspectCandidate={handleInspectCandidate}
                onCreateCampaign={handleCreateCampaign}
                onDeleteCandidate={handleDeleteCandidate}
                onOpenBatchModal={() => setBatchModalOpen(true)}
              />
            )}

            {activeTab === 'targets' && (
              <TargetsAssaysView
                targets={workspace.targets}
                assays={workspace.assays}
                candidates={workspace.candidates}
                onScreenTarget={handleScreenTarget}
              />
            )}

            {activeTab === 'review' && (
              <CandidateReviewView
                candidates={workspace.candidates}
                initialCandidateId={reviewCandidateId}
                onReviewSaved={handleReviewSaved}
                onInspectInWorkbench={handleInspectCandidate}
              />
            )}

            <BatchScreenModal
              isOpen={batchModalOpen}
              onClose={() => setBatchModalOpen(false)}
              targets={workspace.targets}
              campaigns={workspace.campaigns}
              onBatchComplete={handleBatchComplete}
            />
          </>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>MolVantage · Computational Molecular Screening &amp; Drug Discovery</span>
          <span>For research and candidate prioritization only — validate hits with wet-lab assays.</span>
        </div>
      </footer>
    </div>
  );
}
