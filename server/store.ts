import fs from 'fs';
import path from 'path';
import type {
  AssayRecord,
  BiologicalTarget,
  CandidateStage,
  DrugCandidate,
  ReviewRecord,
  ScreeningCampaign,
  WorkspaceSnapshot,
} from '../src/types/discovery.ts';
import { computeMolecularProperties } from './chemistryEngine.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'molvantage-store.json');

function createSeedData(): WorkspaceSnapshot {
  const targets: BiologicalTarget[] = [
    {
      id: 'tgt-egfr',
      name: 'Epidermal Growth Factor Receptor (EGFR L858R)',
      geneSymbol: 'EGFR',
      pdbId: '4I23',
      proteinClass: 'Receptor Tyrosine Kinase',
      therapeuticArea: 'Oncology (NSCLC)',
      bindingSiteProfile:
        'ATP-competitive hinge region (Met793 H-bond donor/acceptor), hydrophobic back pocket (Thr790 gatekeeper), solvent-exposed morpholine channel.',
      assayProtocol: 'HTRF KinEASE-TK biochemical phosphorylation assay at 10 uM ATP Km',
    },
    {
      id: 'tgt-abl1',
      name: 'BCR-ABL1 Tyrosine Kinase',
      geneSymbol: 'ABL1',
      pdbId: '2HYY',
      proteinClass: 'Non-Receptor Tyrosine Kinase',
      therapeuticArea: 'Hematologic Malignancy (CML)',
      bindingSiteProfile:
        'DFG-out inactive conformation pocket; hinge Met318 H-bond, Glu286/Asp381 amide linker pair, lipophilic trifluoromethyl-adjacent pocket.',
      assayProtocol: 'Caliper microfluidic mobility-shift kinase assay & Ba/F3 proliferation',
    },
    {
      id: 'tgt-mpro',
      name: 'SARS-CoV-2 Main Protease (3CLpro)',
      geneSymbol: 'ORF1ab (NSP5)',
      pdbId: '7SI9',
      proteinClass: 'Cysteine Protease',
      therapeuticArea: 'Antiviral / Infectious Disease',
      bindingSiteProfile:
        'Catalytic dyad (Cys145, His41), S1 Gln-mimetic lactam pocket (His163, Glu166), hydrophobic S2 cyclopropyl/bicycloproline subsite.',
      assayProtocol: 'FRET peptide substrate cleavage assay (Dabcyl-KTSAVLQSGFRKM-Edans)',
    },
    {
      id: 'tgt-kras',
      name: 'KRAS G12C Oncoprotein',
      geneSymbol: 'KRAS',
      pdbId: '6OIM',
      proteinClass: 'Small GTPase',
      therapeuticArea: 'Solid Tumor Oncology',
      bindingSiteProfile:
        'Switch-II cryptic allosteric pocket beneath GDP/GTP site; covalent warhead engagement with mutant Cys12 thiol.',
      assayProtocol: 'Intact protein mass-spec Cys12 occupancy + SOS1-mediated nucleotide exchange',
    },
    {
      id: 'tgt-cox2',
      name: 'Cyclooxygenase-2 (PTGS2)',
      geneSymbol: 'PTGS2',
      pdbId: '5KIR',
      proteinClass: 'Oxidoreductase',
      therapeuticArea: 'Inflammation & Pain',
      bindingSiteProfile:
        'Elongated hydrophobic arachidonate channel leading to catalytic Tyr385 / Ser530 and Arg120 carboxylate anchor.',
      assayProtocol: 'COX Fluorescent Activity Assay (arachidonic acid / ADHP)',
    },
    {
      id: 'tgt-hmgcr',
      name: 'HMG-CoA Reductase',
      geneSymbol: 'HMGCR',
      pdbId: '1HWK',
      proteinClass: 'Oxidoreductase',
      therapeuticArea: 'Cardiometabolic',
      bindingSiteProfile:
        'Shallow polar statin-binding groove recognizing 3,5-dihydroxyheptanoic acid pharmacophore via Arg590, Lys691, and Glu559.',
      assayProtocol: 'Spectrophotometric NADPH oxidation kinetics at 340 nm',
    },
  ];

  const campaigns: ScreeningCampaign[] = [
    {
      id: 'cmp-oncology-kinase',
      name: 'EGFR / Kinase Hinge Lead Series',
      therapeuticArea: 'Oncology',
      targetId: 'tgt-egfr',
      targetName: 'Epidermal Growth Factor Receptor (EGFR L858R)',
      leadScientist: 'Dr. Elena Rostova',
      objective:
        'Identify orally bioavailable 4-anilinoquinazoline and pyrimidine analogs with sub-50 nM EGFR potency and clean hERG margin (>30x).',
      createdAt: '2026-11-04T09:15:00Z',
    },
    {
      id: 'cmp-antiviral-protease',
      name: 'Broad-Spectrum Coronavirus Mpro Screen',
      therapeuticArea: 'Antiviral',
      targetId: 'tgt-mpro',
      targetName: 'SARS-CoV-2 Main Protease (3CLpro)',
      leadScientist: 'Dr. Marcus Vance',
      objective:
        'Screen reversible-covalent peptidomimetic scaffolds optimizing metabolic stability (HLM t1/2 > 60 min) and CYP3A4 avoidance.',
      createdAt: '2026-11-10T14:30:00Z',
    },
  ];

  const assays: AssayRecord[] = [
    {
      id: 'asy-egfr-biochem',
      name: 'EGFR WT vs. L858R Biochemical IC50 Panel',
      targetId: 'tgt-egfr',
      assayType: 'Biochemical',
      readoutMetric: 'IC50 (nM) / Selectivity Ratio',
      throughput: '384-well HTRF',
      acceptanceCriteria: 'L858R IC50 < 25 nM; WT/Mutant margin >= 5-fold',
    },
    {
      id: 'asy-herg-patch',
      name: 'hERG Potassium Channel Automated Patch Clamp',
      targetId: 'tgt-egfr',
      assayType: 'Safety Pharmacology',
      readoutMetric: 'IC50 (uM)',
      throughput: 'QPatch 48-well',
      acceptanceCriteria: 'hERG IC50 > 10 uM (safety window > 100x)',
    },
    {
      id: 'asy-mpro-fret',
      name: '3CLpro FRET Protease Inhibition & Reversibility',
      targetId: 'tgt-mpro',
      assayType: 'Biochemical',
      readoutMetric: 'Ki (nM) / k_inact',
      throughput: '1536-well Kinetic',
      acceptanceCriteria: 'Ki < 20 nM with < 10% host Cathepsin-L inhibition at 10 uM',
    },
    {
      id: 'asy-adme-hlm',
      name: 'Human Liver Microsome Intrinsic Clearance & CYP3A4',
      targetId: 'tgt-mpro',
      assayType: 'ADMET',
      readoutMetric: 'CL_int (uL/min/mg) & t1/2 (min)',
      throughput: '96-well LC-MS/MS',
      acceptanceCriteria: 't1/2 > 45 min; CYP3A4 IC50 > 10 uM',
    },
    {
      id: 'asy-kras-ms',
      name: 'KRAS G12C Covalent Engagement MS Assay',
      targetId: 'tgt-kras',
      assayType: 'Biochemical',
      readoutMetric: '% Adduct Formation @ 1 uM / 1h',
      throughput: 'RapidFire MS',
      acceptanceCriteria: '> 85% covalent occupancy at 1 uM with minimal GSH reactivity',
    },
  ];

  const gefitinibSmiles = 'COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1';
  const erlotinibSmiles = 'COCCOc1cc2ncnc(Nc3cccc(C#C)c3)c2cc1OCCOC';
  const imatinibSmiles = 'Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1';
  const nirmatrelvirSmiles =
    'CC1(C)C2C1C(N(C2)C(=O)C(C(C)(C)C)NC(=O)C(F)(F)F)C(=O)NC(CC1CCNC1=O)C#N';
  const sotorasibSmiles =
    'C=CC(=O)N1CCN(c2nc(=O)n(-c3c(C)ccnc3C(C)C)c3nc(-c4c(O)cccc4F)cc(C)c23)C(C)C1';

  const candidates: DrugCandidate[] = [
    {
      id: 'cand-gefitinib',
      name: 'Gefitinib (MV-101 Reference)',
      smiles: gefitinibSmiles,
      campaignId: 'cmp-oncology-kinase',
      targetId: 'tgt-egfr',
      targetName: 'Epidermal Growth Factor Receptor (EGFR L858R)',
      stage: 'Preclinical Candidate',
      createdAt: '2026-11-12T10:20:00Z',
      properties: computeMolecularProperties(gefitinibSmiles),
      analysis: {
        bioactivity: {
          targetName: 'Epidermal Growth Factor Receptor (EGFR L858R)',
          predictedIc50Range: '18 - 35 nM',
          estimatedPic50: 7.62,
          activityClass: 'Potent',
          confidencePercent: 93,
          mechanismHypothesis:
            'Reversible ATP-competitive kinase inhibition anchored by the quinazoline N1 nitrogen at the EGFR hinge region.',
          bindingInteractions: [
            'Quinazoline N1 accepts a hydrogen bond from hinge Met793 backbone NH',
            '3-Chloro-4-fluoroaniline ring occupies the hydrophobic back pocket near gatekeeper Thr790',
            'C6 propyl-morpholine tail extends into the solvent-accessible ribose/phosphate channel',
            'C7 methoxy group forms stabilizing van der Waals contacts along the hinge floor',
          ],
          selectivityNotes:
            'High selectivity for ErbB1/EGFR over off-target Ser/Thr kinases; moderate cross-reactivity with ErbB2 at micromolar concentrations.',
        },
        toxicity: {
          overallRisk: 'Moderate',
          hergRisk: 'Moderate',
          hepatotoxicityRisk: 'Moderate',
          amesMutagenicityRisk: 'Low',
          cyp3a4Inhibition: 'Moderate',
          bbbPenetration: 'Low',
          giAbsorption: 'High',
          metabolicStability:
            'Moderate clearance via CYP3A4/CYP2D6 O-demethylation and morpholine ring oxidation.',
          safetyAlerts: [
            'Basic tertiary amine on propyl-morpholine tail introduces moderate hERG channel affinity risk',
            'CYP3A4 substrate/inhibitor liability requires drug-drug interaction profiling',
          ],
          toxicologySummary:
            'Favorable oral absorption and non-mutagenic profile, with class-typical hERG and hepatic transaminase monitoring warranted.',
        },
        optimizations: [
          {
            title: 'Reduce Basicity of Solvent Morpholine Tail',
            rationale:
              'Replacing the morpholine oxygen or introducing an adjacent difluoro group attenuates pKa and lowers hERG channel affinity.',
            modifiedSmiles: 'COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCC1COCCO1',
            expectedImpact: 'Expected 3-fold reduction in hERG inhibition while preserving hinge potency.',
            validStructure: true,
            formula: computeMolecularProperties('COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCC1COCCO1').formula,
            molecularWeight: computeMolecularProperties('COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCC1COCCO1').molecularWeight,
            cLogP: computeMolecularProperties('COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCC1COCCO1').cLogP,
            tpsa: computeMolecularProperties('COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCC1COCCO1').tpsa,
          },
        ],
        executiveSummary:
          'MV-101 exhibits potent predicted EGFR L858R engagement (18-35 nM) with clean Lipinski/Veber oral compliance. Primary optimization focus should mitigate moderate hERG liability on the basic morpholine side chain.',
      },
      review: {
        decision: 'Advance to Hit-to-Lead',
        reviewerRole: 'Medicinal Chemist',
        reviewerName: 'Dr. Elena Rostova',
        notes: 'Confirmed benchmark potency and hinge pharmacophore; prioritized morpholine pKa-attenuated analogs.',
        updatedAt: '2026-11-12T16:40:00Z',
      },
    },
    {
      id: 'cand-erlotinib',
      name: 'MV-108 Quinazoline Analog',
      smiles: erlotinibSmiles,
      campaignId: 'cmp-oncology-kinase',
      targetId: 'tgt-egfr',
      targetName: 'Epidermal Growth Factor Receptor (EGFR L858R)',
      stage: 'Lead Optimization',
      createdAt: '2026-11-13T11:05:00Z',
      properties: computeMolecularProperties(erlotinibSmiles),
      analysis: {
        bioactivity: {
          targetName: 'Epidermal Growth Factor Receptor (EGFR L858R)',
          predictedIc50Range: '12 - 28 nM',
          estimatedPic50: 7.75,
          activityClass: 'Potent',
          confidencePercent: 90,
          mechanismHypothesis:
            'ATP-competitive 4-anilinoquinazoline binding with terminal meta-ethynyl group penetrating the gatekeeper pocket.',
          bindingInteractions: [
            'Quinazoline N1 forms key H-bond with Met793 hinge backbone',
            '3-Ethynylphenyl ring aligns tightly inside the Thr790 hydrophobic pocket',
            'Bis(2-methoxyethoxy) chains improve aqueous solvation along solvent front',
          ],
          selectivityNotes:
            'Tighter steric fit in EGFR ATP cleft relative to bulkier ErbB2 pocket.',
        },
        toxicity: {
          overallRisk: 'Low',
          hergRisk: 'Low',
          hepatotoxicityRisk: 'Moderate',
          amesMutagenicityRisk: 'Low',
          cyp3a4Inhibition: 'Moderate',
          bbbPenetration: 'Moderate',
          giAbsorption: 'High',
          metabolicStability:
            'Terminal alkyne oxidation and O-dealkylation of methoxyethoxy tails via CYP3A4/CYP1A2.',
          safetyAlerts: [
            'Terminal acetylene moiety can undergo CYP-mediated reactive metabolite formation',
          ],
          toxicologySummary:
            'Low hERG risk due to neutral methoxyethoxy chains; monitor glutathione trapping for alkyne bioactivation.',
        },
        optimizations: [
          {
            title: 'Terminal Alkyne Bioisostere (Cyano Substitution)',
            rationale:
              'Replacing the terminal ethynyl with a nitrile eliminates CYP-mediated ketene reactive metabolites while retaining linear geometry.',
            modifiedSmiles: 'COCCOc1cc2ncnc(Nc3cccc(C#N)c3)c2cc1OCCOC',
            expectedImpact: 'Eliminates reactive metabolite alert and lowers cLogP by ~0.5 units.',
            validStructure: true,
            formula: computeMolecularProperties('COCCOc1cc2ncnc(Nc3cccc(C#N)c3)c2cc1OCCOC').formula,
            molecularWeight: computeMolecularProperties('COCCOc1cc2ncnc(Nc3cccc(C#N)c3)c2cc1OCCOC').molecularWeight,
            cLogP: computeMolecularProperties('COCCOc1cc2ncnc(Nc3cccc(C#N)c3)c2cc1OCCOC').cLogP,
            tpsa: computeMolecularProperties('COCCOc1cc2ncnc(Nc3cccc(C#N)c3)c2cc1OCCOC').tpsa,
          },
        ],
        executiveSummary:
          'MV-108 achieves strong sub-30 nM EGFR prediction with reduced hERG risk compared to basic-amine series. Nitrile bioisostere is recommended to remove terminal alkyne metabolic alerts.',
      },
      review: {
        decision: 'Request Wet-Lab Assay',
        reviewerRole: 'Toxicologist',
        reviewerName: 'Dr. Henrik Lindqvist',
        notes: 'Schedule GSH adduct trapping and CYP3A4 time-dependent inhibition panel.',
        updatedAt: '2026-11-14T09:12:00Z',
      },
    },
    {
      id: 'cand-imatinib',
      name: 'MV-204 Phenylaminopyrimidine',
      smiles: imatinibSmiles,
      campaignId: 'cmp-oncology-kinase',
      targetId: 'tgt-abl1',
      targetName: 'BCR-ABL1 Tyrosine Kinase',
      stage: 'Hit',
      createdAt: '2026-11-14T15:50:00Z',
      properties: computeMolecularProperties(imatinibSmiles),
      analysis: {
        bioactivity: {
          targetName: 'BCR-ABL1 Tyrosine Kinase',
          predictedIc50Range: '35 - 90 nM',
          estimatedPic50: 7.22,
          activityClass: 'Potent',
          confidencePercent: 91,
          mechanismHypothesis:
            'Type-II DFG-out kinase inhibitor stabilizing the inactive activation-loop conformation of ABL1.',
          bindingInteractions: [
            'Pyridine-pyrimidine core anchors to hinge Met318 via H-bond',
            'Central amide linker bridges catalytic Glu286 and Asp381 backbone NH',
            'N-methylpiperazine tail engages Asp363 via electrostatic interaction',
          ],
          selectivityNotes:
            'Selectively targets ABL1, c-KIT, and PDGFR with minimal off-target activity against EGFR.',
        },
        toxicity: {
          overallRisk: 'Moderate',
          hergRisk: 'Moderate',
          hepatotoxicityRisk: 'Low',
          amesMutagenicityRisk: 'Low',
          cyp3a4Inhibition: 'Moderate',
          bbbPenetration: 'Low',
          giAbsorption: 'High',
          metabolicStability:
            'N-demethylation of piperazine ring forms active N-desmethyl metabolite via CYP3A4.',
          safetyAlerts: [
            'Piperazine tertiary amine + extended aromatic scaffold increases hERG blockade probability',
          ],
          toxicologySummary:
            'Well-tolerated non-mutagenic profile with moderate CYP3A4 and hERG considerations.',
        },
        optimizations: [
          {
            title: 'Fluorine Block on Central Phenyl Ring',
            rationale:
              'Introducing an ortho-fluorine on the benzamide ring reduces metabolic hydroxylation.',
            modifiedSmiles: 'Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2F)cc1Nc1nccc(-c2cccnc2)n1',
            expectedImpact: 'Improves human liver microsome half-life without disrupting DFG-out amide angle.',
            validStructure: true,
            formula: computeMolecularProperties('Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2F)cc1Nc1nccc(-c2cccnc2)n1').formula,
            molecularWeight: computeMolecularProperties('Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2F)cc1Nc1nccc(-c2cccnc2)n1').molecularWeight,
            cLogP: computeMolecularProperties('Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2F)cc1Nc1nccc(-c2cccnc2)n1').cLogP,
            tpsa: computeMolecularProperties('Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2F)cc1Nc1nccc(-c2cccnc2)n1').tpsa,
          },
        ],
        executiveSummary:
          'MV-204 demonstrates strong Type-II DFG-out affinity for BCR-ABL1 with favorable oral drug-likeness. Monitor hERG window and CYP3A4 N-demethylation rate.',
      },
      review: {
        decision: 'Pending Review',
        reviewerRole: 'Pharmacologist',
        reviewerName: 'Dr. Priya Nair',
        notes: 'Awaiting Caliper ABL1 WT/T315I panel readout.',
        updatedAt: '2026-11-15T08:00:00Z',
      },
    },
    {
      id: 'cand-nirmatrelvir',
      name: 'MV-301 Peptidomimetic Nitrile',
      smiles: nirmatrelvirSmiles,
      campaignId: 'cmp-antiviral-protease',
      targetId: 'tgt-mpro',
      targetName: 'SARS-CoV-2 Main Protease (3CLpro)',
      stage: 'Preclinical Candidate',
      createdAt: '2026-11-15T13:20:00Z',
      properties: computeMolecularProperties(nirmatrelvirSmiles),
      analysis: {
        bioactivity: {
          targetName: 'SARS-CoV-2 Main Protease (3CLpro)',
          predictedIc50Range: '3 - 12 nM',
          estimatedPic50: 8.2,
          activityClass: 'Potent',
          confidencePercent: 94,
          mechanismHypothesis:
            'Reversible covalent thioimidate adduct formation between the electrophilic nitrile warhead and catalytic Cys145.',
          bindingInteractions: [
            'Nitrile carbon undergoes nucleophilic attack by catalytic Cys145 thiolate',
            'Gamma-lactam P1 ring mimics endogenous Gln forming H-bonds with His163 and Glu166',
            'Bicyclic dimethylcyclopropylproline P2 core fills hydrophobic S2 subsite',
            'Trifluoroacetamide P3 cap anchors into S4 pocket while avoiding P-gp efflux',
          ],
          selectivityNotes:
            'High selectivity over mammalian serine and cysteine proteases (Cathepsin L/B > 1000x).',
        },
        toxicity: {
          overallRisk: 'Low',
          hergRisk: 'Low',
          hepatotoxicityRisk: 'Low',
          amesMutagenicityRisk: 'Low',
          cyp3a4Inhibition: 'Low',
          bbbPenetration: 'Low',
          giAbsorption: 'High',
          metabolicStability:
            'Susceptible to CYP3A4 oxidation on tert-butyl and bicyclic proline moieties; co-dosing or deuteration strategies applicable.',
          safetyAlerts: ['No PAINS alerts; reversible nitrile warhead avoids off-target covalent labeling'],
          toxicologySummary:
            'Exceptionally clean safety pharmacology profile across hERG, Ames, and cytotoxicity panels.',
        },
        optimizations: [
          {
            title: 'Ketoamide Warhead Exploration',
            rationale:
              'Evaluates alternative reversible covalent kinetics for prolonged target residence time.',
            modifiedSmiles: 'CC1(C)C2C1C(N(C2)C(=O)C(C(C)(C)C)NC(=O)C(F)(F)F)C(=O)NC(CC1CCNC1=O)C(=O)C(=O)NC',
            expectedImpact: 'Potentially slower off-rate at the cost of +1 HBD and higher TPSA.',
            validStructure: true,
            formula: computeMolecularProperties('CC1(C)C2C1C(N(C2)C(=O)C(C(C)(C)C)NC(=O)C(F)(F)F)C(=O)NC(CC1CCNC1=O)C(=O)C(=O)NC').formula,
            molecularWeight: computeMolecularProperties('CC1(C)C2C1C(N(C2)C(=O)C(C(C)(C)C)NC(=O)C(F)(F)F)C(=O)NC(CC1CCNC1=O)C(=O)C(=O)NC').molecularWeight,
            cLogP: computeMolecularProperties('CC1(C)C2C1C(N(C2)C(=O)C(C(C)(C)C)NC(=O)C(F)(F)F)C(=O)NC(CC1CCNC1=O)C(=O)C(=O)NC').cLogP,
            tpsa: computeMolecularProperties('CC1(C)C2C1C(N(C2)C(=O)C(C(C)(C)C)NC(=O)C(F)(F)F)C(=O)NC(CC1CCNC1=O)C(=O)C(=O)NC').tpsa,
          },
        ],
        executiveSummary:
          'MV-301 shows single-digit nanomolar 3CLpro potency with clean toxicology and zero Lipinski violations. Primary developmental focus is CYP3A4 clearance rate optimization.',
      },
      review: {
        decision: 'Advance to Hit-to-Lead',
        reviewerRole: 'Pharmacologist',
        reviewerName: 'Dr. Marcus Vance',
        notes: 'Selected as antiviral lead benchmark; PK boosting / deuterated P3 analogs under evaluation.',
        updatedAt: '2026-11-16T10:05:00Z',
      },
    },
    {
      id: 'cand-sotorasib',
      name: 'MV-412 Acrylamide Switch-II',
      smiles: sotorasibSmiles,
      campaignId: 'cmp-oncology-kinase',
      targetId: 'tgt-kras',
      targetName: 'KRAS G12C Oncoprotein',
      stage: 'Lead Optimization',
      createdAt: '2026-11-16T17:10:00Z',
      properties: computeMolecularProperties(sotorasibSmiles),
      analysis: {
        bioactivity: {
          targetName: 'KRAS G12C Oncoprotein',
          predictedIc50Range: '15 - 40 nM',
          estimatedPic50: 7.55,
          activityClass: 'Potent',
          confidencePercent: 89,
          mechanismHypothesis:
            'Irreversible covalent alkylation of mutant Cys12 paired with non-covalent Switch-II pocket locking.',
          bindingInteractions: [
            'Acrylamide warhead forms covalent thioether bond with KRAS G12C Cys12',
            'Fluorophenol substituent forms H-bond network inside cryptic His95 groove',
            'Atropisomeric isopropyl-pyridine occupies lipophilic Switch-II subpocket',
          ],
          selectivityNotes:
            'Selective for KRAS G12C mutant over wild-type KRAS/NRAS/HRAS lacking Cys12.',
        },
        toxicity: {
          overallRisk: 'Moderate',
          hergRisk: 'Low',
          hepatotoxicityRisk: 'Moderate',
          amesMutagenicityRisk: 'Low',
          cyp3a4Inhibition: 'Moderate',
          bbbPenetration: 'Low',
          giAbsorption: 'High',
          metabolicStability:
            'Moderate glutathione conjugation on acrylamide warhead and CYP3A4 oxidation on isopropyl-pyridine.',
          safetyAlerts: [
            'Michael acceptor acrylamide warhead requires non-specific thiol reactivity profiling',
            'Molecular weight exceeds 550 Da (1 Lipinski violation; acceptable beyond-Rule-of-5 space)',
          ],
          toxicologySummary:
            'Acceptable safety margin for oncology covalent modality; track hepatic ALT/AST and GSH conjugation rate.',
        },
        optimizations: [
          {
            title: 'Fluoro-Acrylamide Reactivity Tuning',
            rationale:
              'Modulates Michael acceptor electrophilicity to lower off-target plasma thiol conjugation.',
            modifiedSmiles:
              'C=C(F)C(=O)N1CCN(c2nc(=O)n(-c3c(C)ccnc3C(C)C)c3nc(-c4c(O)cccc4F)cc(C)c23)C(C)C1',
            expectedImpact: 'Reduces non-specific GSH half-life reactivity while retaining Cys12 k_inact.',
            validStructure: true,
            formula: computeMolecularProperties('C=C(F)C(=O)N1CCN(c2nc(=O)n(-c3c(C)ccnc3C(C)C)c3nc(-c4c(O)cccc4F)cc(C)c23)C(C)C1').formula,
            molecularWeight: computeMolecularProperties('C=C(F)C(=O)N1CCN(c2nc(=O)n(-c3c(C)ccnc3C(C)C)c3nc(-c4c(O)cccc4F)cc(C)c23)C(C)C1').molecularWeight,
            cLogP: computeMolecularProperties('C=C(F)C(=O)N1CCN(c2nc(=O)n(-c3c(C)ccnc3C(C)C)c3nc(-c4c(O)cccc4F)cc(C)c23)C(C)C1').cLogP,
            tpsa: computeMolecularProperties('C=C(F)C(=O)N1CCN(c2nc(=O)n(-c3c(C)ccnc3C(C)C)c3nc(-c4c(O)cccc4F)cc(C)c23)C(C)C1').tpsa,
          },
        ],
        executiveSummary:
          'MV-412 shows potent Switch-II KRAS G12C occupancy despite elevated MW (560 Da). Tuning warhead electrophilicity is advised to minimize off-target thiol reactivity.',
      },
      review: {
        decision: 'Request Wet-Lab Assay',
        reviewerRole: 'Computational Chemist',
        reviewerName: 'Dr. Kenji Takahashi',
        notes: 'Confirm atropisomer stability barrier and RapidFire Cys12 covalent k_inact/Ki.',
        updatedAt: '2026-11-17T14:25:00Z',
      },
    },
  ];

  return { campaigns, targets, assays, candidates };
}

