import crypto from 'crypto';
import mongoose from 'mongoose';
import { Society, User, USER_ROLES, AuditLog } from '../models/index.js';

const MEMBER_FIELDS = 'name email phone apartmentNumber role isActive verificationStatus lastLoginAt createdAt';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function presentMember(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    apartmentNumber: user.apartmentNumber || null,
    role: user.role,
    isActive: user.isActive === true,
    verificationStatus: user.verificationStatus,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
  };
}

function presentSociety(society) {
  return {
    id: society._id,
    name: society.name,
    registrationNumber: society.registrationNumber || null,
    invitationCode: society.code,
    contactEmail: society.contactEmail || null,
    contactPhone: society.contactPhone || null,
    address: {
      street: society.address?.street || null,
      city: society.address?.city || null,
      state: society.address?.state || null,
      pincode: society.address?.pincode || null,
    },
    fiscalYearStartMonth: society.fiscalYearStartMonth,
    isActive: society.isActive === true,
  };
}

function reject(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
    data: null,
    errors: [message],
  });
}

async function findSocietyMember(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    reject(res, 400, 'A valid member id is required.');
    return null;
  }
  const member = await User.findOne({ _id: id, society: req.societyId }).select(MEMBER_FIELDS);
  if (!member) {
    reject(res, 404, 'Member not found in your society.');
    return null;
  }
  return member;
}

async function otherActiveAdministrators(societyId, memberId) {
  return User.countDocuments({
    society: societyId,
    role: 'Society Administrator',
    isActive: true,
    _id: { $ne: memberId },
  });
}

function generateInvitationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  return `GW-${body}`;
}

