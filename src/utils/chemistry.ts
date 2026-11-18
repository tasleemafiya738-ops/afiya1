import { Molecule, MoleculeProperties } from 'openchemlib';
import type { PhysicochemicalProperties } from '../types/discovery';

export interface ReferenceCompound {
  name: string;
  smiles: string;
  classLabel: string;
  suggestedTargetId: string;
}

export const REFERENCE_COMPOUNDS: ReferenceCompound[] = [
  {
    name: 'Gefitinib',
    smiles: 'COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1',
    classLabel: 'EGFR Kinase Inhibitor',
    suggestedTargetId: 'tgt-egfr',
  },
  {
    name: 'Imatinib',
    smiles: 'Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1',
    classLabel: 'ABL1 Tyrosine Kinase Inhibitor',
    suggestedTargetId: 'tgt-abl1',
  },
  {
    name: 'Nirmatrelvir',
    smiles: 'CC1(C)C2C1C(N(C2)C(=O)C(C(C)(C)C)NC(=O)C(F)(F)F)C(=O)NC(CC1CCNC1=O)C#N',
    classLabel: 'SARS-CoV-2 Mpro Inhibitor',
    suggestedTargetId: 'tgt-mpro',
  },
  {
    name: 'Sotorasib',
    smiles: 'C=CC(=O)N1CCN(c2nc(=O)n(-c3c(C)ccnc3C(C)C)c3nc(-c4c(O)cccc4F)cc(C)c23)C(C)C1',
    classLabel: 'KRAS G12C Covalent Inhibitor',
    suggestedTargetId: 'tgt-kras',
  },
  {
    name: 'Aspirin',
    smiles: 'CC(=O)Oc1ccccc1C(=O)O',
    classLabel: 'COX-1/COX-2 Inhibitor',
    suggestedTargetId: 'tgt-cox2',
  },
  {
    name: 'Atorvastatin',
    smiles: 'CC(C)c1c(C(=O)Nc2ccccc2)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CCC(O)CC(O)CC(=O)O',
    classLabel: 'HMG-CoA Reductase Inhibitor',
    suggestedTargetId: 'tgt-hmgcr',
  },
];

function gaussianDesirability(value: number, mean: number, sigma: number): number {
  const z = (value - mean) / sigma;
  return Math.exp(-0.5 * z * z);
}

export function computeQedEstimate(props: {
  molecularWeight: number;
  cLogP: number;
  tpsa: number;
  hbd: number;
  hba: number;
  rotatableBonds: number;
  ringCount: number;
}): number {
  // Desirability-weighted approximation aligned with Bickerton et al. QED envelope
  const dMw = gaussianDesirability(props.molecularWeight, 330, 110);
  const dLogP = gaussianDesirability(props.cLogP, 2.5, 1.4);
  const dTpsa = gaussianDesirability(props.tpsa, 68, 34);
  const dHbd = gaussianDesirability(props.hbd, 1.4, 1.6);
  const dHba = gaussianDesirability(props.hba, 4.5, 2.4);
  const dRot = gaussianDesirability(props.rotatableBonds, 4.0, 3.0);
  const dRings = gaussianDesirability(props.ringCount, 3.0, 1.5);

  const weights = [0.22, 0.22, 0.14, 0.12, 0.10, 0.10, 0.10];
  const scores = [dMw, dLogP, dTpsa, dHbd, dHba, dRot, dRings];
  let logSum = 0;
  for (let i = 0; i < scores.length; i++) {
    logSum += weights[i] * Math.log(Math.max(scores[i], 0.01));
  }
  return Number(Math.min(0.96, Math.max(0.05, Math.exp(logSum))).toFixed(2));
}

export interface SmilesParseResult {
  valid: boolean;
  error?: string;
  properties?: PhysicochemicalProperties;
  svg?: string;
}

export function parseAndAnalyzeSmiles(
  smiles: string,
  svgWidth = 520,
  svgHeight = 320
): SmilesParseResult {
  const trimmed = smiles.trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter a SMILES string to parse molecular geometry.' };
  }

  try {
    const mol = Molecule.fromSmiles(trimmed);
    const heavyAtomCount = mol.getAtoms();
    if (heavyAtomCount === 0) {
      return { valid: false, error: 'No valid chemical atoms found in SMILES input.' };
    }

    const mf = mol.getMolecularFormula();
    const props = new MoleculeProperties(mol);
    const ringCount = mol.getRingSet().getSize();

    const molecularWeight = Number(mf.relativeWeight.toFixed(2));
    const exactMass = Number(mf.absoluteWeight.toFixed(4));
    const cLogP = Number((props.logP ?? 0).toFixed(2));
    const cLogS = Number((props.logS ?? 0).toFixed(2));
    const tpsa = Number((props.polarSurfaceArea ?? 0).toFixed(1));
    const hbd = props.donorCount ?? 0;
    const hba = props.acceptorCount ?? 0;
    const rotatableBonds = props.rotatableBondCount ?? 0;
    const stereoCenterCount = props.stereoCenterCount ?? 0;

    let lipinskiViolations = 0;
    if (molecularWeight > 500) lipinskiViolations++;
    if (cLogP > 5) lipinskiViolations++;
    if (hbd > 5) lipinskiViolations++;
    if (hba > 10) lipinskiViolations++;

    const lipinskiPassed = lipinskiViolations <= 1;
    const veberPassed = tpsa <= 140 && rotatableBonds <= 10;
    const bbbPermeableWindow = tpsa < 90 && molecularWeight < 450 && cLogP >= 0.5 && cLogP <= 4.5;

    const qedEstimate = computeQedEstimate({
      molecularWeight,
      cLogP,
      tpsa,
      hbd,
      hba,
      rotatableBonds,
      ringCount,
    });

    const svgId = `mol_${Math.random().toString(36).slice(2, 9)}`;
    const svg = mol.toSVG(svgWidth, svgHeight, svgId, {
      suppressChiralText: true,
      suppressESR: true,
      suppressCIPParity: true,
      factorTextSize: 1.05,
      autoCrop: true,
      autoCropMargin: 18,
    });

    return {
      valid: true,
      svg,
      properties: {
        canonicalSmiles: mol.toSmiles(),
        formula: mf.formula,
        molecularWeight,
        exactMass,
        cLogP,
        cLogS,
        tpsa,
        hbd,
        hba,
        rotatableBonds,
        heavyAtomCount,
        bondCount: mol.getAllBonds(),
        ringCount,
        stereoCenterCount,
        lipinskiViolations,
        lipinskiPassed,
        veberPassed,
        bbbPermeableWindow,
        qedEstimate,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid SMILES syntax.';
    return {
      valid: false,
      error: `SMILES syntax error: ${message}`,
    };
  }
}

export function renderSmilesSvg(smiles: string, width = 220, height = 140): string | null {
  try {
    const mol = Molecule.fromSmiles(smiles.trim());
    if (mol.getAtoms() === 0) return null;
    const svgId = `thumb_${Math.random().toString(36).slice(2, 9)}`;
    return mol.toSVG(width, height, svgId, {
      suppressChiralText: true,
      suppressESR: true,
      suppressCIPParity: true,
      autoCrop: true,
      autoCropMargin: 12,
    });
  } catch {
    return null;
  }
}