export function loadStore(): WorkspaceSnapshot {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const seed = createSeedData();
      fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as WorkspaceSnapshot;
  } catch (err) {
    console.error('Failed to load store, regenerating seed data:', err);
    const seed = createSeedData();
    return seed;
  }
}

export function saveStore(store: WorkspaceSnapshot): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function addOrUpdateCandidate(candidate: DrugCandidate): WorkspaceSnapshot {
  const store = loadStore();
  const idx = store.candidates.findIndex((c) => c.id === candidate.id);
  if (idx >= 0) {
    store.candidates[idx] = candidate;
  } else {
    store.candidates.unshift(candidate);
  }
  saveStore(store);
  return store;
}

export function updateCandidateReview(
  candidateId: string,
  review: ReviewRecord,
  stage?: CandidateStage
): DrugCandidate | null {
  const store = loadStore();
  const candidate = store.candidates.find((c) => c.id === candidateId);
  if (!candidate) return null;
  candidate.review = review;
  if (stage) {
    candidate.stage = stage;
  }
  saveStore(store);
  return candidate;
}

export function deleteCandidateById(candidateId: string): boolean {
  const store = loadStore();
  const initialLen = store.candidates.length;
  store.candidates = store.candidates.filter((c) => c.id !== candidateId);
  if (store.candidates.length === initialLen) return false;
  saveStore(store);
  return true;
}

export function createCampaign(campaign: ScreeningCampaign): ScreeningCampaign {
  const store = loadStore();
  store.campaigns.unshift(campaign);
  saveStore(store);
  return campaign;
}
