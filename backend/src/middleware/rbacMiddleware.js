import { USER_ROLES } from '../models/index.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts endpoint execution to specific roles from:
 * 'Society Administrator', 'Treasurer', 'Committee Member', 'Auditor', 'Resident'
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before checking permissions.',
        data: null,
        errors: ['User not authenticated'],
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${allowedRoles.join(', ')}.`,
        data: null,
        errors: [`Your role '${req.user.role}' is not authorized for this action.`],
      });
    }

    next();
  };
}

/**
 * Society-Level Data Isolation Middleware
 * Enforces that user can only access records belonging to their society.
 * Prevents IDOR (Insecure Direct Object Reference) by cross-checking society ownership.
 */
export function enforceSocietyIsolation(req, res, next) {
  if (!req.user || !req.user.society) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. User is not assigned to a registered society.',
      data: null,
      errors: ['No society association found'],
    });
  }

  // If a societyId is explicitly provided in body or query, ensure it matches
  const requestedSocietyId = req.params.societyId || req.query.societyId || req.body.societyId;
  const userSocietyId = (req.user.society._id || req.user.society).toString();

  if (requestedSocietyId && requestedSocietyId.toString() !== userSocietyId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot view or modify data of another society.',
      data: null,
      errors: ['Cross-society access prohibited'],
    });
  }

  // Always bind the society scope to req for controllers to filter by
  req.societyId = userSocietyId;
  next();
}
