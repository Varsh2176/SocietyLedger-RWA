import {
  AuditLog,
  Observation,
} from '../models/index.js';

const AUDIT_TRAIL_DISCLAIMER =
  'Application-level append-only audit trail. This provides internal governance accountability, but is not independent cryptographic WORM storage.';

/**
 * Audit Trail & Formal Observations Controller
 * Enforces strict immutability, data segregation, and audit disclosure standards.
 */

/**
 * GET /api/audit/logs
 * Retrieve immutable audit logs for the user's society.
 * Society Administrator and Auditor can view logs. Treasurer, Committee Member, and Resident cannot.
 */
export async function getAuditLogs(req, res, next) {
  try {
    const societyId = req.societyId;
    const {
      actor,
      action,
      entityType,
      severity,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { society: societyId };

    if (actor) filter.actor = actor;
    if (action && action !== 'ALL') filter.action = action.toUpperCase();
    if (entityType && entityType !== 'ALL') filter.entityType = entityType.toUpperCase();
    if (severity && severity !== 'ALL') filter.severity = severity.toUpperCase();

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { action: { $regex: q, $options: 'i' } },
        { details: { $regex: q, $options: 'i' } },
        { entityRef: { $regex: q, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .populate('actor', 'name email role apartmentNumber')
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const formattedLogs = logs.map((log) => ({
      id: log._id,
      _id: log._id,
      timestamp: log.timestamp,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      entityRef: log.entityRef,
      details: log.details,
      severity: log.severity,
      actor: log.actor?.name || 'System / Automated Rule',
      actorRole: log.actor?.role || 'SYSTEM',
      ipAddress: log.ipAddress,
    }));

    res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully.',
      data: {
        disclaimer: AUDIT_TRAIL_DISCLAIMER,
        logs: formattedLogs,
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
 * GET /api/audit/observations
 * List formal auditor observations and findings.
 */
export async function getAuditObservations(req, res, next) {
  try {
    const societyId = req.societyId;
    const { severity, status, category, search } = req.query;

    const filter = { society: societyId };

    if (severity && severity !== 'ALL') filter.severity = severity;
    if (status && status !== 'ALL') filter.status = status;
    if (category && category !== 'ALL') filter.category = category;

    if (search) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { finding: { $regex: q, $options: 'i' } },
        { relatedEntityRef: { $regex: q, $options: 'i' } },
      ];
    }

    const observations = await Observation.find(filter)
      .populate('auditor', 'name email role')
      .populate('responsiblePerson', 'name email role apartmentNumber')
      .populate('resolvedBy', 'name email role')
      .sort({ severity: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Audit observations retrieved successfully.',
      data: {
        observations,
        total: observations.length,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/audit/observations
 * Record a new formal audit finding (Auditor and Admin only).
 */
export async function createAuditObservation(req, res, next) {
  try {
    const {
      title,
      category,
      severity,
      finding,
      riskDescription,
      recommendation,
      responsiblePerson,
      relatedEntityRef,
    } = req.body;

    const errors = [];
    if (!title || !title.trim()) errors.push('Observation title is required');
    if (!finding || !finding.trim()) errors.push('Detailed finding description is required');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed for audit observation.',
        data: null,
        errors,
      });
    }

    const observation = await Observation.create({
      society: req.societyId,
      title: title.trim(),
      category: category || 'INTERNAL_CONTROL',
      severity: severity || 'MEDIUM',
      finding: finding.trim(),
      riskDescription: riskDescription?.trim() || null,
      recommendation: recommendation?.trim() || null,
      responsiblePerson: responsiblePerson || null,
      relatedEntityRef: relatedEntityRef?.trim() || null,
      auditor: req.user._id,
      status: 'OPEN',
    });

    // Record Immutable Audit Log entry
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'RECORD_AUDIT_OBSERVATION',
      entityType: 'OBSERVATION',
      entityId: observation._id,
      entityRef: observation.title,
      details: `Formal audit observation recorded by ${req.user.name} (${req.user.role}): ${observation.title} [Severity: ${observation.severity}]`,
      severity: observation.severity === 'CRITICAL' || observation.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
    });

    res.status(201).json({
      success: true,
      message: 'Audit observation recorded successfully.',
      data: { observation },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/audit/observations/:id
 * Update observation status, corrective action, or management response.
 */
export async function updateAuditObservation(req, res, next) {
  try {
    const { id } = req.params;
    const {
      status,
      correctiveAction,
      managementResponse,
      recommendation,
      responsiblePerson,
    } = req.body;

    const observation = await Observation.findOne({ _id: id, society: req.societyId });
    if (!observation) {
      return res.status(404).json({
        success: false,
        message: 'Observation not found.',
        data: null,
        errors: ['Observation not found or belongs to another society'],
      });
    }

    const prevStatus = observation.status;
    if (status) observation.status = status;
    if (correctiveAction !== undefined) observation.correctiveAction = correctiveAction?.trim() || null;
    if (managementResponse !== undefined) observation.managementResponse = managementResponse?.trim() || null;
    if (recommendation !== undefined) observation.recommendation = recommendation?.trim() || null;
    if (responsiblePerson !== undefined) observation.responsiblePerson = responsiblePerson || null;

    if (status === 'RESOLVED' && prevStatus !== 'RESOLVED') {
      observation.resolvedAt = new Date();
      observation.resolvedBy = req.user._id;
    }

    await observation.save();

    // Log update
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'UPDATE_AUDIT_OBSERVATION',
      entityType: 'OBSERVATION',
      entityId: observation._id,
      entityRef: observation.title,
      details: `Observation ${observation.title} updated by ${req.user.name}. Status: ${prevStatus} -> ${observation.status}.`,
      severity: 'INFO',
    });

    res.status(200).json({
      success: true,
      message: 'Audit observation updated successfully.',
      data: { observation },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
