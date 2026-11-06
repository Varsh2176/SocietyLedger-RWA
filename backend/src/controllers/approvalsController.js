import { Approval, Fund, Transaction, AuditLog } from '../models/index.js';
import { PUBLISHED_EVENT_STATUSES } from '../utils/maskBankAccount.js';

function presentPublishedApproval(approval) {
  const event = approval.relatedEvent;
  const eventIsPublished = event && PUBLISHED_EVENT_STATUSES.includes(event.status);
  return {
    id: approval._id,
    _id: approval._id,
    description: approval.description,
    requestedAmount: approval.requestedAmountRupees,
    requestedAmountPaise: approval.requestedAmountPaise,
    fund: approval.fund?.name || null,
    relatedEvent: eventIsPublished ? event.title : null,
    submissionDate: approval.createdAt ? approval.createdAt.toISOString().split('T')[0] : null,
    status: approval.status,
    summary: approval.notes || approval.description,
    resolutionRef:
      approval.quotationReference ||
      approval.invoiceNumber ||
      `APR-${String(approval._id).slice(-6).toUpperCase()}`,
  };
}

function presentGovernanceApproval(approval) {
  return {
    id: approval._id,
    _id: approval._id,
    description: approval.description,
    requestedAmount: approval.requestedAmountRupees,
    requestedAmountPaise: approval.requestedAmountPaise,
    fund: approval.fund?.name || 'General Account',
    fundCode: approval.fund?.code || '',
    fundDetails: approval.fund && approval.fund.currentBalancePaise != null ? approval.fund : undefined,
    relatedEvent: approval.relatedEvent?.title || null,
    vendorName: approval.vendorName,
    quotationRef: approval.quotationReference,
    invoiceNumber: approval.invoiceNumber,
    requesterName: approval.requester?.name || 'Member',
    requesterEmail: approval.requester?.email || '',
    submissionDate: approval.createdAt ? approval.createdAt.toISOString().split('T')[0] : null,
    status: approval.status,
    notes: approval.notes,
    decisionHistory: (approval.decisionHistory || []).map((decision) => ({
      action: decision.action,
      decidedBy: decision.decidedBy?.name
        ? `${decision.decidedBy.name} (${decision.decidedBy.role || 'Signatory'})`
        : 'Signatory',
      date: decision.decidedAt,
      comments: decision.comments,
    })),
    resultingTransaction: approval.resultingTransaction,
  };
}

/**
 * List expense approvals for society
 */
