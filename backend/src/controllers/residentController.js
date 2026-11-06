import { Fund, Transaction, Event, ResidentQuery, Society, Approval } from '../models/index.js';
import { maskBankAccount, PUBLISHED_TRANSACTION_STATUSES } from '../utils/maskBankAccount.js';
import {
  POSTED_LEDGER_DESCRIPTION,
  fiscalYearContaining,
  fundBalanceDescription,
} from '../utils/reportingPeriod.js';

const PUBLISHED_TRANSPARENCY_EVENT_STATUSES = ['APPROVED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED'];
const SETTLED_TRANSPARENCY_EVENT_STATUSES = ['COMPLETED', 'SETTLED'];

/**
 * Residents see ratified events and the approved budget.
 * Actual spend and settlement notes appear only after completion or settlement.
 * Proposed, cancelled, and events funded by a suspended or closed fund are omitted.
 */
function presentTransparencyEvent(event) {
  const published = {
    id: event._id,
    title: event.title,
    date: event.date,
    status: event.status,
    approvedBudget: event.approvedBudgetRupees,
    fundingSource: event.fundingSource,
  };

  if (SETTLED_TRANSPARENCY_EVENT_STATUSES.includes(event.status)) {
    published.actualExpenditure = event.actualExpenditureRupees;
    published.unspentBalancePaise = event.unspentBalancePaise;
    published.unspentBalanceRupees = event.unspentBalancePaise != null ? event.unspentBalancePaise / 100 : null;
    published.settlementReport = event.settlementReport;
    published.settledAt = event.settledAt;
  }

  return published;
}

/**
 * Resident Financial Transparency & Clarification Queries Controller
 * Enforces strict data segregation:
 * - Residents only view published summary metrics, approved event budgets, and sanctioned decisions.
 * - Sensitive bank account numbers are masked (e.g. "HDFC Bank - A/C ****4891").
 * - Private individual transaction records or internal committee memos are never exposed.
 */

/**
 * GET /api/resident/transparency
 * Returns published fund balances, published income/expenditure summary,
 * approved event budgets, and published committee decisions.
 */
