import mongoose from 'mongoose';
import { Transaction, Fund, AuditLog } from '../models/index.js';
import { maskBankAccount, PUBLISHED_TRANSACTION_STATUSES } from '../utils/maskBankAccount.js';

/**
 * List paginated transactions with multi-criteria filtering
 */
export async function getTransactions(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      type = 'ALL',
      fund = 'ALL',
      status = 'ALL',
      startDate = '',
      endDate = '',
      sortKey = 'date',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const filter = { society: req.societyId };

    if (type && type !== 'ALL') {
      filter.type = type;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    // Residents only receive published ledger vouchers. Drafts, rejections,
    // and other unpublished records stay with the committee and treasurer.
    if (req.user?.role === 'Resident') {
      if (typeof filter.status === 'string') {
        if (!PUBLISHED_TRANSACTION_STATUSES.includes(filter.status)) {
          filter.status = { $in: [] };
        }
      } else {
        filter.status = { $in: PUBLISHED_TRANSACTION_STATUSES };
      }
    }

    if (fund && fund !== 'ALL') {
      // Could be fund ObjectId or fund code/name
      if (mongoose.Types.ObjectId.isValid(fund)) {
        filter.fund = fund;
      } else {
        const foundFund = await Fund.findOne({
          society: req.societyId,
          $or: [{ code: fund }, { name: fund }],
        });
        if (foundFund) {
          filter.fund = foundFund._id;
        }
      }
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { reference: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { vendorName: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { invoiceNumber: { $regex: q, $options: 'i' } },
      ];
    }

    // Determine sort
    const sortField = sortKey === 'amount' ? 'amountPaise' : sortKey || 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortDirection };

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate('fund', 'name code type')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('reconciledBy', 'name email')
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Format for frontend response
    const formatted = transactions.map((t) => ({
      id: t._id,
      _id: t._id,
      reference: t.reference,
      date: t.date ? t.date.toISOString().split('T')[0] : null,
      type: t.type,
      fund: t.fund?.name || 'General Fund',
      fundCode: t.fund?.code || '',
      category: t.category,
      description: t.description,
      amount: t.amountRupees,
      amountPaise: t.amountPaise,
      paymentMethod: t.paymentMethod,
      status: t.status,
      vendorName: t.vendorName,
      invoiceNumber: t.invoiceNumber,
      verifiedBy: t.reconciledBy?.name ? `${t.reconciledBy.name} (Auditor)` : null,
      approvedBy: t.approvedBy?.name ? `${t.approvedBy.name} (Treasurer)` : null,
      reconciliationReference: t.reconciliationReference,
      reversalReason: t.reversalJustification,
      reversalOf: t.reversalOf,
      createdAt: t.createdAt,
    }));

    res.status(200).json({
      success: true,
      message: 'Transactions retrieved successfully.',
      data: {
        transactions: formatted,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single transaction by ID
 */
export async function getTransactionById(req, res, next) {
  try {
    const tx = await Transaction.findOne({
      _id: req.params.id,
      society: req.societyId,
    })
      .populate('fund', 'name code type bankAccount currentBalancePaise')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('reconciledBy', 'name email role')
      .populate('reversalOf', 'reference date amountPaise description');

    if (!tx || (req.user?.role === 'Resident' && !PUBLISHED_TRANSACTION_STATUSES.includes(tx.status))) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.',
        data: null,
        errors: ['Transaction voucher does not exist in your society'],
      });
    }

    const fundDetails = tx.fund?.toObject ? tx.fund.toObject() : tx.fund;
    if (req.user?.role === 'Resident' && fundDetails) {
      fundDetails.bankAccount = maskBankAccount(fundDetails.bankAccount);
    }

    res.status(200).json({
      success: true,
      message: 'Transaction details retrieved.',
      data: {
        id: tx._id,
        _id: tx._id,
        reference: tx.reference,
        date: tx.date ? tx.date.toISOString().split('T')[0] : null,
        type: tx.type,
        fund: tx.fund?.name,
        fundCode: tx.fund?.code,
        fundDetails,
        category: tx.category,
        description: tx.description,
        amount: tx.amountRupees,
        amountPaise: tx.amountPaise,
        paymentMethod: tx.paymentMethod,
        status: tx.status,
        vendorName: tx.vendorName,
        invoiceNumber: tx.invoiceNumber,
        verifiedBy: tx.reconciledBy?.name ? `${tx.reconciledBy.name} (Auditor)` : null,
        approvedBy: tx.approvedBy?.name ? `${tx.approvedBy.name} (Treasurer)` : null,
        reconciliationReference: tx.reconciliationReference,
        reversalReason: tx.reversalJustification,
        reversalOf: tx.reversalOf,
        notes: tx.notes,
        createdAt: tx.createdAt,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Post a new financial voucher
 */
export async function createTransaction(req, res, next) {
  try {
    const {
      reference,
      date,
      type,
      fund: fundIdOrCode,
      fundCode,
      category,
      description,
      amount,
      amountPaise,
      paymentMethod,
      vendorName,
      invoiceNumber,
      transferToFund: targetFundId,
      status: requestedStatus,
      notes,
    } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Transaction type and description are required.',
        data: null,
        errors: ['Missing required transaction fields'],
      });
    }

    // Resolve fund
    let targetFund = null;
    if (fundIdOrCode) {
      if (mongoose.Types.ObjectId.isValid(fundIdOrCode)) {
        targetFund = await Fund.findOne({ _id: fundIdOrCode, society: req.societyId });
      } else {
        targetFund = await Fund.findOne({
          society: req.societyId,
          $or: [{ code: fundIdOrCode }, { name: fundIdOrCode }],
        });
      }
    }
    if (!targetFund && fundCode) {
      targetFund = await Fund.findOne({ society: req.societyId, code: fundCode });
    }

    if (!targetFund) {
      return res.status(400).json({
        success: false,
        message: 'Valid society fund reference is required.',
        data: null,
        errors: ['Fund not found in this society'],
      });
    }

    // Validate amount in integer paise
    let finalAmountPaise = 0;
    if (amountPaise !== undefined) {
      finalAmountPaise = Math.round(Number(amountPaise));
    } else if (amount !== undefined) {
      finalAmountPaise = Math.round(Number(amount) * 100);
    }

    if (isNaN(finalAmountPaise) || finalAmountPaise <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transaction amount must be a positive number.',
        data: null,
        errors: ['Invalid amount'],
      });
    }

    // Generate or validate voucher reference
    const voucherRef =
      reference?.trim().toUpperCase() ||
      `VR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check duplicate reference in this society
    const existingTx = await Transaction.findOne({
      society: req.societyId,
      reference: voucherRef,
    });
    if (existingTx) {
      return res.status(409).json({
        success: false,
        message: `Voucher reference '${voucherRef}' already exists in this society.`,
        data: null,
        errors: ['Duplicate voucher reference'],
      });
    }

    const txStatus = requestedStatus || 'PENDING';

    // Transfer specific validations
    let transferDestFund = null;
    if (type === 'TRANSFER') {
      if (!targetFundId) {
        return res.status(400).json({
          success: false,
          message: 'Destination fund is required for internal transfer operations.',
          data: null,
          errors: ['Missing transfer destination fund'],
        });
      }

      transferDestFund = await Fund.findOne({ _id: targetFundId, society: req.societyId });
      if (!transferDestFund) {
        return res.status(400).json({
          success: false,
          message: 'Destination fund does not exist.',
          data: null,
          errors: ['Destination fund not found'],
        });
      }

      if (targetFund._id.toString() === transferDestFund._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Source and destination funds cannot be the same.',
          data: null,
          errors: ['Identical transfer accounts'],
        });
      }

      if (targetFund.currentBalancePaise < finalAmountPaise) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance in ${targetFund.name}. Available: ₹${targetFund.currentBalanceRupees}, Required: ₹${finalAmountPaise / 100}`,
          data: null,
          errors: ['Insufficient fund balance for transfer'],
        });
      }
    }

    // Expense validation (restricted funds check)
    if (type === 'EXPENSE' && (txStatus === 'APPROVED' || txStatus === 'PAID')) {
      if (targetFund.currentBalancePaise < finalAmountPaise) {
        return res.status(400).json({
          success: false,
          message: `Insufficient fund balance in ${targetFund.name}. Available: ₹${targetFund.currentBalanceRupees}`,
          data: null,
          errors: ['Insufficient balance for expense payment'],
        });
      }
    }

    // Create transaction
    const newTx = await Transaction.create({
      society: req.societyId,
      fund: targetFund._id,
      reference: voucherRef,
      date: date ? new Date(date) : new Date(),
      type,
      category: category ? category.trim() : null,
      description: description.trim(),
      amountPaise: finalAmountPaise,
      paymentMethod: paymentMethod || 'NEFT_RTGS',
      vendorName: vendorName ? vendorName.trim() : null,
      invoiceNumber: invoiceNumber ? invoiceNumber.trim() : null,
      status: txStatus,
      createdBy: req.user._id,
      approvedBy: txStatus === 'APPROVED' || txStatus === 'PAID' ? req.user._id : null,
      approvedAt: txStatus === 'APPROVED' || txStatus === 'PAID' ? new Date() : null,
      transferToFund: transferDestFund ? transferDestFund._id : null,
      notes: notes ? notes.trim() : null,
    });

    // Update balances atomically if transaction is finalized (PAID / APPROVED)
    if (txStatus === 'APPROVED' || txStatus === 'PAID') {
      if (type === 'INCOME') {
        targetFund.currentBalancePaise += finalAmountPaise;
        await targetFund.save();
      } else if (type === 'EXPENSE') {
        targetFund.currentBalancePaise -= finalAmountPaise;
        await targetFund.save();
      } else if (type === 'TRANSFER' && transferDestFund) {
        targetFund.currentBalancePaise -= finalAmountPaise;
        transferDestFund.currentBalancePaise += finalAmountPaise;
        await targetFund.save();
        await transferDestFund.save();
      }
    }

    // Create Audit Log
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'CREATE_VOUCHER',
      entityType: 'TRANSACTION',
      entityId: newTx._id,
      entityRef: newTx.reference,
      details: `Created ${type} voucher ${newTx.reference} of ₹${(finalAmountPaise / 100).toLocaleString('en-IN')} for '${newTx.description}' against ${targetFund.name} (${txStatus})`,
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Financial voucher created successfully.',
      data: {
        id: newTx._id,
        _id: newTx._id,
        reference: newTx.reference,
        date: newTx.date.toISOString().split('T')[0],
        type: newTx.type,
        fund: targetFund.name,
        fundCode: targetFund.code,
        category: newTx.category,
        description: newTx.description,
        amount: newTx.amountRupees,
        amountPaise: newTx.amountPaise,
        paymentMethod: newTx.paymentMethod,
        status: newTx.status,
        vendorName: newTx.vendorName,
        invoiceNumber: newTx.invoiceNumber,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Audited Reversal Workflow: Corrective reversal of a voucher with mandatory justification
 */
export async function reverseTransaction(req, res, next) {
  try {
    const { justification } = req.body;

    if (!justification || justification.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory reversal justification required by society audit rules (minimum 5 characters).',
        data: null,
        errors: ['Justification is required for audited financial reversal'],
      });
    }

    const originalTx = await Transaction.findOne({
      _id: req.params.id,
      society: req.societyId,
    }).populate('fund');

    if (!originalTx) {
      return res.status(404).json({
        success: false,
        message: 'Transaction voucher not found in this society.',
        data: null,
        errors: ['Transaction not found'],
      });
    }

    if (originalTx.status === 'REVERSED') {
      return res.status(400).json({
        success: false,
        message: 'This transaction voucher has already been reversed.',
        data: null,
        errors: ['Voucher is already reversed'],
      });
    }

    const previousState = {
      status: originalTx.status,
      reversalJustification: originalTx.reversalJustification,
    };

    // Revert fund balance changes if the transaction was approved/paid
    const fund = await Fund.findById(originalTx.fund._id || originalTx.fund);
    if (fund && (originalTx.status === 'APPROVED' || originalTx.status === 'PAID' || originalTx.status === 'RECONCILED')) {
      if (originalTx.type === 'INCOME') {
        fund.currentBalancePaise -= originalTx.amountPaise;
        await fund.save();
      } else if (originalTx.type === 'EXPENSE') {
        fund.currentBalancePaise += originalTx.amountPaise;
        await fund.save();
      } else if (originalTx.type === 'TRANSFER' && originalTx.transferToFund) {
        fund.currentBalancePaise += originalTx.amountPaise;
        const destFund = await Fund.findById(originalTx.transferToFund);
        if (destFund) {
          destFund.currentBalancePaise -= originalTx.amountPaise;
          await destFund.save();
        }
        await fund.save();
      }
    }

    // Mark original voucher as REVERSED
    originalTx.status = 'REVERSED';
    originalTx.reversalJustification = justification.trim();
    await originalTx.save();

    // Create counter-balancing offset reversal voucher
    const counterRef = `${originalTx.reference}-REV`;
    const counterTx = await Transaction.create({
      society: req.societyId,
      fund: originalTx.fund,
      reference: counterRef,
      date: new Date(),
      type: originalTx.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
      category: 'Accounting Reversal',
      description: `Reversal offset for ${originalTx.reference}: ${justification.trim()}`,
      amountPaise: originalTx.amountPaise,
      paymentMethod: originalTx.paymentMethod,
      status: 'REVERSED',
      createdBy: req.user._id,
      reversalOf: originalTx._id,
      reversalJustification: justification.trim(),
    });

    // Immutable Audit Log entry
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'REVERSE_TRANSACTION',
      entityType: 'TRANSACTION',
      entityId: originalTx._id,
      entityRef: originalTx.reference,
      details: `Reversed voucher ${originalTx.reference} (Amount: ₹${originalTx.amountRupees}). Reason: ${justification.trim()}. Created counter-entry ${counterRef}.`,
      previousState,
      newState: { status: 'REVERSED', reversalJustification: justification.trim() },
      severity: 'HIGH',
    });

    res.status(200).json({
      success: true,
      message: 'Transaction successfully reversed and counter-voucher posted.',
      data: {
        originalTransaction: originalTx,
        reversalTransaction: counterTx,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
