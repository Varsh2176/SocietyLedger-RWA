import api, { shouldUseMockFallback } from './api.js';
import { WORKFLOW_ENDPOINTS } from './apiContract.js';

const fallbackDocuments = [
  {
    id: 'doc_001',
    name: 'Form_V_Annual_Return_FY25_26_Signed.pdf',
    category: 'STATUTORY_COMPLIANCE',
    size: '1.8 MB',
    fileType: 'application/pdf',
    uploadedAt: '2026-09-24',
    uploadedBy: 'Dr. Anand Rao',
    verificationStatus: 'VERIFIED',
    relatedEntity: 'Form V Society Return',
  },
  {
    id: 'doc_002',
    name: 'Johnson_Lifts_Q3_AMC_Invoice_441.pdf',
    category: 'INVOICE_RECEIPT',
    size: '420 KB',
    fileType: 'application/pdf',
    uploadedAt: '2026-10-24',
    uploadedBy: 'Praveen Kumar',
    verificationStatus: 'VERIFIED',
    relatedEntity: 'VR-2026-089',
  },
  {
    id: 'doc_003',
    name: 'BESCOM_Common_Meter_Oct26_Receipt.pdf',
    category: 'UTILITY_BILL',
    size: '310 KB',
    fileType: 'application/pdf',
    uploadedAt: '2026-10-10',
    uploadedBy: 'Priya Sharma',
    verificationStatus: 'VERIFIED',
    relatedEntity: 'VR-2026-082',
  },
  {
    id: 'doc_004',
    name: 'SunPower_Solar_Inverter_Warranty_Card.pdf',
    category: 'WARRANTY_AMC',
    size: '890 KB',
    fileType: 'application/pdf',
    uploadedAt: '2026-10-22',
    uploadedBy: 'SunPower Systems',
    verificationStatus: 'PENDING_VERIFICATION',
    relatedEntity: 'VR-2026-087',
  },
];

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function normalizeDocument(doc) {
  return {
    ...doc,
    id: doc.id || doc._id,
    size: doc.size || doc.sizeDisplay || (doc.sizeBytes ? `${Math.ceil(doc.sizeBytes / 1024)} KB` : '—'),
    fileType: doc.fileType || doc.mimeType || 'application/octet-stream',
    relatedEntity: doc.relatedEntity || doc.relatedEntityDescription || '',
    uploadedAt: doc.uploadedAt || doc.createdAt,
  };
}

export const documentsService = {
  async getDocuments(params = {}) {
    try {
      const response = await api.get(WORKFLOW_ENDPOINTS.DOCUMENTS, { params });
      const raw = response.data?.data?.documents || response.data?.data || response.data;
      const documents = Array.isArray(raw) ? raw.map(normalizeDocument) : [];
      return {
        documents,
        isLiveBackend: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      let filtered = [...fallbackDocuments];
      if (params.category && params.category !== 'ALL') {
        filtered = filtered.filter((d) => d.category === params.category);
      }
      return { documents: filtered, isLiveBackend: false };
    }
  },

  async uploadDocument(file, metadata) {
    // Validate file size (< 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds the 10 MB limit for society document repository.');
    }

    const fileDataBase64 = arrayBufferToBase64(await file.arrayBuffer());

    try {
      const response = await api.post(WORKFLOW_ENDPOINTS.DOCUMENTS, {
        name: metadata.name || file.name,
        category: metadata.category,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileDataBase64,
        fileSize: file.size,
        description: metadata.description || '',
        relatedEntityDescription: metadata.relatedEntity || '',
        isPublishedToResidents: Boolean(metadata.isPublishedToResidents),
      });
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (!error.response || error.response.status === 404) {
        const newDoc = {
          id: `doc_${Date.now()}`,
          name: file.name,
          category: metadata.category,
          size: `${(file.size / 1024).toFixed(0)} KB`,
          fileType: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString().split('T')[0],
          uploadedBy: 'Current User',
          verificationStatus: 'PENDING_VERIFICATION',
          relatedEntity: metadata.relatedEntity || 'General Deposit',
        };
        fallbackDocuments.unshift(newDoc);
        return newDoc;
      }
      throw new Error(error.response?.data?.message || error.message || 'Document upload failed.');
    }
  },

  /**
   * Authenticated download. The file is streamed from the private repository;
   * residents are rejected by the API when the document is unpublished.
   */
  async downloadDocument(doc) {
    const docId = doc.id || doc._id;
    try {
      const response = await api.get(`${WORKFLOW_ENDPOINTS.DOCUMENTS}/${docId}/download`, {
        responseType: 'blob',
      });
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      if (error.response) {
        throw new Error(error.response?.data?.message || 'Document download was denied.');
      }
    }

    const content = `[SocietyLedger Authorized Document]\r\nDocument ID: ${doc.id}\r\nName: ${doc.name}\r\nCategory: ${doc.category}\r\nUploaded: ${doc.uploadedAt}\r\nVerification: ${doc.verificationStatus}`;
    const blob = new Blob([content], { type: doc.fileType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async verifyDocument(id, status) {
    try {
      const response = await api.post(`${WORKFLOW_ENDPOINTS.DOCUMENTS}/${id}/verify`, { status });
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const doc = fallbackDocuments.find((d) => d.id === id || d._id === id);
      if (doc) doc.verificationStatus = status;
      return doc;
    }
  },

  async deleteDocument(id) {
    try {
      const response = await api.delete(`${WORKFLOW_ENDPOINTS.DOCUMENTS}/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      if (!shouldUseMockFallback()) throw error;
      const idx = fallbackDocuments.findIndex((d) => d.id === id || d._id === id);
      if (idx !== -1) fallbackDocuments.splice(idx, 1);
      return { success: true };
    }
  },
};
