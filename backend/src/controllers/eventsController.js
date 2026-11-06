import { Event, Fund, AuditLog } from '../models/index.js';
import { PUBLISHED_EVENT_STATUSES } from '../utils/maskBankAccount.js';

const RESIDENT_ACTUAL_STATUSES = new Set(['COMPLETED', 'SETTLED']);

function hiddenFromResident(event) {
  const fundStatus = event.fundingFund?.status;
  return fundStatus === 'SUSPENDED' || fundStatus === 'CLOSED';
}

/**
 * Actual spending is returned only for completed or settled events.
 * Approved and in-progress events keep the approved budget and omit spend.
 * This applies to every role. No documented requirement shows in-progress
 * spend to governance users.
 */
function settledEventAmounts(event) {
  if (!RESIDENT_ACTUAL_STATUSES.has(event.status)) {
    return {};
  }
  const amounts = {};
  if (event.actualExpenditureRupees != null) amounts.actualExpenditure = event.actualExpenditureRupees;
  if (event.unspentBalancePaise != null) amounts.unspentBalance = event.unspentBalancePaise / 100;
  if (event.settlementReport) amounts.settlementNotes = event.settlementReport;
  if (event.settledAt) amounts.settledAt = event.settledAt;
  return amounts;
}

/**
 * List events for society
 */
