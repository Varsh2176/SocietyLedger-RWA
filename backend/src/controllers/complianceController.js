import {
  Compliance,
  COMPLIANCE_STATUSES,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_DISCLAIMER,
  Society,
  AuditLog,
} from '../models/index.js';

/**
 * Compliance & Filing Governance Controller
 * Enforces strict audit trails, date validation, and separation of drafts from filed returns.
 */

/**
 * GET /api/compliance/dashboard
 * Aggregated compliance metrics, upcoming deadlines, overdue tasks, and disclaimer.
 */
export async function getComplianceDashboard(req, res, next) {
  try {
    const societyId = req.societyId;
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const allTasks = await Compliance.find({ society: societyId })
      .populate('responsiblePerson', 'name email apartmentNumber')
      .populate('reviewedBy', 'name email role')
      .sort({ deadline: 1 });

    const totalTasks = allTasks.length;
    let completedCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let pendingReviewsCount = 0;
    let incompleteDocsCount = 0;
    let correctionRequiredCount = 0;

    const upcomingTasks = [];
    const overdueTasks = [];
    const pendingReviewTasks = [];

    allTasks.forEach((task) => {
      const isFiled = ['FILED', 'REVISED_FILED'].includes(task.status);
      const isPastDeadline = task.deadline && new Date(task.deadline) < now;

      if (isFiled) {
        completedCount++;
      } else {
        if (isPastDeadline) {
          overdueCount++;
          overdueTasks.push(task);
        } else if (task.deadline && new Date(task.deadline) <= thirtyDaysFromNow) {
          upcomingCount++;
          upcomingTasks.push(task);
        }

        if (task.reviewStatus === 'UNDER_REVIEW' || task.status === 'UNDER_REVIEW') {
          pendingReviewsCount++;
          pendingReviewTasks.push(task);
        }

        if (task.documentationStatus === 'INCOMPLETE') {
          incompleteDocsCount++;
        }

        if (task.status === 'CORRECTION_REQUIRED' || task.preparationStatus === 'REVISION_NEEDED') {
          correctionRequiredCount++;
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Compliance dashboard metrics retrieved successfully.',
      data: {
        disclaimer: COMPLIANCE_DISCLAIMER,
        summary: {
          totalTasks,
          completedCount,
          overdueCount,
          upcomingCount,
          pendingReviewsCount,
          incompleteDocsCount,
          correctionRequiredCount,
        },
        upcomingDeadlines: upcomingTasks.slice(0, 5),
        overdueTasks: overdueTasks.slice(0, 5),
        pendingReviews: pendingReviewTasks.slice(0, 5),
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/compliance
 * Search, filter, and paginate compliance tasks.
 */
export async function getComplianceTasks(req, res, next) {
  try {
    const societyId = req.societyId;
    const {
      status,
      category,
      period,
      overdue,
      search,
      page = 1,
      limit = 20,
      sortBy = 'deadline',
      sortOrder = 'asc',
    } = req.query;

    const filter = { society: societyId };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    if (period && period !== 'ALL') {
      filter.financialPeriod = period;
    }

    if (overdue === 'true') {
      filter.deadline = { $lt: new Date() };
      filter.status = { $nin: ['FILED', 'REVISED_FILED'] };
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { filingType: { $regex: q, $options: 'i' } },
        { statutoryBody: { $regex: q, $options: 'i' } },
        { financialPeriod: { $regex: q, $options: 'i' } },
        { acknowledgementReference: { $regex: q, $options: 'i' } },
        { challanReference: { $regex: q, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const total = await Compliance.countDocuments(filter);
    const tasks = await Compliance.find(filter)
      .populate('responsiblePerson', 'name email apartmentNumber role')
      .populate('reviewedBy', 'name email role')
      .sort({ [sortBy]: sortDirection })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      message: 'Compliance tasks retrieved successfully.',
      data: {
        disclaimer: COMPLIANCE_DISCLAIMER,
        tasks,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/compliance/:id
 * Retrieve single compliance task by ID.
 */
export async function getComplianceTaskById(req, res, next) {
  try {
    const { id } = req.params;
    const task = await Compliance.findOne({ _id: id, society: req.societyId })
      .populate('responsiblePerson', 'name email apartmentNumber role phone')
      .populate('reviewedBy', 'name email role')
      .populate('statusHistory.changedBy', 'name email role')
      .populate('supportingDocuments.uploadedBy', 'name email role');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Compliance task not found.',
        data: null,
        errors: ['Task not found or does not belong to user society'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Compliance task retrieved successfully.',
      data: {
        task,
        disclaimer: COMPLIANCE_DISCLAIMER,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/compliance
 * Create a new compliance task with verified deadline and source.
 */
export async function createComplianceTask(req, res, next) {
  try {
    const {
      filingType,
      statutoryBody,
      financialPeriod,
      deadline,
      deadlineSource,
      category,
      responsiblePerson,
      notes,
    } = req.body;

    const errors = [];
    if (!filingType || !filingType.trim()) errors.push('Filing type is required');
    if (!statutoryBody || !statutoryBody.trim()) errors.push('Statutory body is required');
    if (!financialPeriod || !financialPeriod.trim()) errors.push('Financial period is required');
    if (!deadline) {
      errors.push('Filing deadline is required');
    } else {
      const parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        errors.push('Filing deadline must be a valid date');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed for compliance task creation.',
        data: null,
        errors,
      });
    }

    const task = await Compliance.create({
      society: req.societyId,
      filingType: filingType.trim(),
      statutoryBody: statutoryBody.trim(),
      financialPeriod: financialPeriod.trim(),
      deadline: new Date(deadline),
      deadlineSource: deadlineSource?.trim() || 'Administrator Confirmed Calendar',
      category: category || 'OTHER',
      responsiblePerson: responsiblePerson || null,
      notes: notes?.trim() || null,
      status: 'PENDING',
      preparationStatus: 'NOT_STARTED',
      reviewStatus: 'NOT_REVIEWED',
      documentationStatus: 'INCOMPLETE',
      statusHistory: [
        {
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          action: 'CREATED',
          changedBy: req.user._id,
          comments: `Task scheduled with deadline ${new Date(deadline).toISOString().split('T')[0]}`,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Compliance task created successfully.',
      data: { task },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/compliance/:id
 * Update compliance task metadata (does not mark as filed).
 */
export async function updateComplianceTask(req, res, next) {
  try {
    const { id } = req.params;
    const task = await Compliance.findOne({ _id: id, society: req.societyId });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Compliance task not found.',
        data: null,
        errors: ['Task not found'],
      });
    }

    const {
      filingType,
      statutoryBody,
      financialPeriod,
      deadline,
      deadlineSource,
      category,
      responsiblePerson,
      reviewedBy,
      preparationStatus,
      documentationStatus,
      notes,
    } = req.body;

    if (deadline) {
      const parsed = new Date(deadline);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid deadline date provided.',
          data: null,
          errors: ['Deadline must be a valid date format'],
        });
      }
      task.deadline = parsed;
    }

    if (filingType) task.filingType = filingType.trim();
    if (statutoryBody) task.statutoryBody = statutoryBody.trim();
    if (financialPeriod) task.financialPeriod = financialPeriod.trim();
    if (deadlineSource) task.deadlineSource = deadlineSource.trim();
    if (category) task.category = category;
    if (responsiblePerson !== undefined) task.responsiblePerson = responsiblePerson || null;
    if (reviewedBy !== undefined) task.reviewedBy = reviewedBy || null;
    if (preparationStatus) task.preparationStatus = preparationStatus;
    if (documentationStatus) task.documentationStatus = documentationStatus;
    if (notes !== undefined) task.notes = notes?.trim() || null;

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Compliance task updated successfully.',
      data: { task },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/compliance/:id/record-filing
 * Record formal filing with verified submission date, acknowledgement reference, and payment challan.
 * A task CANNOT be marked as filed merely because a draft was saved.
 */
export async function recordFiling(req, res, next) {
  try {
    const { id } = req.params;
    const {
      submissionDate,
      acknowledgementReference,
      challanReference,
      challanAmount,
      challanDate,
      penaltyPaid,
      notes,
    } = req.body;

    const errors = [];
    if (!submissionDate) {
      errors.push('Actual submission date is required to record filing');
    } else {
      const parsedSubDate = new Date(submissionDate);
      if (isNaN(parsedSubDate.getTime())) {
        errors.push('Submission date must be a valid date');
      } else if (parsedSubDate > new Date()) {
        errors.push('Submission date cannot be in the future');
      }
    }

    if (!acknowledgementReference || !acknowledgementReference.trim()) {
      errors.push('Filing acknowledgement reference number or receipt code is mandatory');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot record compliance filing without required proof.',
        data: null,
        errors,
      });
    }

    const task = await Compliance.findOne({ _id: id, society: req.societyId });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Compliance task not found.',
        data: null,
        errors: ['Task not found'],
      });
    }

    const prevStatus = task.status;
    const newStatus = task.status === 'CORRECTION_REQUIRED' ? 'REVISED_FILED' : 'FILED';

    task.status = newStatus;
    task.submissionDate = new Date(submissionDate);
    task.acknowledgementReference = acknowledgementReference.trim();
    if (challanReference) task.challanReference = challanReference.trim();
    if (challanAmount !== undefined && challanAmount !== null) {
      task.challanAmountPaise = Math.round(Number(challanAmount) * 100);
    }
    if (challanDate) task.challanDate = new Date(challanDate);
    if (penaltyPaid !== undefined && penaltyPaid !== null) {
      task.penaltyPaidPaise = Math.round(Number(penaltyPaid) * 100);
    }
    if (notes) task.notes = notes.trim();

    task.documentationStatus = 'COMPLETE';

    task.statusHistory.push({
      fromStatus: prevStatus,
      toStatus: newStatus,
      action: newStatus === 'REVISED_FILED' ? 'REVISED_SUBMISSION' : 'FORMAL_SUBMISSION',
      changedBy: req.user._id,
      comments: `Filing recorded with Ack Ref: ${acknowledgementReference.trim()}${
        task.challanAmountPaise ? ` | Challan: ₹${task.challanAmountPaise / 100}` : ''
      }`,
    });

    await task.save();

    res.status(200).json({
      success: true,
      message: `Compliance filing formally recorded as ${newStatus}.`,
      data: { task },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/compliance/:id/status
 * Explicit lifecycle status transitions with reason logging:
 * - SUBMIT_FOR_REVIEW
 * - APPROVE_REVIEW
 * - REQUEST_CHANGES
 * - MARK_CORRECTION_REQUIRED
 */
export async function transitionTaskStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;

    const task = await Compliance.findOne({ _id: id, society: req.societyId });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Compliance task not found.',
        data: null,
        errors: ['Task not found'],
      });
    }

    const prevStatus = task.status;
    let targetStatus = prevStatus;

    switch (action) {
      case 'SUBMIT_FOR_REVIEW':
        task.preparationStatus = 'PREPARED';
        task.reviewStatus = 'UNDER_REVIEW';
        targetStatus = 'UNDER_REVIEW';
        break;

      case 'APPROVE_REVIEW':
        task.reviewStatus = 'APPROVED';
        task.reviewedBy = req.user._id;
        break;

      case 'REQUEST_CHANGES':
        task.reviewStatus = 'CHANGES_REQUESTED';
        task.preparationStatus = 'REVISION_NEEDED';
        if (targetStatus === 'UNDER_REVIEW') targetStatus = 'PENDING';
        break;

      case 'MARK_CORRECTION_REQUIRED':
        if (!comments || !comments.trim()) {
          return res.status(400).json({
            success: false,
            message: 'Correction explanation comments are required.',
            data: null,
            errors: ['Reason for correction or notice from statutory authority is required'],
          });
        }
        targetStatus = 'CORRECTION_REQUIRED';
        task.preparationStatus = 'REVISION_NEEDED';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported compliance transition action.',
          data: null,
          errors: [`Action '${action}' is not recognized`],
        });
    }

    task.status = targetStatus;
    task.statusHistory.push({
      fromStatus: prevStatus,
      toStatus: targetStatus,
      action,
      changedBy: req.user._id,
      comments: comments?.trim() || `Status updated via action: ${action}`,
    });

    await task.save();

    res.status(200).json({
      success: true,
      message: `Compliance task successfully transitioned via ${action}.`,
      data: { task },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/compliance/:id/documents
 * Attach supporting document, challan, or acknowledgement.
 */
export async function addSupportingDocument(req, res, next) {
  try {
    const { id } = req.params;
    const { title, documentType, fileName, fileUrl, fileSize } = req.body;

    if (!title || !title.trim() || !fileName || !fileName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed for document attachment.',
        data: null,
        errors: ['Document title and filename are required'],
      });
    }

    const task = await Compliance.findOne({ _id: id, society: req.societyId });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Compliance task not found.',
        data: null,
        errors: ['Task not found'],
      });
    }

    task.supportingDocuments.push({
      title: title.trim(),
      documentType: documentType || 'OTHER',
      fileName: fileName.trim(),
      fileUrl: fileUrl?.trim() || null,
      fileSize: Number(fileSize) || 0,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    });

    // If an acknowledgement or return form was attached, update documentation status
    if (['ACKNOWLEDGEMENT', 'RETURN_FORM', 'CHALLAN'].includes(documentType)) {
      task.documentationStatus = 'COMPLETE';
    }

    await task.save();

    res.status(201).json({
      success: true,
      message: 'Supporting document successfully attached to compliance record.',
      data: {
        documents: task.supportingDocuments,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/compliance/export/summary
 * Generates structured compliance audit summary.
 */
export async function exportComplianceSummary(req, res, next) {
  try {
    const societyId = req.societyId;
    const society = await Society.findById(societyId);
    const tasks = await Compliance.find({ society: societyId })
      .populate('responsiblePerson', 'name')
      .populate('reviewedBy', 'name')
      .sort({ deadline: 1 });

    const summaryReport = {
      societyName: society?.name || null,
      registrationNumber: society?.registrationNumber || null,
      generatedAt: new Date().toISOString(),
      disclaimer: COMPLIANCE_DISCLAIMER,
      totalTrackedTasks: tasks.length,
      complianceRecords: tasks.map((t) => ({
        id: t._id,
        filingType: t.filingType,
        category: t.category,
        statutoryBody: t.statutoryBody,
        financialPeriod: t.financialPeriod,
        deadline: t.deadline?.toISOString().split('T')[0],
        deadlineSource: t.deadlineSource,
        status: t.status,
        submissionDate: t.submissionDate?.toISOString().split('T')[0] || 'N/A',
        acknowledgementReference: t.acknowledgementReference || 'N/A',
        challanReference: t.challanReference || 'N/A',
        challanAmountRupees: t.challanAmountRupees,
        responsiblePerson: t.responsiblePerson?.name || 'Unassigned',
        reviewedBy: t.reviewedBy?.name || 'Not Reviewed',
        documentationStatus: t.documentationStatus,
      })),
    };

    res.status(200).json({
      success: true,
      message: 'Compliance export statement generated successfully.',
      data: summaryReport,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
