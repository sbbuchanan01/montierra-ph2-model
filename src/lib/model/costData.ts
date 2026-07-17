import type { CostLineItem } from './types';

/**
 * The full Detailed Cost Input line-item list, verbatim from the workbook.
 * amountType 'perUnit' rows are $/unit × unit count; 'hardCostContingencyPct'
 * is % × total GC contract group; 'computed' rows are engine outputs.
 */
const L = (
  id: string,
  code: string,
  group: string,
  label: string,
  value: number,
  amountType: CostLineItem['amountType'] = 'fixed',
): CostLineItem => ({ id, code, group, label, value, amountType });

export const DEFAULT_COST_ITEMS: CostLineItem[] = [
  // ---- LAND (1000xx) ----
  L('land-price', '100101', 'Land Acquisition', 'Land Price Net of Earnest Money', 500_000),
  L('earnest', '100101', 'Land Acquisition', 'Earnest Money', 0),
  L('earnest-addl', '100101', 'Land Acquisition', 'First Additional Earnest Money Deposit', 0),
  L('sitework', '100102', 'Site Improvements', 'Sitework', 300_000),
  L('demolition', '100102', 'Site Improvements', 'Demolition', 0),
  L('tree-relocation', '100102', 'Site Improvements', 'Tree Relocation', 0),
  L('psa-attorney', '100103', 'Closing Costs, Title, Commissions', 'Contract Attorney - PSA', 25_000),
  L('title', '100103', 'Closing Costs, Title, Commissions', 'Title', 5_000),
  L('owners-premium', '100103', 'Closing Costs, Title, Commissions', "Owner's Premium", 49, 'perUnit'),
  L('transfer-tax', '100103', 'Closing Costs, Title, Commissions', 'Transfer Tax', 0),

  // ---- HARD COSTS (2002xx) ----
  L('pre-construction', '200201', 'Pre-Construction Costs', 'Pre-Construction Costs', 0),
  L('gc-contract', '200202', 'General Construction Contract', 'Concept Estimate', 115_000, 'perUnit'),
  L('gc-low-voltage', '200202', 'General Construction Contract', 'Low Voltage Design-Build', 0),
  L('gc-ve-accepted', '200202', 'General Construction Contract', 'less: VE accepted', 0),
  L('gc-ve-pending', '200202', 'General Construction Contract', 'less: VE pending', 0),
  L('hc-contingency', '200203', 'Hard Cost Contingency', 'Hard Cost Contingency', 0.05, 'hardCostContingencyPct'),
  L('cm-fee', '200204', 'Construction Management Fee', 'Construction Management Fee', 0),
  L('retail-ti', '200205', 'Retail Tenant Improvements', 'Retail Tenant Improvements', 0, 'computed'),
  L('amenities', '200206', 'Building Amenities', 'Building Amenities', 0),
  L('ffe-appliances', '200207', 'FF&E', 'Appliance Package', 0, 'perUnit'),
  L('ffe-pool', '200207', 'FF&E', 'Pool Allowance', 0),
  L('ffe-fitness', '200207', 'FF&E', 'Fitness Allowance', 0),
  L('ffe-golf', '200207', 'FF&E', 'Golf Equipment Allowance', 0),
  L('ffe-misc', '200207', 'FF&E', 'Miscellaneous', 25_000),
  L('low-voltage', '200208', 'Low Voltage', 'Low Voltage', 0),
  L('security-access', '200209', 'Building Security', 'Tech/Access Control Systems', 500, 'perUnit'),
  L('security-system', '200209', 'Building Security', 'Security System', 250, 'perUnit'),
  L('monument-signage', '200210', 'Building Monument/Exterior Signage', 'Building Monument/Exterior Signage', 25_000),
  L('interior-signage', '200211', 'Interior Signage/Directory', 'Interior Signage/Directory', 5_000),
  L('landscaping', '200212', 'Landscaping/Irrigation', 'Landscaping/Irrigation', 0),
  L('environmental-rem', '200213', 'Environmental Remediation', 'Environmental Remediation', 0),
  L('hc-ae-transformer', '200214', 'Other Hard Costs', 'AE Transformer Allowance', 0),
  L('hc-teal', '200214', 'Other Hard Costs', 'TEAL System Allowance', 0),
  L('hc-ev', '200214', 'Other Hard Costs', 'EV Charger Allowance', 0),
  L('hc-allowance', '200214', 'Other Hard Costs', 'Allowance', 50_000),
  L('almc-telecomm', '200215', 'AL/MC Equipment/Systems', 'Telecomm Conduit', 0),
  L('almc-startup', '200215', 'AL/MC Equipment/Systems', 'Misc. Start-Up Cost', 0),
  L('almc-misc', '200215', 'AL/MC Equipment/Systems', 'Miscellaneous', 0),

  // ---- SOFT COSTS - CONSULTANTS (3003xx) ----
  L('arch-design', '300301', 'Architecture & Engineering', 'Architectural Design + Carried Consultants', 0),
  L('structural-eng', '300301', 'Architecture & Engineering', 'Structural Engineer', 0),
  L('construction-admin', '300301', 'Architecture & Engineering', 'Construction Administration', 0),
  L('traffic-eng', '300301', 'Architecture & Engineering', 'Traffic Engineering - Permitting & CA', 15_000),
  L('ae-misc', '300301', 'Architecture & Engineering', 'Miscellaneous', 15_000),
  L('space-planning', '300302', 'Space Planning', 'Space Planning', 0),
  L('interior-design', '300303', 'Interior Design', 'Interior Design', 0),
  L('civil-design', '300304', 'Civil Engineering', 'Civil Engineer Design / Permitting', 0),
  L('civil-ca', '300304', 'Civil Engineering', 'Civil Engineer CA', 0),
  L('civil-cos', '300304', 'Civil Engineering', 'Civil Engineer COs', 0),
  L('civil-misc', '300304', 'Civil Engineering', 'Miscellaneous', 15_000),
  L('alta-survey', '300305', 'Topography/Survey', 'ALTA Survey', 0),
  L('dev-survey', '300305', 'Topography/Survey', 'Development Survey', 7_500),
  L('env-consultant', '300306', 'Environmental Consultant', 'Environmental Engineer / Remediation', 5_000),
  L('wetlands', '300307', 'Wetlands Consultant', 'Consulting / Remediation', 0),
  L('geotech', '300308', 'Soil Engineering Consultant', 'Geotechnical', 7_500),
  L('soil-remediation', '300308', 'Soil Engineering Consultant', 'Remediation', 0),
  L('waterproofing', '300309', 'Special Inspections & Testing', 'Waterproofing Consultant', 15_000),
  L('materials-testing', '300309', 'Special Inspections & Testing', 'Materials Testing', 25_000),
  L('fha-ada-tas', '300310', 'Third-Party Certification', 'FHA/ADA/TAS', 10_000),
  L('mep', '300312', 'Mech/Elect/Plumbing Consultant', 'MEP', 25_000),
  L('landscape-arch', '300313', 'Landscape Consultant', 'Landscape Architect', 0),
  L('arborist', '300313', 'Landscape Consultant', 'Arborist', 0),
  L('security-consultant', '300314', 'Security Consultant', 'Security Consultant', 0),
  L('consultant-reimb', '300315', 'Consultant Reimb Expense', 'Reimbursements', 10_000),
  L('tax-prep', '300316', 'Other Consultants', 'Tax Prep', 15_000),
  L('consultant-allowance', '300316', 'Other Consultants', 'Allowance', 15_000),
  L('legal-contracts', '300317', 'Legal Fees - Contracts', 'Contract Attorney', 25_000),
  L('legal-other', '300318', 'Legal Fees - Other', 'Miscellaneous', 0),

  // ---- SOFT COSTS - LEASING & MARKETING (4004xx) ----
  L('market-study', '400401', 'Market Study', 'Market Study', 0),
  L('commission-landlord', '400402', 'Commissions - Landlord', 'Leasing Commission', 0),
  L('commission-tenant-rep', '400403', 'Commissions - Tenant Rep', 'Leasing Commission', 0),
  L('commission-sale', '400404', 'Commissions - Sale', 'Investment Sales Commission', 0),
  L('leaseup-marketing', '400405', 'Advertising/Marketing', 'Lease-Up', 455, 'perUnit'),
  L('website', '400405', 'Advertising/Marketing', 'Website', 2_500),
  L('collateral', '400405', 'Advertising/Marketing', 'Collateral Materials', 3_400),
  L('marketing-misc', '400405', 'Advertising/Marketing', 'Miscellaneous', 0),
  L('marketing-overhead', '400406', 'Marketing Overhead', 'Marketing Overhead', 0),
  L('marketing-office', '400407', 'Marketing/Construction Office', 'Marketing/Construction Office', 0),
  L('marketing-events', '400408', 'Marketing Events', 'Allowance', 0),
  L('site-signs', '400409', 'Site Signs', 'Allowance', 0),
  L('model-design', '400410', 'Model Design/Furnishings', 'Allowance', 0),
  L('leaseup-costs', '400411', 'Lease-up Costs', 'Allowance', 0),
  L('lease-buyout', '400412', 'Lease Buyout Fee', 'Allowance', 0),
  L('legal-leasing', '400413', 'Legal Fees - Leasing Related', 'Legal Fees - Leasing Related', 0),

  // ---- SOFT COSTS - MUNICIPAL (5005xx) ----
  L('municipal-fees', '500501', 'Municipal Fees', 'Municipal Fees', 35_000),
  L('erosion-fiscal', '500501', 'Municipal Fees', 'Erosion/Sedimentation Fiscal', 0),
  L('sdp-zoning', '500501', 'Municipal Fees', 'SDP / Zoning / Transportation Fee', 0),
  L('transportation-fil', '500501', 'Municipal Fees', 'Transportation Mitigation FIL / Street Impact Fees', 50_000),
  L('building-permits', '500501', 'Municipal Fees', 'Building Permit Fees', 15_000),
  L('park-dedication', '500502a', 'Park Dedication Fees', 'Parkland Dedication Fee / Fee in Lieu', 50_000),
  L('water-impact', '500502b', 'Sewer/Water Area Charges', 'Water Impact Fees', 4_500, 'perUnit'),
  L('sewer-impact', '500502b', 'Sewer/Water Area Charges', 'Sewer Impact Fees', 1_250, 'perUnit'),
  L('other-municipal', '500504', 'Other Municipal Fees', 'Fees', 0),
  L('legal-municipal', '500505', 'Legal Fees - Municipal Related', 'Fees', 0),

  // ---- SOFT COSTS - FINANCING (6006xx) ----
  L('appraisal', '600602', 'Appraisal Fees', 'Appraisal Fees', 5_000),
  L('fha-exam', '600603', 'FHA Exam Fees', 'FHA Exam Fees', 0),
  L('fha-inspection', '600604', 'FHA Inspection', 'FHA Inspection', 0),
  L('fha-mip', '600605', 'FHA MIP', 'FHA MIP', 0),
  L('other-fha', '600606', 'Other FHA Fees', 'Other FHA Fees', 0),
  L('title-recording', '600607', 'Title & Recording Fees', 'Title & Recording Fees', 0),
  L('mortgage-reg-tax', '600608', 'Mortgage Registration Tax', 'Mortgage Registration Tax', 0),
  L('lender-inspections', '600609', 'Lender Architect/Inspections', 'Lender Architect/Inspections', 15_000),
  L('lender-legal', '600610', 'Financing Related Legal Fees', 'Financing Related Legal Fees', 12_500),
  L('other-finance-fees', '600611', 'Other Finance Fees', 'Other Finance Fees', 0),
  L('loan-closing-costs', '600612', 'Loan Closing Costs', 'Loan Closing Costs', 10_000),
  L('internal-interest', '600613', 'Internal Construction Interest', 'Internal Construction Interest', 0),
  L('external-interest', '600614', 'External Construction Interest', 'External Construction Interest', 0, 'computed'),
  L('loan-fee', '600615', 'Loan Fees - Lender', 'Loan Origination Fee', 0, 'computed'),
  L('equity-placement', '600616', 'Equity/Loan Fees - Broker', 'Equity Placement Fee', 0),
  L('debt-placement', '600616', 'Equity/Loan Fees - Broker', 'Debt Placement Fee', 0),
  L('guarantee-fee', '600617', 'Guarantee Fee', 'Guarantee Fee', 0),

  // ---- SOFT COSTS - OPERATING (7007xx) ----
  L('startup-costs', '700701', 'Start-up Costs', 'Start-up Costs', 25_000),
  L('vacancy-carrying', '700702', 'Vacancy/Carrying Costs', 'Vacancy/Carrying Costs', 0, 'computed'),
  L('interim-re-taxes', '700703', 'Real Estate Taxes (Interim)', 'Real Estate Taxes (Interim)', 0, 'computed'),
  L('insurance-operating', '700704', 'Insurance (Operating)', 'Insurance (Operating)', 0),
  L('legal-easement', '700705', 'Legal Fees - Easement/Operating', 'Legal Fees - Easement and Operating Related', 0),

  // ---- SOFT COSTS - G&A (8008xx) ----
  L('insurance-gl-ocip', '800801', 'Insurance - GL / OCIP', 'Insurance - GL / OCIP', 0),
  L('insurance-br', '800802', 'Insurance - BR', "Builder's Risk Insurance", 250_000),
  L('grants-rebates', '800803', 'Grants/Rebates', 'Grants/Rebates', 0),
  L('working-capital', '800804', 'Working Capital', 'Working Capital', 0),
  L('ga-closing-costs', '800805', 'Closing Costs', 'Closing Costs', 0),
  L('development-fee', '800806', 'Development Fee', 'Development Fee', 200_000),
  L('project-contingency', '800807', 'Project Contingency', 'Project Contingency', 0, 'computed'),
  L('travel', '800808', 'Travel', 'Travel', 5_000),
  L('ga-misc', '800809', 'Miscellaneous', 'Miscellaneous', 15_000),
  L('equity-fee-broker', '800810', 'Equity Fee - Broker', 'Equity Fee - Broker', 0),
  L('legal-jv', '800811', 'Legal Fees - Joint Venture', 'Legal Fees - Joint Venture', 50_000),
];

