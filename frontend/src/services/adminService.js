import api from './api.js';
import { ADMIN_ENDPOINTS } from './apiContract.js';

function readData(response) {
  return response.data?.data || response.data;
}

export const adminService = {
  async getSociety() {
    const response = await api.get(ADMIN_ENDPOINTS.SOCIETY);
    return readData(response).society;
  },

  async updateSociety(profile) {
    const response = await api.put(ADMIN_ENDPOINTS.SOCIETY, profile);
    return readData(response).society;
  },

  async getMembers(params = {}) {
    const response = await api.get(ADMIN_ENDPOINTS.MEMBERS, { params });
    return readData(response).members || [];
  },

  async getMember(id) {
    const response = await api.get(`${ADMIN_ENDPOINTS.MEMBERS}/${id}`);
    return readData(response).member;
  },

  async updateMemberStatus(id, isActive) {
    const response = await api.patch(`${ADMIN_ENDPOINTS.MEMBERS}/${id}/status`, { isActive });
    return readData(response).member;
  },

  async updateMemberRole(id, role) {
    const response = await api.patch(`${ADMIN_ENDPOINTS.MEMBERS}/${id}/role`, { role });
    return readData(response).member;
  },

  async rotateInvitationCode() {
    const response = await api.post(ADMIN_ENDPOINTS.ROTATE_INVITATION_CODE);
    return readData(response).invitationCode;
  },
};
