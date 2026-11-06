import { Fund, AuditLog, Society } from '../models/index.js';
import { maskBankAccount } from '../utils/maskBankAccount.js';
import { fiscalYearContaining } from '../utils/reportingPeriod.js';

/**
 * List all funds for user's society
 */
export async function getFunds(req, res, next) {
  try {
    const { search, type } = req.query;

    const query = { society: req.societyId };
    if (req.user?.role === 'Resident') query.status = 'ACTIVE';

    if (type && type !== 'ALL') {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
      ];
    }

    const funds = await Fund.find(query).sort({ type: 1, name: 1 });

    // Map to include both rupees and paise for client convenience
    const formattedFunds = funds.map((f) => ({
      id: f._id,
      _id: f._id,
      name: f.name,
      code: f.code,
      type: f.type,
      openingBalance: f.openingBalanceRupees,
      currentBalance: f.currentBalanceRupees,
      openingBalancePaise: f.openingBalancePaise,
      currentBalancePaise: f.currentBalancePaise,
      restrictedUse: f.restrictedUse,
      purpose: f.purpose,
      fiscalYear: f.fiscalYear,
      bankAccount: req.user?.role === 'Resident' ? maskBankAccount(f.bankAccount) : f.bankAccount,
      status: f.status,
      lastReconciledAt: f.lastReconciledAt,
      createdAt: f.createdAt,
    }));

    res.status(200).json({
      success: true,
      message: 'Funds retrieved successfully.',
      data: {
        funds: formattedFunds,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get fund by ID
 */
export async function getFundById(req, res, next) {
  try {
    const fund = await Fund.findOne({
      _id: req.params.id,
      society: req.societyId,
    });

    if (!fund || (req.user?.role === 'Resident' && fund.status !== 'ACTIVE')) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found.',
        data: null,
        errors: ['Fund with specified ID does not exist in your society'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Fund details retrieved.',
      data: {
        id: fund._id,
        _id: fund._id,
        name: fund.name,
        code: fund.code,
        type: fund.type,
        openingBalance: fund.openingBalanceRupees,
        currentBalance: fund.currentBalanceRupees,
        openingBalancePaise: fund.openingBalancePaise,
        currentBalancePaise: fund.currentBalancePaise,
        restrictedUse: fund.restrictedUse,
        purpose: fund.purpose,
        fiscalYear: fund.fiscalYear,
        bankAccount: req.user?.role === 'Resident' ? maskBankAccount(fund.bankAccount) : fund.bankAccount,
        status: fund.status,
        lastReconciledAt: fund.lastReconciledAt,
        createdAt: fund.createdAt,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new fund (Treasurer / Society Administrator)
 */
export async function createFund(req, res, next) {
  try {
    const {
      name,
      code,
      type,
      openingBalance,
      openingBalancePaise,
      restrictedUse,
      purpose,
      bankAccount,
    } = req.body;

    if (!name || !code || !type) {
      return res.status(400).json({
        success: false,
        message: 'Fund name, code, and type are required.',
        data: null,
        errors: ['Missing required fields'],
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Check duplicate code in this society
    const existing = await Fund.findOne({
      society: req.societyId,
      code: normalizedCode,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A fund with code '${normalizedCode}' already exists in this society.`,
        data: null,
        errors: ['Duplicate fund code'],
      });
    }

    // Convert opening balance to integer paise
    let balancePaise = 0;
    if (openingBalancePaise !== undefined) {
      balancePaise = Math.round(Number(openingBalancePaise));
    } else if (openingBalance !== undefined) {
      balancePaise = Math.round(Number(openingBalance) * 100);
    }

    if (isNaN(balancePaise) || balancePaise < 0) {
      return res.status(400).json({
        success: false,
        message: 'Opening balance must be a non-negative number.',
        data: null,
        errors: ['Invalid balance amount'],
      });
    }

    const society = await Society.findById(req.societyId).select('fiscalYearStartMonth');
    const derivedFiscalYear = fiscalYearContaining(new Date(), society?.fiscalYearStartMonth).label;

    const newFund = await Fund.create({
      society: req.societyId,
      name: name.trim(),
      code: normalizedCode,
      type,
      openingBalancePaise: balancePaise,
      currentBalancePaise: balancePaise,
      restrictedUse: Boolean(restrictedUse),
      purpose: purpose ? purpose.trim() : null,
      // A client-supplied fiscalYear is ignored. The label comes from the society.
      fiscalYear: derivedFiscalYear,
      bankAccount: bankAccount ? bankAccount.trim() : null,
      createdBy: req.user._id,
      status: 'ACTIVE',
    });

    // Record audit log
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'CREATE_FUND',
      entityType: 'FUND',
      entityId: newFund._id,
      entityRef: newFund.code,
      details: `Created fund '${newFund.name}' (${newFund.type}) with opening reserve ₹${(balancePaise / 100).toLocaleString('en-IN')}`,
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Fund created successfully.',
      data: {
        id: newFund._id,
        _id: newFund._id,
        name: newFund.name,
        code: newFund.code,
        type: newFund.type,
        openingBalance: newFund.openingBalanceRupees,
        currentBalance: newFund.currentBalanceRupees,
        openingBalancePaise: newFund.openingBalancePaise,
        currentBalancePaise: newFund.currentBalancePaise,
        restrictedUse: newFund.restrictedUse,
        purpose: newFund.purpose,
        fiscalYear: newFund.fiscalYear,
        bankAccount: newFund.bankAccount,
        status: newFund.status,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update fund details
 */
export async function updateFund(req, res, next) {
  try {
    const { name, restrictedUse, purpose, bankAccount, status } = req.body;

    const fund = await Fund.findOne({
      _id: req.params.id,
      society: req.societyId,
    });

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found.',
        data: null,
        errors: ['Fund not found in this society'],
      });
    }

    if (name) fund.name = name.trim();
    if (restrictedUse !== undefined) fund.restrictedUse = Boolean(restrictedUse);
    if (purpose !== undefined) fund.purpose = purpose ? purpose.trim() : null;
    if (bankAccount !== undefined) fund.bankAccount = bankAccount ? bankAccount.trim() : null;
    if (status) fund.status = status;

    await fund.save();

    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'UPDATE_FUND',
      entityType: 'FUND',
      entityId: fund._id,
      entityRef: fund.code,
      details: `Updated metadata for fund '${fund.name}'`,
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: 'Fund updated successfully.',
      data: fund,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