export async function listMembers(req, res, next) {
  try {
    const filter = { society: req.societyId };
    const role = text(req.query.role);
    if (role && role !== 'ALL') {
      if (!USER_ROLES.includes(role)) {
        return reject(res, 400, 'Role filter is not a society role.');
      }
      filter.role = role;
    }
    const search = text(req.query.search);
    if (search) {
      const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { apartmentNumber: { $regex: pattern, $options: 'i' } },
      ];
    }

    const members = await User.find(filter).select(MEMBER_FIELDS).sort({ role: 1, name: 1 });
    res.status(200).json({
      success: true,
      message: 'Society members retrieved.',
      data: { members: members.map(presentMember) },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMember(req, res, next) {
  try {
    const member = await findSocietyMember(req, res);
    if (!member) return undefined;
    res.status(200).json({
      success: true,
      message: 'Member retrieved.',
      data: { member: presentMember(member) },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberStatus(req, res, next) {
  try {
    if (typeof req.body?.isActive !== 'boolean') {
      return reject(res, 400, 'isActive must be true or false.');
    }
    const member = await findSocietyMember(req, res);
    if (!member) return undefined;

    if (
      req.body.isActive === false
      && member.role === 'Society Administrator'
      && member.isActive
      && await otherActiveAdministrators(req.societyId, member._id) === 0
    ) {
      return reject(res, 400, 'The last active Society Administrator cannot be deactivated.');
    }

    const previous = member.isActive;
    await User.updateOne({ _id: member._id, society: req.societyId }, { $set: { isActive: req.body.isActive } });
    member.isActive = req.body.isActive;

    if (previous !== member.isActive) {
      await AuditLog.create({
        society: req.societyId,
        actor: req.user._id,
        action: 'CHANGE_MEMBER_STATUS',
        entityType: 'USER',
        entityId: member._id,
        previousState: { isActive: previous },
        newState: { isActive: member.isActive },
        details: `${member.email} was ${member.isActive ? 'activated' : 'deactivated'}.`,
        severity: 'HIGH',
      });
    }

    res.status(200).json({
      success: true,
      message: member.isActive ? 'Member activated.' : 'Member deactivated.',
      data: { member: presentMember(member) },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const role = text(req.body?.role);
    if (!USER_ROLES.includes(role)) {
      return reject(res, 400, 'Role must be one of the five society roles.');
    }
    const member = await findSocietyMember(req, res);
    if (!member) return undefined;

    if (member.role === role) {
      return res.status(200).json({
        success: true,
        message: 'Role is already assigned.',
        data: { member: presentMember(member) },
        errors: null,
      });
    }

    if (
      member.role === 'Society Administrator'
      && member.isActive
      && await otherActiveAdministrators(req.societyId, member._id) === 0
    ) {
      return reject(res, 400, 'The last active Society Administrator cannot be demoted.');
    }

    const previousRole = member.role;
    await User.updateOne({ _id: member._id, society: req.societyId }, { $set: { role } });
    member.role = role;

    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'CHANGE_MEMBER_ROLE',
      entityType: 'USER',
      entityId: member._id,
      previousState: { role: previousRole },
      newState: { role },
      details: `Role for ${member.email} changed from ${previousRole} to ${role}.`,
      severity: 'HIGH',
    });

    res.status(200).json({
      success: true,
      message: 'Member role updated.',
      data: { member: presentMember(member) },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSocietyProfile(req, res, next) {
  try {
    const society = await Society.findById(req.societyId);
    if (!society) return reject(res, 404, 'Society not found.');
    res.status(200).json({
      success: true,
      message: 'Society profile retrieved.',
      data: { society: presentSociety(society) },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSocietyProfile(req, res, next) {
  try {
    const blocked = ['code', '_id', 'id', 'isActive', 'committeeMembers', 'societyId'].filter((field) => (
      Object.prototype.hasOwnProperty.call(req.body || {}, field)
    ));
    if (blocked.length > 0) {
      return reject(res, 400, 'Society identity and invitation code cannot be changed from the profile.');
    }

    const society = await Society.findById(req.societyId);
    if (!society) return reject(res, 404, 'Society not found.');

    const name = text(req.body?.name);
    const registrationNumber = text(req.body?.registrationNumber);
    const contactEmail = text(req.body?.contactEmail).toLowerCase();
    const contactPhone = text(req.body?.contactPhone);
    const address = req.body?.address && typeof req.body.address === 'object' ? req.body.address : {};
    const fiscalYear = req.body?.fiscalYearStartMonth;

    if (!name || name.length > 200) {
      return reject(res, 400, 'Society name is required and must be 200 characters or fewer.');
    }
    if (!registrationNumber || registrationNumber.length > 80) {
      return reject(res, 400, 'Registration number is required and must be 80 characters or fewer.');
    }
    if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) {
      return reject(res, 400, 'Contact email must be a valid email address.');
    }
    if (contactPhone && !/^[0-9+\-\s()]{6,20}$/.test(contactPhone)) {
      return reject(res, 400, 'Contact phone must be 6 to 20 characters.');
    }
    const month = Number(fiscalYear);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return reject(res, 400, 'Fiscal year start month must be a number from 1 to 12.');
    }

    const addressText = (field) => text(address[field]).slice(0, 200);
    const previous = presentSociety(society);
    society.name = name;
    society.registrationNumber = registrationNumber;
    society.contactEmail = contactEmail || null;
    society.contactPhone = contactPhone || null;
    society.address = {
      street: addressText('street') || null,
      city: addressText('city') || null,
      state: addressText('state') || null,
      pincode: addressText('pincode') || null,
    };
    society.fiscalYearStartMonth = month;
    await society.save();

    const updated = presentSociety(society);
    await AuditLog.create({
      society: society._id,
      actor: req.user._id,
      action: 'UPDATE_SOCIETY_PROFILE',
      entityType: 'SOCIETY',
      entityId: society._id,
      previousState: {
        name: previous.name,
        registrationNumber: previous.registrationNumber,
        contactEmail: previous.contactEmail,
      },
      newState: {
        name: updated.name,
        registrationNumber: updated.registrationNumber,
        contactEmail: updated.contactEmail,
      },
      details: 'Society profile details were updated. Financial records remain on the same society.',
      severity: 'MEDIUM',
    });

    res.status(200).json({
      success: true,
      message: 'Society profile updated.',
      data: { society: updated },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

export async function rotateInvitationCode(req, res, next) {
  try {
    const society = await Society.findById(req.societyId);
    if (!society) return reject(res, 404, 'Society not found.');

    let nextCode = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateInvitationCode();
      if (candidate === society.code) continue;
      const existing = await Society.findOne({ code: candidate });
      if (!existing) {
        nextCode = candidate;
        break;
      }
    }
    if (!nextCode) return reject(res, 500, 'Could not allocate a new invitation code.');

    society.code = nextCode;
    await society.save();

    await AuditLog.create({
      society: society._id,
      actor: req.user._id,
      action: 'ROTATE_INVITATION_CODE',
      entityType: 'SOCIETY',
      entityId: society._id,
      details: 'The society invitation code was rotated. The previous code is no longer valid.',
      severity: 'HIGH',
    });

    res.status(200).json({
      success: true,
      message: 'Invitation code rotated. The previous code no longer works.',
      data: { invitationCode: society.code },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
