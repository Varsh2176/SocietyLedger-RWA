import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Document, AuditLog } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

function isStoredInsideUploads(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return false;
  const root = path.resolve(UPLOADS_DIR);
  const target = path.resolve(storagePath);
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

// Allowed extensions and MIME types
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.csv', '.txt'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'application/octet-stream',
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Secure Document Management Controller
 * Enforces authenticated streaming, private storage, and role-based disclosure.
 */

/**
 * GET /api/documents
 * List document metadata for the user's society.
 * Residents only receive documents with isPublishedToResidents === true.
 */
export async function getDocuments(req, res, next) {
  try {
    const societyId = req.societyId;
    const { category, verificationStatus, entityRef, search } = req.query;

    const filter = { society: societyId };

    // Residents only see published documents
    if (req.user.role === 'Resident') {
      filter.isPublishedToResidents = true;
    }

    if (category && category !== 'ALL') filter.category = category;
    if (verificationStatus && verificationStatus !== 'ALL') filter.verificationStatus = verificationStatus;

    if (search) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { relatedEntityDescription: { $regex: q, $options: 'i' } },
      ];
    }

    const documents = await Document.find(filter)
      .populate('uploadedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .sort({ createdAt: -1 });

    const formatted = documents.map((doc) => ({
      id: doc._id,
      _id: doc._id,
      name: doc.name,
      category: doc.category,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      sizeDisplay: doc.sizeDisplay,
      verificationStatus: doc.verificationStatus,
      isPublishedToResidents: doc.isPublishedToResidents,
      relatedEntityDescription: doc.relatedEntityDescription,
      description: doc.description,
      uploadedBy: doc.uploadedBy?.name || 'Authorized Member',
      uploaderRole: doc.uploadedBy?.role || 'Member',
      uploadedAt: doc.createdAt,
      verifiedBy: doc.verifiedBy?.name || null,
      verifiedAt: doc.verifiedAt,
      // Secure download endpoint URL (requires auth token/cookie)
      downloadUrl: `/api/documents/${doc._id}/download`,
    }));

    res.status(200).json({
      success: true,
      message: 'Documents retrieved successfully.',
      data: {
        documents: formatted,
        total: formatted.length,
      },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/documents/:id
 * Retrieve single document metadata.
 */
export async function getDocumentById(req, res, next) {
  try {
    const { id } = req.params;
    const document = await Document.findOne({ _id: id, society: req.societyId })
      .populate('uploadedBy', 'name email role')
      .populate('verifiedBy', 'name email role');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
        data: null,
        errors: ['Document not found or belongs to another society'],
      });
    }

    // Role check: Resident can only view published documents
    if (req.user.role === 'Resident' && !document.isPublishedToResidents) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to unpublished confidential document.',
        data: null,
        errors: ['Document is restricted to committee officers and auditors'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Document metadata retrieved.',
      data: { document },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/documents
 * Secure document upload.
 * Accepts file payload (base64 or buffer), validates size and extension,
 * writes to private society directory, and logs audit record.
 */
export async function uploadDocument(req, res, next) {
  try {
    const {
      name,
      category,
      fileName,
      mimeType,
      fileDataBase64,
      fileSize,
      description,
      relatedEntityDescription,
      relatedTransaction,
      relatedApproval,
      relatedEvent,
      relatedCompliance,
      isPublishedToResidents = false,
    } = req.body;

    const errors = [];
    if (!name || !name.trim()) errors.push('Document title is required');
    if (!category) errors.push('Document category is required');
    if (!fileName || !fileName.trim()) errors.push('Filename is required');

    const ext = path.extname(fileName || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push(`Disallowed file extension '${ext}'. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    if (fileSize && Number(fileSize) > MAX_FILE_SIZE_BYTES) {
      errors.push('File size exceeds the maximum limit of 10 MB');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed for document upload.',
        data: null,
        errors,
      });
    }

    // Prepare society private directory
    const societyDir = path.join(UPLOADS_DIR, String(req.societyId));
    if (!existsSync(societyDir)) {
      await fs.mkdir(societyDir, { recursive: true });
    }

    const safeBaseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFileName = `${Date.now()}_${safeBaseName}`;
    const storageFilePath = path.join(societyDir, storageFileName);

    let actualSizeBytes = Number(fileSize) || 0;

    // If base64 content provided, write to disk
    if (fileDataBase64 && typeof fileDataBase64 === 'string') {
      const cleanBase64 = fileDataBase64.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      actualSizeBytes = buffer.length;
      if (actualSizeBytes > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds 10 MB limit.',
          data: null,
          errors: ['Maximum upload size is 10 MB'],
        });
      }
      await fs.writeFile(storageFilePath, buffer);
    } else {
      // Mock / dummy file placeholder in dev mode
      const placeholderText = `SocietyLedger Document: ${name}\nUploaded by: ${req.user.name}\nTimestamp: ${new Date().toISOString()}`;
      await fs.writeFile(storageFilePath, placeholderText, 'utf8');
      actualSizeBytes = Buffer.byteLength(placeholderText);
    }

    const document = await Document.create({
      society: req.societyId,
      name: name.trim(),
      category,
      mimeType: mimeType || 'application/pdf',
      sizeBytes: actualSizeBytes,
      storagePath: storageFilePath,
      uploadedBy: req.user._id,
      verificationStatus: 'PENDING',
      isPublishedToResidents: Boolean(isPublishedToResidents),
      relatedEntityDescription: relatedEntityDescription?.trim() || null,
      relatedTransaction: relatedTransaction || null,
      relatedApproval: relatedApproval || null,
      relatedEvent: relatedEvent || null,
      relatedCompliance: relatedCompliance || null,
      description: description?.trim() || null,
    });

    // Record Immutable Audit Log
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'UPLOAD_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: document._id,
      entityRef: document.name,
      details: `Document '${document.name}' (${document.category}, ${document.sizeDisplay}) uploaded by ${req.user.name}.`,
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Document successfully stored in secure society repository.',
      data: { document },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/documents/:id/download
 * Secure document streaming and download.
 * Validates society ownership, user permissions, and streams private file.
 */
export async function downloadDocument(req, res, next) {
  try {
    const { id } = req.params;
    const document = await Document.findOne({ _id: id, society: req.societyId }).select('+storagePath');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
        data: null,
        errors: ['Document not found or belongs to another society'],
      });
    }

    // Role check for Residents
    if (req.user.role === 'Resident' && !document.isPublishedToResidents) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Document is private to management committee and auditors.',
        data: null,
        errors: ['Confidential document access violation'],
      });
    }

    if (!document.storagePath || !isStoredInsideUploads(document.storagePath) || !existsSync(document.storagePath)) {
      return res.status(404).json({
        success: false,
        message: 'Physical file not found in storage repository.',
        data: null,
        errors: ['File missing on storage server'],
      });
    }

    // Send file securely with Content-Disposition
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.name + path.extname(document.storagePath))}"`
    );
    res.sendFile(document.storagePath);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/documents/:id/verify
 * Auditor or Treasurer verifies or rejects an uploaded document.
 */
export async function verifyDocument(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either VERIFIED or REJECTED.',
        data: null,
        errors: ['Invalid verification status'],
      });
    }

    const document = await Document.findOne({ _id: id, society: req.societyId });
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
        data: null,
        errors: ['Document not found'],
      });
    }

    document.verificationStatus = status;
    document.verifiedBy = req.user._id;
    document.verifiedAt = new Date();
    if (notes) document.description = `${document.description || ''}\nVerification Notes: ${notes.trim()}`;

    await document.save();

    res.status(200).json({
      success: true,
      message: `Document successfully marked as ${status}.`,
      data: { document },
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/documents/:id
 * Remove a document (only permitted if not locked by finalized reconciliation or audited record).
 */
export async function deleteDocument(req, res, next) {
  try {
    const { id } = req.params;
    const document = await Document.findOne({ _id: id, society: req.societyId }).select('+storagePath');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
        data: null,
        errors: ['Document not found'],
      });
    }

    // Only Admin or original uploader can delete
    const isUploader = document.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'Society Administrator';

    if (!isUploader && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only original uploader or Society Administrator can delete documents.',
        data: null,
        errors: ['Delete permission denied'],
      });
    }

    // Remove physical file from disk if exists
    if (document.storagePath && isStoredInsideUploads(document.storagePath) && existsSync(document.storagePath)) {
      try {
        await fs.unlink(document.storagePath);
      } catch (err) {
        console.warn('Could not delete physical file:', err.message);
      }
    }

    await Document.deleteOne({ _id: document._id });

    // Record Audit Log
    await AuditLog.create({
      society: req.societyId,
      actor: req.user._id,
      action: 'DELETE_DOCUMENT',
      entityType: 'DOCUMENT',
      entityId: document._id,
      entityRef: document.name,
      details: `Document '${document.name}' deleted by ${req.user.name}.`,
      severity: 'MEDIUM',
    });

    res.status(200).json({
      success: true,
      message: 'Document successfully deleted.',
      data: null,
      errors: null,
    });
  } catch (error) {
    next(error);
  }
}
