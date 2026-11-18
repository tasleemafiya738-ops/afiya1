import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type {
  BiologicalTarget,
  CandidateStage,
  DrugCandidate,
  ReviewRecord,
  ScreeningCampaign,
} from './src/types/discovery.ts';
import { computeMolecularProperties } from './server/chemistryEngine.ts';
import { analyzeMoleculeWithGemini } from './server/geminiService.ts';
import {
  addOrUpdateCandidate,
  createCampaign,
  deleteCandidateById,
  loadStore,
  updateCandidateReview,
} from './server/store.ts';

dotenv.config();

const PORT = 3000;

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/workspace', (_req, res) => {
    const store = loadStore();
    res.json(store);
  });

  app.post('/api/campaigns', (req, res) => {
    const { name, therapeuticArea, targetId, leadScientist, objective } = req.body as {
      name?: string;
      therapeuticArea?: string;
      targetId?: string;
      leadScientist?: string;
      objective?: string;
    };

    if (!name?.trim() || !targetId?.trim()) {
      res.status(400).json({ error: 'Campaign name and biological target are required.' });
      return;
    }

    const store = loadStore();
    const target = store.targets.find((t) => t.id === targetId);
    if (!target) {
      res.status(404).json({ error: 'Selected biological target not found.' });
      return;
    }

    const campaign: ScreeningCampaign = {
      id: `cmp-${Date.now()}`,
      name: name.trim(),
      therapeuticArea: therapeuticArea?.trim() || target.therapeuticArea,
      targetId: target.id,
      targetName: target.name,
      leadScientist: leadScientist?.trim() || 'Discovery Team',
      objective: objective?.trim() || `Hit-to-lead molecular screening against ${target.name}.`,
      createdAt: new Date().toISOString(),
    };

    createCampaign(campaign);
    res.status(201).json(campaign);
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const {
        name,
        smiles,
        targetId,
        customTargetName,
        campaignId,
        saveToCampaign = true,
      } = req.body as {
        name?: string;
        smiles?: string;
        targetId?: string;
        customTargetName?: string;
        campaignId?: string;
        saveToCampaign?: boolean;
      };

      if (!smiles?.trim()) {
        res.status(400).json({ error: 'A valid SMILES notation string is required.' });
        return;
      }

      let properties;
      try {
        properties = computeMolecularProperties(smiles);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid SMILES structure.';
        res.status(400).json({ error: `SMILES parsing failed: ${message}` });
        return;
      }

      const store = loadStore();
      let target: BiologicalTarget | undefined = store.targets.find((t) => t.id === targetId);
      if (!target && customTargetName?.trim()) {
        target = {
          id: 'tgt-custom',
          name: customTargetName.trim(),
          geneSymbol: 'Custom Target',
          pdbId: 'User-Specified',
          proteinClass: 'Therapeutic Target',
          therapeuticArea: 'Exploratory Discovery',
          bindingSiteProfile: 'User-defined receptor or enzymatic binding site.',
          assayProtocol: 'Exploratory in-silico prediction',
        };
      }
      if (!target) {
        target = store.targets[0];
      }

      const compoundName =
        name?.trim() || `MV-${Math.floor(100 + Math.random() * 899)} (${properties.formula})`;

      const analysis = await analyzeMoleculeWithGemini({
        compoundName,
        smiles: properties.canonicalSmiles,
        properties,
        target,
      });

      const resolvedCampaignId = campaignId || store.campaigns[0]?.id || 'cmp-oncology-kinase';
      const stage: CandidateStage =
        analysis.toxicity.overallRisk === 'High'
          ? 'Deprioritized'
          : analysis.bioactivity.activityClass === 'Potent' && properties.lipinskiPassed
            ? 'Lead Optimization'
            : 'Hit';

      const candidate: DrugCandidate = {
        id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: compoundName,
        smiles: properties.canonicalSmiles,
        campaignId: resolvedCampaignId,
        targetId: target.id,
        targetName: target.name,
        stage,
        createdAt: new Date().toISOString(),
        properties,
        analysis,
        review: {
          decision: 'Pending Review',
          reviewerRole: 'Computational Chemist',
          reviewerName: 'Automated Screening Queue',
          notes: 'Screened via SMILES AI pipeline; awaiting multidisciplinary review.',
          updatedAt: new Date().toISOString(),
        },
      };

      if (saveToCampaign) {
        addOrUpdateCandidate(candidate);
      }

      res.json({ candidate });
    } catch (error) {
      console.error('Error in /api/analyze:', error);
      const message =
        error instanceof Error ? error.message : 'Unexpected server error during analysis.';
      const status =
        message.includes('GEMINI_API_KEY') || message.includes('API_KEY_INVALID')
          ? 503
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/batch-screen', async (req, res) => {
    try {
      const { entries, targetId, campaignId } = req.body as {
        entries?: Array<{ name: string; smiles: string }>;
        targetId?: string;
        campaignId?: string;
      };

      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'Provide at least one SMILES entry for batch screening.' });
        return;
      }
      if (entries.length > 8) {
        res.status(400).json({ error: 'Batch screening supports up to 8 molecules per run.' });
        return;
      }

      const store = loadStore();
      const target = store.targets.find((t) => t.id === targetId) ?? store.targets[0];
      const resolvedCampaignId = campaignId || store.campaigns[0]?.id || 'cmp-oncology-kinase';

      const results: Array<{
        name: string;
        smiles: string;
        status: 'success' | 'error';
        candidate?: DrugCandidate;
        error?: string;
      }> = [];

      for (const entry of entries) {
        try {
          const properties = computeMolecularProperties(entry.smiles);
          const compoundName = entry.name.trim() || `Batch-${properties.formula}`;
          const analysis = await analyzeMoleculeWithGemini({
            compoundName,
            smiles: properties.canonicalSmiles,
            properties,
            target,
          });

          const stage: CandidateStage =
            analysis.toxicity.overallRisk === 'High'
              ? 'Deprioritized'
              : analysis.bioactivity.activityClass === 'Potent' && properties.lipinskiPassed
                ? 'Lead Optimization'
                : 'Hit';

          const candidate: DrugCandidate = {
            id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: compoundName,
            smiles: properties.canonicalSmiles,
            campaignId: resolvedCampaignId,
            targetId: target.id,
            targetName: target.name,
            stage,
            createdAt: new Date().toISOString(),
            properties,
            analysis,
            review: {
              decision: 'Pending Review',
              reviewerRole: 'Computational Chemist',
              reviewerName: 'Batch Screening Queue',
              notes: 'Batch screened and queued for candidate review.',
              updatedAt: new Date().toISOString(),
            },
          };

          addOrUpdateCandidate(candidate);
          results.push({ name: compoundName, smiles: entry.smiles, status: 'success', candidate });
        } catch (err) {
          results.push({
            name: entry.name || entry.smiles,
            smiles: entry.smiles,
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to screen compound.',
          });
        }
      }

      res.json({ results });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch screening failed.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/candidates/:id/review', (req, res) => {
    const { id } = req.params;
    const { decision, reviewerRole, reviewerName, notes, stage } = req.body as Partial<ReviewRecord> & {
      stage?: CandidateStage;
    };

    if (!decision || !reviewerRole) {
      res.status(400).json({ error: 'Review decision and reviewer role are required.' });
      return;
    }

    const updated = updateCandidateReview(
      id,
      {
        decision,
        reviewerRole,
        reviewerName: reviewerName?.trim() || 'Lead Reviewer',
        notes: notes?.trim() || '',
        updatedAt: new Date().toISOString(),
      },
      stage
    );

    if (!updated) {
      res.status(404).json({ error: 'Drug candidate not found.' });
      return;
    }

    res.json({ candidate: updated });
  });

  app.delete('/api/candidates/:id', (req, res) => {
    const deleted = deleteCandidateById(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Drug candidate not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MolVantage server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
