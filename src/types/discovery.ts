export type PersonaRole =
  | 'Medicinal Chemist'
  | 'Computational Chemist'
  | 'Pharmacologist'
  | 'Toxicologist';

export type CandidateStage =
  | 'Hit'
  | 'Lead Optimization'
  | 'Preclinical Candidate'
  | 'Deprioritized';

export type ReviewDecisionStatus =
  | 'Pending Review'
  | 'Advance to Hit-to-Lead'
  | 'Request Wet-Lab Assay'
  | 'Structural Revision Needed'
  | 'Rejected — Toxicity Flag';

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export interface PhysicochemicalProperties {
  canonicalSmiles: string;
  formula: string;
  molecularWeight: number;
  exactMass: number;
  cLogP: number;
  cLogS: number;
  tpsa: number;
  hbd: number;
  hba: number;
  rotatableBonds: number;
  heavyAtomCount: number;
  bondCount: number;
  ringCount: number;
  stereoCenterCount: number;
  lipinskiViolations: number;
  lipinskiPassed: boolean;
  veberPassed: boolean;
  bbbPermeableWindow: boolean;
  qedEstimate: number;
}

export interface BioactivityPrediction {
  targetName: string;
  predictedIc50Range: string;
  estimatedPic50: number;
  activityClass: 'Potent' | 'Moderate' | 'Weak' | 'Inactive';
  confidencePercent: number;
  mechanismHypothesis: string;
  bindingInteractions: string[];
  selectivityNotes: string;
}

export interface ToxicityAssessment {
  overallRisk: RiskLevel;
  hergRisk: RiskLevel;
  hepatotoxicityRisk: RiskLevel;
  amesMutagenicityRisk: RiskLevel;
  cyp3a4Inhibition: 'Low' | 'Moderate' | 'High';
  bbbPenetration: 'High' | 'Moderate' | 'Low';
  giAbsorption: 'High' | 'Low';
  metabolicStability: string;
  safetyAlerts: string[];
  toxicologySummary: string;
}

export interface StructuralOptimization {
  title: string;
  rationale: string;
  modifiedSmiles: string;
  expectedImpact: string;
  validStructure?: boolean;
  formula?: string;
  molecularWeight?: number;
  cLogP?: number;
  tpsa?: number;
}

export interface ScreeningAnalysis {
  bioactivity: BioactivityPrediction;
  toxicity: ToxicityAssessment;
  optimizations: StructuralOptimization[];
  executiveSummary: string;
}

export interface ReviewRecord {
  decision: ReviewDecisionStatus;
  reviewerRole: PersonaRole;
  reviewerName: string;
  notes: string;
  updatedAt: string;
}

export interface DrugCandidate {
  id: string;
  name: string;
  smiles: string;
  campaignId: string;
  targetId: string;
  targetName: string;
  stage: CandidateStage;
  createdAt: string;
  properties: PhysicochemicalProperties;
  analysis: ScreeningAnalysis;
  review: ReviewRecord;
}

export interface ScreeningCampaign {
  id: string;
  name: string;
  therapeuticArea: string;
  targetId: string;
  targetName: string;
  leadScientist: string;
  objective: string;
  createdAt: string;
}

export interface BiologicalTarget {
  id: string;
  name: string;
  geneSymbol: string;
  pdbId: string;
  proteinClass: string;
  therapeuticArea: string;
  bindingSiteProfile: string;
  assayProtocol: string;
}

export interface AssayRecord {
  id: string;
  name: string;
  targetId: string;
  assayType: 'Biochemical' | 'Cellular' | 'ADMET' | 'Safety Pharmacology';
  readoutMetric: string;
  throughput: string;
  acceptanceCriteria: string;
}

export interface WorkspaceSnapshot {
  campaigns: ScreeningCampaign[];
  targets: BiologicalTarget[];
  assays: AssayRecord[];
  candidates: DrugCandidate[];
}
