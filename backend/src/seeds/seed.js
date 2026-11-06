import 'dotenv/config';
import mongoose from 'mongoose';
import { describeMongoTarget, redactMongoCredentials } from '../config/db.js';
import {
  Society,
  User,
  Fund,
  Transaction,
  Event,
  Approval,
  AuditLog,
  ResidentQuery,
  Compliance,
} from '../models/index.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/society_ledger';

export async function seedDatabase() {
  console.log('Connecting to MongoDB for seeding:', describeMongoTarget(MONGODB_URI));
  try {
    await mongoose.connect(MONGODB_URI);
  } catch (error) {
    throw new Error(`Seed connection failed: ${redactMongoCredentials(error?.message)}`);
  }

  console.log('Clearing existing records for fresh demo initialization...');
  const existingSociety = await Society.findOne({ code: 'GW-2021' });
  if (existingSociety) {
    await Promise.all([
      Transaction.collection.deleteMany({ society: existingSociety._id }),
      Approval.deleteMany({ society: existingSociety._id }),
      ResidentQuery.deleteMany({ society: existingSociety._id }),
      Compliance.deleteMany({ society: existingSociety._id }),
      Event.deleteMany({ society: existingSociety._id }),
      Fund.deleteMany({ society: existingSociety._id }),
      AuditLog.collection.deleteMany({ society: existingSociety._id }),
      User.deleteMany({ society: existingSociety._id }),
      Society.deleteOne({ _id: existingSociety._id }),
    ]);
  }
  await User.deleteMany({ email: { $regex: '@society.org$' } });

  console.log('Creating Greenwood Heights RWA...');
  const society = await Society.create({
    name: 'Greenwood Heights RWA',
    code: 'GW-2021',
    registrationNumber: 'RWA/2021/489',
    address: {
      street: 'Outer Ring Road, Bellandur',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560103',
    },
    contactEmail: 'contact@society.org',
    contactPhone: '+91 98450 12345',
    fiscalYearStartMonth: 4,
    isActive: true,
  });

  console.log('Creating 5 demo role accounts with bcrypt passwords...');
  const demoUsers = [
    {
      name: 'Dr. Anand Rao',
      email: 'admin@society.org',
      passwordHash: 'Admin@123',
      phone: '+91 98450 11001',
      apartmentNumber: 'PH-01',
      role: 'Society Administrator',
      verificationStatus: 'VERIFIED',
    },
    {
      name: 'Priya Sharma',
      email: 'treasurer@society.org',
      passwordHash: 'Treasurer@123',
      phone: '+91 98450 11002',
      apartmentNumber: 'A-402',
      role: 'Treasurer',
      verificationStatus: 'VERIFIED',
    },
    {
      name: 'Sunil Rao',
      email: 'committee@society.org',
      passwordHash: 'Committee@123',
      phone: '+91 98450 11003',
      apartmentNumber: 'B-305',
      role: 'Committee Member',
      verificationStatus: 'VERIFIED',
    },
    {
      name: 'Suresh Menon, CA',
      email: 'auditor@society.org',
      passwordHash: 'Auditor@123',
      phone: '+91 98450 11004',
      apartmentNumber: null,
      role: 'Auditor',
      verificationStatus: 'VERIFIED',
    },
    {
      name: 'Vikram Joshi',
      email: 'resident@society.org',
      passwordHash: 'Resident@123',
      phone: '+91 98450 11005',
      apartmentNumber: 'C-204',
      role: 'Resident',
      verificationStatus: 'VERIFIED',
    },
  ];

  const createdUsers = {};
  for (const u of demoUsers) {
    const user = await User.create({
      ...u,
      society: society._id,
    });
    createdUsers[u.role] = user;
    console.log(`  ✓ Created ${u.role}: ${u.email} (Password: ${u.passwordHash})`);
  }

  // Update society committee members
  society.committeeMembers = [
    createdUsers['Society Administrator']._id,
    createdUsers['Treasurer']._id,
    createdUsers['Committee Member']._id,
  ];
  await society.save();

  console.log('Creating Society Funds & Reserves...');
  const fundsData = [
    {
      name: 'General Corpus Reserve Fund',
      code: 'FND-CORPUS',
      type: 'CORPUS',
      openingBalancePaise: 275000000,
      currentBalancePaise: 284000000,
      restrictedUse: true,
      purpose: 'Permanent capital reserve deposited in fixed deposits. Interest utilized for operational deficit.',
      bankAccount: 'HDFC Bank - A/C ****4891',
    },
    {
      name: 'Asset Replacement & Sinking Fund',
      code: 'FND-SINKING',
      type: 'SINKING',
      openingBalancePaise: 132000000,
      currentBalancePaise: 144540000,
      restrictedUse: true,
      purpose: 'Ring-fenced capital overhaul reserve for elevators, DG sets, and exterior waterproofing.',
      bankAccount: 'SBI - A/C ****9102',
    },
    {
      name: 'Monthly Maintenance & Operational Account',
      code: 'FND-MAINT',
      type: 'OPERATIONAL',
      openingBalancePaise: 45000000,
      currentBalancePaise: 61235000,
      restrictedUse: false,
      purpose: 'Working liquidity for security agency, housekeeping, lift AMC, common utilities.',
      bankAccount: 'ICICI Bank - A/C ****3310',
    },
    {
      name: 'Rooftop Solar Special Project Fund',
      code: 'FND-SOLAR',
      type: 'SPECIAL_PROJECT',
      openingBalancePaise: 0,
      currentBalancePaise: 21500000,
      restrictedUse: true,
      purpose: 'Member contributions toward Phase 2 grid-tied solar net metering infrastructure.',
      bankAccount: 'ICICI Bank - A/C ****3310 (Sub-ledger)',
    },
  ];

  const createdFunds = {};
  for (const f of fundsData) {
    // Delete existing fund if any
    await Fund.deleteMany({ society: society._id, code: f.code });
    const fund = await Fund.create({
      ...f,
      society: society._id,
      createdBy: createdUsers['Treasurer']._id,
      status: 'ACTIVE',
      lastReconciledAt: new Date(),
    });
    createdFunds[f.code] = fund;
    console.log(`  ✓ Created Fund: ${f.name} (${f.code})`);
  }

  console.log('Creating General Ledger Transactions...');
  // Clean up existing
  await Transaction.collection.deleteMany({ society: society._id });

  const transactionsData = [
    {
      reference: 'VR-2026-089',
      date: new Date('2026-10-24'),
      type: 'EXPENSE',
      fund: createdFunds['FND-MAINT']._id,
      category: 'Lift & Elevator Maintenance',
      description: 'Johnson Lifts Annual Maintenance Contract (Q3 Comprehensive AMC)',
      amountPaise: 1850000,
      paymentMethod: 'NEFT_RTGS',
      status: 'RECONCILED',
      vendorName: 'Johnson Lifts Pvt Ltd',
      invoiceNumber: 'INV-JL-2026-441',
      createdBy: createdUsers['Treasurer']._id,
      approvedBy: createdUsers['Treasurer']._id,
      reconciledBy: createdUsers['Auditor']._id,
      reconciliationReference: 'BANK-HDFC-9921',
    },
    {
      reference: 'VR-2026-088',
      date: new Date('2026-10-23'),
      type: 'INCOME',
      fund: createdFunds['FND-MAINT']._id,
      category: 'Maintenance Dues',
      description: 'October Maintenance Collection Batch — Wing C (Flat C-101 to C-404)',
      amountPaise: 14700000,
      paymentMethod: 'UPI',
      status: 'RECONCILED',
      invoiceNumber: 'RCPT-OCT-BATCH-C',
      createdBy: createdUsers['Treasurer']._id,
      approvedBy: createdUsers['Treasurer']._id,
      reconciledBy: createdUsers['Auditor']._id,
      reconciliationReference: 'UPI-RAZORPAY-COLLECT-401',
    },
    {
      reference: 'VR-2026-087',
      date: new Date('2026-10-22'),
      type: 'EXPENSE',
      fund: createdFunds['FND-SINKING']._id,
      category: 'Solar Capital Works',
      description: 'Replacement of Phase 1 20kVA Solar Inverter Grid Synchronizer',
      amountPaise: 3420000,
      paymentMethod: 'NEFT_RTGS',
      status: 'APPROVED',
      vendorName: 'SunPower Renewable Systems',
      invoiceNumber: 'SP-BLR-892',
      createdBy: createdUsers['Committee Member']._id,
      approvedBy: createdUsers['Society Administrator']._id,
    },
    {
      reference: 'VR-2026-086',
      date: new Date('2026-10-20'),
      type: 'EXPENSE',
      fund: createdFunds['FND-MAINT']._id,
      category: 'Gardening & Common Area',
      description: 'Monsoon Tree Pruning and Horticulture Landscaping Overhaul',
      amountPaise: 1200000,
      paymentMethod: 'CHEQUE',
      status: 'PENDING',
      vendorName: 'GreenThumb Nurseries & Landscaping',
      invoiceNumber: 'GT-5091',
      createdBy: createdUsers['Committee Member']._id,
    },
    {
      reference: 'VR-2026-084',
      date: new Date('2026-10-15'),
      type: 'INCOME',
      fund: createdFunds['FND-CORPUS']._id,
      category: 'Corpus Interest Deposit',
      description: 'Quarterly Fixed Deposit Interest Credit (FD #98102390)',
      amountPaise: 5400000,
      paymentMethod: 'NEFT_RTGS',
      status: 'RECONCILED',
      vendorName: 'HDFC Bank Ltd',
      invoiceNumber: 'FD-INT-Q2-2026',
      createdBy: createdUsers['Treasurer']._id,
      approvedBy: createdUsers['Treasurer']._id,
      reconciledBy: createdUsers['Auditor']._id,
      reconciliationReference: 'BANK-HDFC-FD-9810',
    },
  ];

  for (const t of transactionsData) {
    await Transaction.create({ ...t, society: society._id });
  }
  console.log(`  ✓ Inserted ${transactionsData.length} ledger vouchers`);

  console.log('Creating Community Events...');
  await Event.deleteMany({ society: society._id });

  await Event.create({
    society: society._id,
    title: 'Ganesh Utsav & Cultural Fest 2026',
    description: 'Community eco-friendly idol installation, 3-day evening cultural events, and dinner for 180 families.',
    date: new Date('2026-09-15'),
    endDate: new Date('2026-09-18'),
    status: 'SETTLED',
    proposedBudgetPaise: 8000000,
    approvedBudgetPaise: 7500000,
    actualExpenditurePaise: 7280000,
    fundingSource: 'Cultural Sub-Fund & Voluntary Contributions',
    proposedBy: createdUsers['Committee Member']._id,
    approvedBy: createdUsers['Society Administrator']._id,
    approvalResolution: 'Management Committee Resolution #2026/08',
    quotations: [
      { name: 'Shree Krishna Caterers & Pandal Decors', quotationReference: 'Q-SKC-881', bidAmountPaise: 4800000, status: 'SELECTED', isContractSigned: true },
      { name: 'Royal Pandal & Sound Engineers', quotationReference: 'Q-RP-104', bidAmountPaise: 5400000, status: 'REJECTED' },
    ],
    budgetBreakdown: [
      { head: 'Eco-Friendly Clay Idol & Puja Samagri', proposedAmountPaise: 1500000, approvedAmountPaise: 1500000, actualAmountPaise: 1420000 },
      { head: 'Pandal Setup, Lighting & Audio', proposedAmountPaise: 3500000, approvedAmountPaise: 3000000, actualAmountPaise: 3000000 },
      { head: 'Community Prasad & Dinner', proposedAmountPaise: 3000000, approvedAmountPaise: 3000000, actualAmountPaise: 2860000 },
    ],
    settlementReport: 'Concluded with verified vouchers. Unspent balance of ₹2,200 deposited back.',
    settledAt: new Date('2026-09-20'),
  });

  await Event.create({
    society: society._id,
    title: 'Diwali Lights & Cultural Gala 2026',
    description: 'Facade illumination across towers, rangoli festival, and festive sweets box for 240 apartments.',
    date: new Date('2026-11-01'),
    endDate: new Date('2026-11-03'),
    status: 'PROPOSED',
    proposedBudgetPaise: 13000000,
    fundingSource: 'Proposed: Festive Assessment & Operational Surplus',
    proposedBy: createdUsers['Resident']._id,
    quotations: [
      { name: 'Luminance Tower Facade Lighting', quotationReference: 'Q-LT-401', bidAmountPaise: 6500000, status: 'PENDING' },
      { name: 'StarLights Bangalore', quotationReference: 'Q-SL-89', bidAmountPaise: 7200000, status: 'PENDING' },
    ],
    budgetBreakdown: [
      { head: 'Common Area Facade Lighting (3 Towers)', proposedAmountPaise: 6500000 },
      { head: 'Diwali Sweets & Dry Fruit Gift Boxes (240 units)', proposedAmountPaise: 4500000 },
      { head: 'Sound, Stage & Prizes for Children', proposedAmountPaise: 2000000 },
    ],
  });
  console.log('  ✓ Inserted community events');

  console.log('Creating Expense Approvals...');
  await Approval.deleteMany({ society: society._id });

  await Approval.create({
    society: society._id,
    description: 'Lift Modernization Capacitor & Inverter Overhaul (Johnson Lifts)',
    requestedAmountPaise: 3420000,
    fund: createdFunds['FND-SINKING']._id,
    vendorName: 'SunPower Renewable & Elevator Systems',
    quotationReference: 'Q-SP-982',
    invoiceNumber: 'INV-SP-2026-44',
    requester: createdUsers['Committee Member']._id,
    status: 'PENDING',
    notes: 'Urgent replacement requested following quarterly lift inspection report.',
    decisionHistory: [],
  });

  await Approval.create({
    society: society._id,
    description: 'Monsoon Landscape & Tree Pruning Overhaul',
    requestedAmountPaise: 1200000,
    fund: createdFunds['FND-MAINT']._id,
    vendorName: 'GreenThumb Nurseries & Landscaping',
    quotationReference: 'GT-5091',
    invoiceNumber: 'INV-GT-09',
    requester: createdUsers['Resident']._id,
    status: 'PENDING',
    notes: 'Trimming branches obstructing overhead power lines near Block C transformer.',
    decisionHistory: [],
  });

  console.log('  ✓ Inserted expense approvals');

  console.log('Creating Resident Clarification Queries...');
  await ResidentQuery.deleteMany({ society: society._id });

  await ResidentQuery.create({
    society: society._id,
    submittedBy: createdUsers['Resident']._id,
    unit: 'B-402',
    reference: 'QRY-2026-088',
    category: 'Fund Utilization',
    subject: 'Status of Rooftop Solar Phase 2 Grid Metering subsidy credit',
    question: 'Could the committee clarify if the central solar subsidy of ₹78,000 has been credited into our ICICI operational account or adjusted against BESCOM dues?',
    status: 'ANSWERED',
    responses: [
      {
        respondedBy: createdUsers['Committee Member']._id,
        response: 'Subsidy sanction letter received from KREDL. Amount credited into ICICI account and reflected in September ledger voucher VR-2026-074.',
        respondedAt: new Date('2026-10-18'),
        isOfficialResponse: true,
      },
    ],
  });

  await ResidentQuery.create({
    society: society._id,
    submittedBy: createdUsers['Resident']._id,
    unit: 'B-402',
    reference: 'QRY-2026-092',
    category: 'Maintenance Billing',
    subject: 'Clarification regarding water tanker surcharge in October bill',
    question: 'Could the committee share the number of tankers procured during the BESCOM water supply outage?',
    status: 'OPEN',
    responses: [],
  });
  console.log('  ✓ Inserted demo resident queries');

  console.log('Creating Statutory & Tax Compliance Records...');
  await Compliance.deleteMany({ society: society._id });

  await Compliance.create({
    society: society._id,
    filingType: 'Society Annual Return (Form V)',
    category: 'REGISTRAR_SOCIETIES',
    statutoryBody: 'Registrar of Co-operative Societies (Karnataka)',
    financialPeriod: 'FY 2025-26',
    deadline: new Date('2026-09-30'),
    deadlineSource: 'Karnataka Societies Registration Act 1960 Sec 13',
    status: 'FILED',
    preparationStatus: 'PREPARED',
    reviewStatus: 'APPROVED',
    documentationStatus: 'COMPLETE',
    responsiblePerson: createdUsers['Treasurer']._id,
    reviewedBy: createdUsers['Auditor']._id,
    submissionDate: new Date('2026-09-24'),
    acknowledgementReference: 'KAR-SOC-RET-2026-98102',
    notes: 'Annual returns and certified audited balance sheets formally accepted by District Registrar.',
    supportingDocuments: [
      {
        title: 'Form V Signed Audited Accounts & Committee List',
        documentType: 'RETURN_FORM',
        fileName: 'Form_V_Signed_Audited_Accounts_FY25_26.pdf',
        fileUrl: 'https://docs.society.internal/compliance/form_v_signed.pdf',
        fileSize: 480000,
        uploadedBy: createdUsers['Treasurer']._id,
      },
    ],
    statusHistory: [
      {
        fromStatus: 'PENDING',
        toStatus: 'FILED',
        action: 'FORMAL_SUBMISSION',
        changedBy: createdUsers['Treasurer']._id,
        comments: 'Form V submitted and acknowledged at Registrar office.',
      },
    ],
  });

  await Compliance.create({
    society: society._id,
    filingType: 'Quarterly GST-TDS Return (GSTR-7)',
    category: 'TAX_INDIRECT',
    statutoryBody: 'Goods & Services Tax Network (GSTN)',
    financialPeriod: 'Q2 FY 2026-27 (Jul - Sep)',
    deadline: new Date('2026-10-10'),
    deadlineSource: 'CGST Act 2017 Sec 51 & Rule 66',
    status: 'FILED',
    preparationStatus: 'PREPARED',
    reviewStatus: 'APPROVED',
    documentationStatus: 'COMPLETE',
    responsiblePerson: createdUsers['Treasurer']._id,
    reviewedBy: createdUsers['Auditor']._id,
    submissionDate: new Date('2026-10-08'),
    acknowledgementReference: 'GSTN-GSTR7-ACK-881920',
    challanReference: 'CPIN-2610-8849-0128',
    challanAmountPaise: 425000, // ₹ 4,250
    challanDate: new Date('2026-10-07'),
    notes: 'TDS deducted on security agency and lift AMC contractor invoices deposited into GST portal.',
    supportingDocuments: [
      {
        title: 'GSTR-7 Filing Acknowledgment Receipt',
        documentType: 'ACKNOWLEDGEMENT',
        fileName: 'GSTR7_Q2_Ack_Receipt.pdf',
        fileUrl: 'https://docs.society.internal/compliance/gstr7_ack.pdf',
        fileSize: 185000,
        uploadedBy: createdUsers['Treasurer']._id,
      },
      {
        title: 'PMT-06 Payment Challan Receipt',
        documentType: 'CHALLAN',
        fileName: 'PMT06_Challan_4250.pdf',
        fileUrl: 'https://docs.society.internal/compliance/pmt06_challan.pdf',
        fileSize: 120000,
        uploadedBy: createdUsers['Treasurer']._id,
      },
    ],
    statusHistory: [
      {
        fromStatus: 'PENDING',
        toStatus: 'FILED',
        action: 'FORMAL_SUBMISSION',
        changedBy: createdUsers['Treasurer']._id,
        comments: 'Challan paid and GSTR-7 return submitted successfully.',
      },
    ],
  });

  await Compliance.create({
    society: society._id,
    filingType: 'Quarterly TDS Statement (Form 26Q)',
    category: 'TAX_DIRECT',
    statutoryBody: 'Income Tax Department (TRACES)',
    financialPeriod: 'Q2 FY 2026-27 (Jul - Sep)',
    deadline: new Date('2026-10-31'),
    deadlineSource: 'Income Tax Act 1961 Sec 200(3)',
    status: 'UNDER_REVIEW',
    preparationStatus: 'PREPARED',
    reviewStatus: 'UNDER_REVIEW',
    documentationStatus: 'PENDING_VERIFICATION',
    responsiblePerson: createdUsers['Treasurer']._id,
    reviewedBy: createdUsers['Auditor']._id,
    challanReference: 'BSR-0210048-CHALLAN-9921',
    challanAmountPaise: 1850000, // ₹ 18,500
    challanDate: new Date('2026-10-05'),
    notes: 'TDS challan 281 deposited. Annexure draft submitted to auditor Suresh Menon for PAN verification.',
    supportingDocuments: [
      {
        title: 'ITNS-281 Tax Deposit Challan',
        documentType: 'CHALLAN',
        fileName: 'ITNS281_Challan_18500.pdf',
        fileUrl: 'https://docs.society.internal/compliance/itns281_challan.pdf',
        fileSize: 154000,
        uploadedBy: createdUsers['Treasurer']._id,
      },
    ],
    statusHistory: [
      {
        fromStatus: 'PENDING',
        toStatus: 'UNDER_REVIEW',
        action: 'SUBMIT_FOR_REVIEW',
        changedBy: createdUsers['Treasurer']._id,
        comments: 'Draft Form 26Q sent to statutory auditor for pre-filing sign-off.',
      },
    ],
  });

  await Compliance.create({
    society: society._id,
    filingType: 'Fire Safety NOC Bi-annual Renewal',
    category: 'SAFETY_MUNICIPAL',
    statutoryBody: 'Karnataka Fire & Emergency Services',
    financialPeriod: 'Bi-annual Cycle 2026',
    deadline: new Date('2026-10-15'), // Overdue
    deadlineSource: 'Karnataka Fire Safety Act & Building Bye-Laws',
    status: 'OVERDUE',
    preparationStatus: 'REVISION_NEEDED',
    reviewStatus: 'CHANGES_REQUESTED',
    documentationStatus: 'INCOMPLETE',
    responsiblePerson: createdUsers['Committee Member']._id,
    notes: 'Fire pump pressure sensor calibration pending with contractor before inspector site visit.',
    statusHistory: [
      {
        fromStatus: 'PENDING',
        toStatus: 'OVERDUE',
        action: 'OVERDUE_NOTICE',
        changedBy: createdUsers['Society Administrator']._id,
        comments: 'Deadline passed on Oct 15. Urgent rectification required for pump sensor.',
      },
    ],
  });

  await Compliance.create({
    society: society._id,
    filingType: 'Elevator Safety Fitness License Renewal',
    category: 'SAFETY_MUNICIPAL',
    statutoryBody: 'Chief Inspectorate of Lifts & Escalators',
    financialPeriod: 'Annual Inspection 2026',
    deadline: new Date('2026-11-20'), // Upcoming in ~3 weeks
    deadlineSource: 'Karnataka Lifts, Escalators and Passenger Conveyors Act',
    status: 'PENDING',
    preparationStatus: 'IN_PREPARATION',
    reviewStatus: 'NOT_REVIEWED',
    documentationStatus: 'INCOMPLETE',
    responsiblePerson: createdUsers['Committee Member']._id,
    notes: 'Johnson Lifts annual overhaul completed under voucher VR-2026-089. Government inspector site audit scheduled.',
    statusHistory: [
      {
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        action: 'CREATED',
        changedBy: createdUsers['Society Administrator']._id,
        comments: 'Scheduled following Q3 elevator maintenance signoff.',
      },
    ],
  });

  console.log('  ✓ Inserted statutory & tax compliance records');

  console.log('\n======================================================');
  console.log('   SocietyLedger Database Seeding Completed!');
  console.log('======================================================\n');
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await mongoose.disconnect();
      console.log('MongoDB disconnected cleanly after seed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failure:', redactMongoCredentials(err?.message || 'Unknown seed error'));
      process.exit(1);
    });
}
