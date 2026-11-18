import { GoogleGenAI, Type } from '@google/genai';
import type {
  BiologicalTarget,
  PhysicochemicalProperties,
  ScreeningAnalysis,
} from '../src/types/discovery.ts';
import { validateOptimizationSmiles } from './chemistryEngine.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add a valid Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient =
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT');
      if (!isTransient || attempt === maxAttempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

const SCREENING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    bioactivity: {
      type: Type.OBJECT,
      properties: {
        targetName: { type: Type.STRING },
        predictedIc50Range: {
          type: Type.STRING,
          description: 'Realistic predicted IC50 or Ki range with units, e.g., 12 - 45 nM or >10 uM',
        },
        estimatedPic50: {
          type: Type.NUMBER,
          description: 'Estimated pIC50 numeric score between 3.5 and 9.8',
        },
        activityClass: {
          type: Type.STRING,
          enum: ['Potent', 'Moderate', 'Weak', 'Inactive'],
        },
        confidencePercent: {
          type: Type.NUMBER,
          description: 'Model confidence percentage between 45 and 96',
        },
        mechanismHypothesis: { type: Type.STRING },
        bindingInteractions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '3 to 5 specific residue or pharmacophore interaction hypotheses',
        },
        selectivityNotes: { type: Type.STRING },
      },
      required: [
        'targetName',
        'predictedIc50Range',
        'estimatedPic50',
        'activityClass',
        'confidencePercent',
        'mechanismHypothesis',
        'bindingInteractions',
        'selectivityNotes',
      ],
    },
    toxicity: {
      type: Type.OBJECT,
      properties: {
        overallRisk: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
        hergRisk: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
        hepatotoxicityRisk: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
        amesMutagenicityRisk: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
        cyp3a4Inhibition: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
        bbbPenetration: { type: Type.STRING, enum: ['High', 'Moderate', 'Low'] },
        giAbsorption: { type: Type.STRING, enum: ['High', 'Low'] },
        metabolicStability: { type: Type.STRING },
        safetyAlerts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        toxicologySummary: { type: Type.STRING },
      },
      required: [
        'overallRisk',
        'hergRisk',
        'hepatotoxicityRisk',
        'amesMutagenicityRisk',
        'cyp3a4Inhibition',
        'bbbPenetration',
        'giAbsorption',
        'metabolicStability',
        'safetyAlerts',
        'toxicologySummary',
      ],
    },
    optimizations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          rationale: { type: Type.STRING },
          modifiedSmiles: {
            type: Type.STRING,
            description: 'Valid canonical SMILES string representing a small medicinal chemistry analog modification',
          },
          expectedImpact: { type: Type.STRING },
        },
        required: ['title', 'rationale', 'modifiedSmiles', 'expectedImpact'],
      },
    },
    executiveSummary: { type: Type.STRING },
  },
  required: ['bioactivity', 'toxicity', 'optimizations', 'executiveSummary'],
};

export async function analyzeMoleculeWithGemini(params: {
  compoundName: string;
  smiles: string;
  properties: PhysicochemicalProperties;
  target: BiologicalTarget;
}): Promise<ScreeningAnalysis> {
  const ai = getAiClient();

  const prompt = `Evaluate this small molecule candidate for pharmaceutical discovery screening.

Compound Name: ${params.compoundName}
Canonical SMILES: ${params.properties.canonicalSmiles}

Deterministic Physicochemical Descriptors (computed by OpenChemLib):
- Molecular Formula: ${params.properties.formula}
- Molecular Weight: ${params.properties.molecularWeight} g/mol
- Exact Mass: ${params.properties.exactMass} Da
- cLogP: ${params.properties.cLogP}
- cLogS (aqueous solubility): ${params.properties.cLogS}
- TPSA: ${params.properties.tpsa} A^2
- H-Bond Donors: ${params.properties.hbd}
- H-Bond Acceptors: ${params.properties.hba}
- Rotatable Bonds: ${params.properties.rotatableBonds}
- Ring Count: ${params.properties.ringCount}
- Stereocenters: ${params.properties.stereoCenterCount}
- Lipinski Violations: ${params.properties.lipinskiViolations} (${params.properties.lipinskiPassed ? 'Passes' : 'Fails'})
- Veber Oral Rule: ${params.properties.veberPassed ? 'Passes' : 'Fails'}

Target Biological Protein:
- Name: ${params.target.name} (${params.target.geneSymbol})
- PDB Structure: ${params.target.pdbId}
- Protein Class: ${params.target.proteinClass}
- Therapeutic Area: ${params.target.therapeuticArea}
- Binding Site Profile: ${params.target.bindingSiteProfile}

Provide:
1. Bioactivity prediction against ${params.target.name}: realistic IC50/Ki range, estimated pIC50, activity class, confidence, mechanism hypothesis, 3-5 pharmacophore/binding pocket interactions, and selectivity notes.
2. ADMET and toxicity assessment: hERG cardiotoxicity, DILI/hepatotoxicity, AMES mutagenicity, CYP3A4 inhibition, BBB penetration, GI absorption, metabolic soft spots, structural safety alerts (or 'No PAINS/reactive alerts detected'), and toxicology summary.
3. Exactly 3 concrete medicinal chemistry structural optimization analogs with syntactically valid SMILES strings derived from the input scaffold to improve potency, solubility, or safety margin.
4. A concise 2-sentence executive screening summary.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a principal computational medicinal chemist and toxicologist on a pharmaceutical drug discovery platform. Base all quantitative reasoning strictly on the verified OpenChemLib physicochemical descriptors and chemical scaffold provided. Keep prose concise, technical, and empirical. Never output markdown fences inside JSON string fields. Ensure every modifiedSmiles in optimizations is a chemically valid SMILES string.',
        responseMimeType: 'application/json',
        responseSchema: SCREENING_SCHEMA,
      },
    })
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty screening response.');
  }

  const parsed = JSON.parse(rawText) as ScreeningAnalysis;

  // Validate and enrich every AI-suggested optimization SMILES with real OpenChemLib metrics
  parsed.optimizations = (parsed.optimizations ?? []).map((opt) => {
    const check = validateOptimizationSmiles(opt.modifiedSmiles);
    return {
      ...opt,
      modifiedSmiles: check.canonicalSmiles ?? opt.modifiedSmiles,
      validStructure: check.valid,
      formula: check.formula,
      molecularWeight: check.molecularWeight,
      cLogP: check.cLogP,
      tpsa: check.tpsa,
    };
  });

  return parsed;
}