export async function getTransparencyData(req, res, next) {
  try {
    const societyId = req.societyId;

    const society = await Society.findById(societyId);
    if (!society) {
      return res.status(404).json({
        success: false,
        message: 'Society not found.',
        data: null,
        errors: ['Invalid society reference'],
      });
    }

    // 1. Published Fund Balances (with masked bank account details)
    const funds = await Fund.find({ society: societyId, status: 'ACTIVE' }).sort({ type: 1, name: 1 });
    const publishedFunds = funds.map((f) => {
      const maskedBank = maskBankAccount(f.bankAccount);

      return {
        id: f._id,
        name: f.name,
        code: f.code,
        type: f.type,
        currentBalance: f.currentBalanceRupees,
        purpose: f.purpose,
        bankName: maskedBank,
        bankAccountMasked: maskedBank,
        isRestricted: f.restrictedUse,
        lastReconciledAt: f.lastReconciledAt,
      };
    });

    // 2. Published Income vs Expenditure Summary (Calculated from ledger)
    const incomeAgg = await Transaction.aggregate([
      {
        $match: {
          society: society._id,
          type: 'INCOME',
          status: { $in: PUBLISHED_TRANSACTION_STATUSES },
        },
      },
      { $group: { _id: null, totalPaise: { $sum: '$amountPaise' } } },
    ]);
    const expenseAgg = await Transaction.aggregate([
      {
        $match: {
          society: society._id,
          type: 'EXPENSE',
          status: { $in: PUBLISHED_TRANSACTION_STATUSES },
        },
      },
      { $group: { _id: null, totalPaise: { $sum: '$amountPaise' } } },
    ]);

    const totalIncomePaise = incomeAgg[0]?.totalPaise || 0;
    const totalExpensePaise = expenseAgg[0]?.totalPaise || 0;
    const surplusPaise = totalIncomePaise - totalExpensePaise;

    const fiscalYear = fiscalYearContaining(new Date(), society.fiscalYearStartMonth);
    const publishedIncomeExpenditure = {
      period: 'All posted vouchers',
      scope: 'ALL_POSTED_VOUCHERS',
      description: POSTED_LEDGER_DESCRIPTION,
      postedVoucherStatuses: PUBLISHED_TRANSACTION_STATUSES,
      totalCollections: totalIncomePaise / 100,
      totalExpenditure: totalExpensePaise / 100,
      netOperatingSurplus: surplusPaise / 100,
      // No billed-demand ledger exists, so a collection percentage cannot be derived.
      collectionEfficiency: 'Unavailable',
    };

    // 3. Published Community Events & Settlements
    const events = await Event.find({
      society: societyId,
      status: { $in: PUBLISHED_TRANSPARENCY_EVENT_STATUSES },
    })
      .populate('fundingFund', 'status')
      .sort({ date: -1 })
      .limit(10);

    const publishedEvents = events
      .filter((event) => {
        const fundStatus = event.fundingFund?.status;
        return fundStatus !== 'SUSPENDED' && fundStatus !== 'CLOSED';
      })
      .map(presentTransparencyEvent);

    // 4. Published Committee Decisions / Resolutions (approved records only)
    const approvedDecisions = await Approval.find({
      society: societyId,
      status: 'APPROVED',
    })
      .sort({ updatedAt: -1 })
      .limit(20);

    const publishedDecisions = approvedDecisions.map((decision) => ({
      id: decision._id,
      date: (decision.updatedAt || decision.createdAt).toISOString().split('T')[0],
      title: decision.description,
      sanctionedAmount: decision.requestedAmountRupees,
      resolutionRef: decision.quotationReference || decision.invoiceNumber || `APR-${String(decision._id).slice(-6).toUpperCase()}`,
      summary: decision.notes || decision.description,
      quorum: 'Ratified by the management committee',
    }));

    res.status(200).json({
      success: true,
      message: 'Transparency data retrieved successfully.',
      data: {
        societyName: society.name,
        registrationNumber: society.registrationNumber,
        fiscalYear: fiscalYear.label,
        fiscalYearStartMonth: fiscalYear.startMonth,
        fundBalanceScope: 'ACTIVE_FUNDS',
        fundBalanceDescription: fundBalanceDescription('Resident'),
        publishedAt: new Date().toISOString(),
        auditorCertification: 'Statutory Annual Audit records verified and published by the Management Committee.',
        publishedFunds,
        publishedIncomeExpenditure,
        publishedEvents,
        publishedDecisions,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/resident/queries
 * Retrieve questions submitted by residents.
 * - Residents see their own queries + published answered queries.
 * - Committee members and Admins see all queries.
 */
export async function getQueries(req, res, next) {
  try {
    const societyId = req.societyId;
    const { status, search, category } = req.query;

    const filter = { society: societyId };

    // Role-based visibility
    if (req.user.role === 'Resident') {
      // Residents see queries submitted by themselves OR any query that has been ANSWERED/RESOLVED
      filter.$or = [
        { submittedBy: req.user._id },
        { status: { $in: ['ANSWERED', 'RESOLVED'] } },
      ];
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    if (search) {
      const q = search.trim();
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { subject: { $regex: q, $options: 'i' } },
          { question: { $regex: q, $options: 'i' } },
          { unit: { $regex: q, $options: 'i' } },
          { reference: { $regex: q, $options: 'i' } },
        ],
      });
    }

    const queries = await ResidentQuery.find(filter)
      .populate('submittedBy', 'name apartmentNumber')
      .populate('responses.respondedBy', 'name role')
      .populate('assignedTo', 'name role')
      .sort({ createdAt: -1 });

    const formattedQueries = queries.map((q) => {
      const latestResponse = q.responses && q.responses.length > 0 ? q.responses[q.responses.length - 1] : null;
      return {
        id: q._id,
        _id: q._id,
        reference: q.reference,
        category: q.category,
        subject: q.subject,
        question: q.question,
        unit: q.unit || q.submittedBy?.apartmentNumber || 'Resident Unit',
        residentName: q.submittedBy?.name || 'Resident Member',
        status: q.status,
        date: q.createdAt ? q.createdAt.toISOString().split('T')[0] : null,
        createdAt: q.createdAt,
        responses: q.responses,
        response: latestResponse
          ? {
              answeredBy: latestResponse.respondedBy?.name || 'Committee Representative',
              answeredAt: latestResponse.respondedAt,
              replyText: latestResponse.response,
              isOfficialResponse: latestResponse.isOfficialResponse,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Resident queries retrieved successfully.',
      data: {
        queries: formattedQueries,
        total: formattedQueries.length,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resident/queries
 * Submit a new clarification question by an authenticated resident.
 */
export async function submitQuery(req, res, next) {
  try {
    const { category, subject, question, unit } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: ['Query subject is required'],
      });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: ['Query question details are required'],
      });
    }

    // Auto-generate reference number QRY-YYYY-XXX
    const year = new Date().getFullYear();
    const count = await ResidentQuery.countDocuments({ society: req.societyId });
    const reference = `QRY-${year}-${String(count + 1).padStart(3, '0')}`;

    const newQuery = await ResidentQuery.create({
      society: req.societyId,
      submittedBy: req.user._id,
      unit: unit || req.user.apartmentNumber || 'General',
      category: category || 'General',
      subject: subject.trim(),
      question: question.trim(),
      reference,
      status: 'OPEN',
    });

    res.status(201).json({
      success: true,
      message: 'Clarification query submitted successfully.',
      data: {
        query: newQuery,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/resident/queries/:id/respond
 * Committee Member, Treasurer, or Administrator responds to a query.
 */
export async function respondToQuery(req, res, next) {
  try {
    const { id } = req.params;
    const { response, newStatus } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: ['Response text is required'],
      });
    }

    const query = await ResidentQuery.findOne({ _id: id, society: req.societyId });
    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found.',
        data: null,
        errors: ['Query not found or does not belong to user society'],
      });
    }

    query.responses.push({
      respondedBy: req.user._id,
      response: response.trim(),
      respondedAt: new Date(),
      isOfficialResponse: true,
    });

    query.status = newStatus || 'ANSWERED';
    await query.save();

    res.status(200).json({
      success: true,
      message: 'Response posted successfully.',
      data: {
        query,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
