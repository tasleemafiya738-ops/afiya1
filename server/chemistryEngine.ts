import { Molecule, MoleculeProperties } from 'openchemlib';
import type { PhysicochemicalProperties } from '../src/types/discovery.ts';

function gaussianDesirability(value: number, mean: number, sigma: number): number {
  const z = (value - mean) / sigma;
  return Math.exp(-0.5 * z * z);
}

function computeQedEstimate(props: {
  molecularWeight: number;
  cLogP: number;
  tpsa: number;
  hbd: number;
  hba: number;
  rotatableBonds: number;
  ringCount: number;
}): number {
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

export function computeMolecularProperties(smiles: string): PhysicochemicalProperties {
  const trimmed = smiles.trim();
  if (!trimmed) {
    throw new Error('SMILES string is required.');
  }

  const mol = Molecule.fromSmiles(trimmed);
  const heavyAtomCount = mol.getAtoms();
  if (heavyAtomCount === 0) {
    throw new Error('Parsed SMILES contains no valid atoms.');
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

  return {
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
  };
}

export function validateOptimizationSmiles(smiles: string): {
  valid: boolean;
  canonicalSmiles?: string;
  formula?: string;
  molecularWeight?: number;
  cLogP?: number;
  tpsa?: number;
} {
  try {
    const props = computeMolecularProperties(smiles);
    return {
      valid: true,
      canonicalSmiles: props.canonicalSmiles,
      formula: props.formula,
      molecularWeight: props.molecularWeight,
      cLogP: props.cLogP,
      tpsa: props.tpsa,
    };
  } catch {
    return { valid: false };
  }
}
