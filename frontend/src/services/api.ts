import { Incident, DashboardStats, AIAnalysisResult } from '../types';

const API_BASE = '/api';

export const api = {
  async getIncidents(filters?: { department?: string; status?: string; priority?: string }): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);

    const res = await fetch(`${API_BASE}/incidents?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch incidents');
    const data = await res.json();
    return data.incidents;
  },

  async getIncident(id: string): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/${id}`);
    if (!res.ok) throw new Error('Failed to fetch incident');
    const data = await res.json();
    return data.incident;
  },

  async createIncident(formData: FormData): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to submit incident');
    const data = await res.json();
    return data.incident;
  },

  async previewAI(formData: FormData): Promise<AIAnalysisResult> {
    const res = await fetch(`${API_BASE}/ai/preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('AI preview failed');
    const data = await res.json();
    return data.aiAnalysis;
  },

  async updateStatus(
    id: string,
    payload: {
      status: string;
      note?: string;
      updatedBy?: string;
      unitName?: string;
      unitBadge?: string;
      unitPhone?: string;
      etaMinutes?: number;
      proofPhoto?: File;
    }
  ): Promise<Incident> {
    const formData = new FormData();
    formData.append('status', payload.status);
    if (payload.note) formData.append('note', payload.note);
    if (payload.updatedBy) formData.append('updatedBy', payload.updatedBy);
    if (payload.unitName) formData.append('unitName', payload.unitName);
    if (payload.unitBadge) formData.append('unitBadge', payload.unitBadge);
    if (payload.unitPhone) formData.append('unitPhone', payload.unitPhone);
    if (payload.etaMinutes) formData.append('etaMinutes', payload.etaMinutes.toString());
    if (payload.proofPhoto) formData.append('proofPhoto', payload.proofPhoto);

    const res = await fetch(`${API_BASE}/incidents/${id}/status`, {
      method: 'PATCH',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to update incident status');
    const data = await res.json();
    return data.incident;
  },

  async getStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    return data.stats;
  },

  async resetSeed(): Promise<void> {
    await fetch(`${API_BASE}/seed`, { method: 'POST' });
  }
};