export async function getApprovals(req, res, next) {
  try {
    const { status, search } = req.query;

    const filter = { society: req.societyId };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    // Residents see approved sanctions only.
    // Auditors are outside the approval workflow: the Approvals screen and the
    // pending-approval summary are limited to Administrator, Treasurer, and
    // Committee Member. Auditors may read approved sanctions for posted
    // decisions, and do not receive pending, rejected, or information requests.
    if (req.user?.role === 'Resident' || req.user?.role === 'Auditor') {
      if (filter.status && filter.status !== 'APPROVED') {
        filter.status = { $in: [] };
      } else {
        filter.status = 'APPROVED';
      }
    }

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { vendorName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const approvals = await Approval.find(filter)
      .populate('fund', 'name code')
      .populate('requester', 'name email role')
      .populate('relatedEvent', 'title status')
      .populate('decisionHistory.decidedBy', 'name role')
      .sort({ createdAt: -1 });

    const residentView = req.user?.role === 'Resident';
    const formatted = approvals.map((approval) =>
      residentView ? presentPublishedApproval(approval) : presentGovernanceApproval(approval)
    );

    res.status(200).json({
      success: true,
      message: 'Approvals retrieved successfully.',
      data: {
        approvals: formatted,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single approval detail
 */
export async function getApprovalById(req, res, next) {
  try {
    const approval = await Approval.findOne({
      _id: req.params.id,
      society: req.societyId,
    })
      .populate('fund', 'name code currentBalancePaise')
      .populate('requester', 'name email role')
      .populate('relatedEvent', 'title status')
      .populate('decisionHistory.decidedBy', 'name role');

    const approvedSanctionsOnly = req.user?.role === 'Resident' || req.user?.role === 'Auditor';
    if (!approval || (approvedSanctionsOnly && approval.status !== 'APPROVED')) {
      return res.status(404).json({
        success: false,
        message: 'Expense approval request not found.',
        data: null,
        errors: ['Approval not found in this society'],
      });
    }

    const residentView = req.user?.role === 'Resident';
    res.status(200).json({
      success: true,
      message: 'Approval details retrieved.',
      data: residentView ? presentPublishedApproval(approval) : presentGovernanceApproval(approval),
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new expense approval request
 */
export async function createApproval(req, res, next) {
  try {
    const {
      description,
      requestedAmount,
      requestedAmountPaise,
      fund: fundIdOrCode,
      relatedEvent,
      vendorName,
      quotationRef,
      invoiceNumber,
      notes,
    } = req.body;

    if (!description || (!requestedAmount && !requestedAmountPaise)) {
      return res.status(400).json({
        success: false,
        message: 'Description and requested amount are required.',
        data: null,
        errors: ['Missing required fields'],
      });
    }

    // Resolve fund
    let fund = null;
    if (fundIdOrCode) {
      fund = await Fund.findOne({
        society: req.societyId,
        $or: [{ _id: fundIdOrCode }, { code: fundIdOrCode }, { name: fundIdOrCode }],
      });
    }
    if (!fund) {
      fund = await Fund.findOne({ society: req.societyId }); // Fallback to first active fund
    }

    if (!fund) {
      return res.status(400).json({
        success: false,
        message: 'A valid society fund is required for expense requests.',
        data: null,
        errors: ['No fund found'],
      });
    }

    let amountPaise = 0;
    if (requestedAmountPaise !== undefined) {
      amountPaise = Math.round(Number(requestedAmountPaise));
    } else if (requestedAmount !== undefined) {
      amountPaise = Math.round(Number(requestedAmount) * 100);
    }

    if (isNaN(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Requested amount must be a positive number.',
        data: null,
        errors: ['Invalid amount'],
      });
    }

    const newApproval = await Approval.create({
      society: req.societyId,
      description: description.trim(),
      requestedAmountPaise: amountPaise,
      fund: fund._id,
      relatedEvent: relatedEvent || null,
      vendorName: vendorName ? vendorName.trim() : null,
      quotationReference: quotationRef ? quotationRef.trim() : null,
      invoiceNumber: invoiceNumber ? invoiceNumber.trim() : null,
      requester: req.user._id,
      status: 'PENDING',
      notes: notes ? notes.trim() : null,
    });

    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'REQUEST_APPROVAL',
      entityType: 'APPROVAL',
      entityId: newApproval._id,
      details: `Submitted expense sanction request: '${newApproval.description}' for ₹${(amountPaise / 100).toLocaleString('en-IN')} from ${fund.name}`,
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Expense approval request submitted.',
      data: newApproval,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Review & decide expense approval (Approve, Reject, Request Info)
 * Strictly enforces Separation of Duties: Requester cannot self-approve!
 */
export async function decideApproval(req, res, next) {
  try {
    const { action, comments } = req.body;

    if (!['APPROVED', 'REJECTED', 'INFO_REQUESTED'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision action. Must be APPROVED, REJECTED, or INFO_REQUESTED.',
        data: null,
        errors: ['Invalid action enum'],
      });
    }

    const approval = await Approval.findOne({
      _id: req.params.id,
      society: req.societyId,
    }).populate('fund');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Expense approval request not found.',
        data: null,
        errors: ['Approval not found'],
      });
    }

    // STRICT SEPARATION OF DUTIES ENFORCEMENT
    const requesterId = (approval.requester._id || approval.requester).toString();
    const currentUserId = req.user._id.toString();

    if (requesterId === currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Separation-of-Duties Violation: Requesters are strictly prohibited from self-approving their own expense requests.',
        data: null,
        errors: ['Self-approval violation'],
      });
    }

    // Record decision in history
    approval.decisionHistory.unshift({
      decidedBy: req.user._id,
      action,
      comments: comments ? comments.trim() : `Decision: ${action}`,
      decidedAt: new Date(),
    });

    approval.status = action;

    // If APPROVED: automatically create financial transaction voucher & deduct fund
    let createdTx = null;
    if (action === 'APPROVED') {
      const fund = await Fund.findById(approval.fund._id || approval.fund);
      if (fund) {
        // Overdraft prevention
        if (fund.currentBalancePaise < approval.requestedAmountPaise) {
          return res.status(400).json({
            success: false,
            message: `Insufficient fund balance in ${fund.name}. Available: ₹${fund.currentBalanceRupees}, Required: ₹${approval.requestedAmountRupees}`,
            data: null,
            errors: ['Insufficient fund balance to disburse approval'],
          });
        }

        const voucherRef = `VR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        createdTx = await Transaction.create({
          society: req.societyId,
          fund: fund._id,
          reference: voucherRef,
          date: new Date(),
          type: 'EXPENSE',
          category: 'Approved Expenditure',
          description: approval.description,
          amountPaise: approval.requestedAmountPaise,
          paymentMethod: 'NEFT_RTGS',
          vendorName: approval.vendorName,
          invoiceNumber: approval.invoiceNumber,
          status: 'APPROVED',
          createdBy: approval.requester,
          approvedBy: req.user._id,
          approvedAt: new Date(),
          notes: `Sanctioned via Expense Approval #${approval._id}`,
        });

        // Deduct fund balance
        fund.currentBalancePaise -= approval.requestedAmountPaise;
        await fund.save();

        approval.resultingTransaction = createdTx._id;
      }
    }

    await approval.save();

    // Audit log
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: action === 'APPROVED' ? 'APPROVE_EXPENSE' : action === 'REJECTED' ? 'REJECT_EXPENSE' : 'REQUEST_INFO',
      entityType: 'APPROVAL',
      entityId: approval._id,
      details: `${action} expense '${approval.description}' (Amount: ₹${approval.requestedAmountRupees}). Comments: ${comments || 'None'}`,
      severity: action === 'APPROVED' ? 'MEDIUM' : 'INFO',
    });

    res.status(200).json({
      success: true,
      message: `Expense request marked as ${action}.`,
      data: {
        approval,
        resultingTransaction: createdTx,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