/** Category (Development Budget section) from a cost code prefix. */
export function categoryForCode(code: string): string {
  const p = code.slice(0, 4);
  if (p.startsWith('1000') || p.startsWith('1001')) return 'Land';
  switch (p) {
    case '2002':
      return 'Hard Costs';
    case '3003':
      return 'Soft Costs - Consultants';
    case '4004':
      return 'Soft Costs - Marketing & Leasing';
    case '5005':
      return 'Soft Costs - Municipal';
    case '6006':
      return 'Soft Costs - Financing';
    case '7007':
      return 'Soft Costs - Operating';
    case '8008':
      return 'Soft Costs - G&A';
    default:
      return 'Other';
  }
}

/** DD / Pre-Development budget — informational only, does NOT roll into the project budget. */
export const DD_PREDEV_BUDGET = {
  dueDiligence: [
    { label: 'Survey', amount: 3_500 },
    { label: 'Phase I Environmental Report', amount: 2_500 },
    { label: 'Geotechnical Report', amount: 5_000 },
    { label: 'Civil - Feasibility', amount: 1_500 },
    { label: 'Architecture - Concept Plan', amount: 1_000 },
    { label: 'Legal - PSA, Title, Escrow', amount: 7_500 },
    { label: 'Other', amount: 5_000 },
  ],
  permittingDesign: [
    { label: 'Civil Engineer', amount: 65_000 },
    { label: 'Traffic Engineer', amount: 15_000 },
    { label: 'Architectural Design', amount: 50_000 },
    { label: 'Structural Engineer', amount: 20_000 },
    { label: 'MEP Engineer', amount: 20_000 },
    { label: 'Landscape Architect', amount: 15_000 },
    { label: 'Contingency', amount: 40_000 },
  ],
};