export async function getEvents(req, res, next) {
  try {
    const { status, search } = req.query;

    const filter = { society: req.societyId };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    // Residents see ratified community events only, not proposed or cancelled drafts.
    if (req.user?.role === 'Resident') {
      if (typeof filter.status === 'string') {
        if (!PUBLISHED_EVENT_STATUSES.includes(filter.status)) {
          filter.status = { $in: [] };
        }
      } else {
        filter.status = { $in: PUBLISHED_EVENT_STATUSES };
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { fundingSource: { $regex: search, $options: 'i' } },
      ];
    }

    const events = await Event.find(filter)
      .populate('proposedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('fundingFund', 'name code status')
      .sort({ date: -1 });

    const residentView = req.user?.role === 'Resident';
    const visibleEvents = residentView ? events.filter((event) => !hiddenFromResident(event)) : events;

    const formatted = visibleEvents.map((e) => ({
      id: e._id,
      _id: e._id,
      title: e.title,
      description: e.description,
      date: e.date ? e.date.toISOString().split('T')[0] : null,
      endDate: e.endDate ? e.endDate.toISOString().split('T')[0] : null,
      status: e.status,
      proposedBudget: e.proposedBudgetRupees,
      approvedBudget: e.approvedBudgetRupees,
      ...settledEventAmounts(e),
      fundingSource: e.fundingSource,
      proposedBy: e.proposedBy?.name || 'Resident Member',
      approvedBy: e.approvalResolution || (e.approvedBy?.name ? `Approved by ${e.approvedBy.name}` : null),
      selectedVendor: e.quotations?.find((q) => q._id.toString() === e.selectedVendor?.toString()) || null,
      quotations: e.quotations.map((q) => ({
        id: q._id,
        _id: q._id,
        name: q.name,
        bidAmount: q.bidAmountPaise / 100,
        bidAmountPaise: q.bidAmountPaise,
        quotationRef: q.quotationReference,
        status: q.status,
        isContractSigned: q.isContractSigned,
      })),
      budgetBreakdown: e.budgetBreakdown.map((b) => {
        const row = {
          head: b.head,
          proposed: b.proposedAmountPaise / 100,
          approved: b.approvedAmountPaise != null ? b.approvedAmountPaise / 100 : null,
        };
        if (RESIDENT_ACTUAL_STATUSES.has(e.status) && b.actualAmountPaise != null) {
          row.actual = b.actualAmountPaise / 100;
        }
        return row;
      }),
    }));

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully.',
      data: {
        events: formatted,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single event details
 */
export async function getEventById(req, res, next) {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      society: req.societyId,
    })
      .populate('proposedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('fundingFund', 'name code status');

    const residentView = req.user?.role === 'Resident';
    if (
      !event
      || (residentView && (!PUBLISHED_EVENT_STATUSES.includes(event.status) || hiddenFromResident(event)))
    ) {
      return res.status(404).json({
        success: false,
        message: 'Event not found in this society.',
        data: null,
        errors: ['Event not found'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Event details retrieved.',
      data: {
        id: event._id,
        _id: event._id,
        title: event.title,
        description: event.description,
        date: event.date ? event.date.toISOString().split('T')[0] : null,
        endDate: event.endDate ? event.endDate.toISOString().split('T')[0] : null,
        status: event.status,
        proposedBudget: event.proposedBudgetRupees,
        approvedBudget: event.approvedBudgetRupees,
        ...settledEventAmounts(event),
        fundingSource: event.fundingSource,
        proposedBy: event.proposedBy?.name,
        approvedBy: event.approvalResolution || event.approvedBy?.name,
        selectedVendor: event.quotations?.find((q) => q._id.toString() === event.selectedVendor?.toString()) || null,
        quotations: event.quotations,
        budgetBreakdown: event.budgetBreakdown,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Propose a new community event
 */
export async function createEvent(req, res, next) {
  try {
    const {
      title,
      description,
      date,
      endDate,
      proposedBudget,
      proposedBudgetPaise,
      fundingSource,
      budgetBreakdown,
      quotations,
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: 'Event title and date are required.',
        data: null,
        errors: ['Missing required fields'],
      });
    }

    let budgetPaise = 0;
    if (proposedBudgetPaise !== undefined) {
      budgetPaise = Math.round(Number(proposedBudgetPaise));
    } else if (proposedBudget !== undefined) {
      budgetPaise = Math.round(Number(proposedBudget) * 100);
    }

    if (isNaN(budgetPaise) || budgetPaise < 0) {
      return res.status(400).json({
        success: false,
        message: 'Proposed budget must be a positive amount.',
        data: null,
        errors: ['Invalid proposed budget'],
      });
    }

    // Process budget breakdown
    const formattedBreakdown = (budgetBreakdown || []).map((b) => ({
      head: b.head,
      proposedAmountPaise: b.proposed ? Math.round(Number(b.proposed) * 100) : 0,
      approvedAmountPaise: null,
      actualAmountPaise: 0,
    }));

    // Process quotations if provided
    const formattedQuotations = (quotations || []).map((q) => ({
      name: q.name,
      quotationReference: q.quotationRef || q.quotationReference,
      bidAmountPaise: q.bidAmount ? Math.round(Number(q.bidAmount) * 100) : 0,
      status: 'PENDING',
    }));

    const newEvent = await Event.create({
      society: req.societyId,
      title: title.trim(),
      description: description ? description.trim() : null,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      status: 'PROPOSED',
      proposedBudgetPaise: budgetPaise,
      fundingSource: fundingSource ? fundingSource.trim() : 'Operational Surplus',
      proposedBy: req.user._id,
      budgetBreakdown: formattedBreakdown,
      quotations: formattedQuotations,
    });

    // Audit log
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'PROPOSE_EVENT',
      entityType: 'EVENT',
      entityId: newEvent._id,
      entityRef: newEvent.title,
      details: `Proposed event '${newEvent.title}' scheduled for ${date} with budget ₹${(budgetPaise / 100).toLocaleString('en-IN')}`,
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Event proposed successfully.',
      data: newEvent,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve event budget by Committee / Treasurer / Admin
 */
export async function approveEvent(req, res, next) {
  try {
    const { approvedBudget, approvedBudgetPaise, resolution } = req.body;

    const event = await Event.findOne({
      _id: req.params.id,
      society: req.societyId,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
        data: null,
        errors: ['Event not found in this society'],
      });
    }

    let sanctionedPaise = event.proposedBudgetPaise;
    if (approvedBudgetPaise !== undefined) {
      sanctionedPaise = Math.round(Number(approvedBudgetPaise));
    } else if (approvedBudget !== undefined) {
      sanctionedPaise = Math.round(Number(approvedBudget) * 100);
    }

    event.status = 'APPROVED';
    event.approvedBudgetPaise = sanctionedPaise;
    event.approvedBy = req.user._id;
    event.approvedAt = new Date();
    event.approvalResolution = resolution ? resolution.trim() : `Approved by ${req.user.name} (${req.user.role})`;

    await event.save();

    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'APPROVE_EVENT',
      entityType: 'EVENT',
      entityId: event._id,
      entityRef: event.title,
      details: `Sanctioned event '${event.title}' with approved budget ₹${(sanctionedPaise / 100).toLocaleString('en-IN')}. Resolution: ${event.approvalResolution}`,
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: 'Event budget sanctioned and approved.',
      data: event,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add vendor quotation for competitive comparison
 */
export async function addQuotation(req, res, next) {
  try {
    const { name, quotationRef, bidAmount, notes } = req.body;

    if (!name || !bidAmount) {
      return res.status(400).json({
        success: false,
        message: 'Vendor name and bid amount are required.',
        data: null,
        errors: ['Missing required quotation fields'],
      });
    }

    const event = await Event.findOne({
      _id: req.params.id,
      society: req.societyId,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
        data: null,
        errors: ['Event not found'],
      });
    }

    const bidPaise = Math.round(Number(bidAmount) * 100);

    event.quotations.push({
      name: name.trim(),
      quotationReference: quotationRef ? quotationRef.trim() : null,
      bidAmountPaise: bidPaise,
      status: 'PENDING',
      notes: notes ? notes.trim() : null,
    });

    await event.save();

    res.status(201).json({
      success: true,
      message: 'Vendor quotation submitted for comparison.',
      data: event.quotations,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Select preferred vendor bid from quotations
 */
export async function selectVendor(req, res, next) {
  try {
    const { quotationId } = req.body;

    const event = await Event.findOne({
      _id: req.params.id,
      society: req.societyId,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
        data: null,
        errors: ['Event not found'],
      });
    }

    let found = false;
    for (const q of event.quotations) {
      if (q._id.toString() === quotationId) {
        q.status = 'SELECTED';
        q.isContractSigned = true;
        event.selectedVendor = q._id;
        found = true;
      } else {
        q.status = 'REJECTED';
      }
    }

    if (!found) {
      return res.status(404).json({
        success: false,
        message: 'Specified quotation was not found on this event.',
        data: null,
        errors: ['Quotation not found'],
      });
    }

    await event.save();

    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'SELECT_VENDOR',
      entityType: 'EVENT',
      entityId: event._id,
      entityRef: event.title,
      details: `Selected vendor quotation ${quotationId} for event '${event.title}'`,
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: 'Vendor selected for event contract.',
      data: event,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Settle event and calculate unspent balance refund
 */
export async function settleEvent(req, res, next) {
  try {
    const { actualExpenditure, actualExpenditurePaise, settlementNotes } = req.body;

    const event = await Event.findOne({
      _id: req.params.id,
      society: req.societyId,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
        data: null,
        errors: ['Event not found'],
      });
    }

    let actualPaise = 0;
    if (actualExpenditurePaise !== undefined) {
      actualPaise = Math.round(Number(actualExpenditurePaise));
    } else if (actualExpenditure !== undefined) {
      actualPaise = Math.round(Number(actualExpenditure) * 100);
    }

    event.status = 'SETTLED';
    event.actualExpenditurePaise = actualPaise;
    event.settlementReport = settlementNotes ? settlementNotes.trim() : 'Event settlement finalized.';
    event.settledAt = new Date();

    await event.save();

    const unspentPaise = (event.approvedBudgetPaise || 0) - actualPaise;

    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'SETTLE_EVENT',
      entityType: 'EVENT',
      entityId: event._id,
      entityRef: event.title,
      details: `Settled event '${event.title}': Actual Exp: ₹${(actualPaise / 100).toLocaleString('en-IN')}, Unspent Balance: ₹${(unspentPaise / 100).toLocaleString('en-IN')}`,
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: 'Event settlement finalized and recorded.',
      data: {
        event,
        unspentBalanceRupees: unspentPaise / 100,
        unspentBalancePaise: unspentPaise,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
