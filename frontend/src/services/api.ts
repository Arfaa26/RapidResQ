import { Incident, DashboardStats, AIAnalysisResult } from '../types';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
const API_BASE = `${configuredBaseUrl}/api`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null) as { error?: string; message?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data as T;
}

export const api = {
  async getIncidents(filters?: { department?: string; status?: string; priority?: string }): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);

    const data = await request<{ incidents: Incident[] }>(`${API_BASE}/incidents?${params.toString()}`);
    return data.incidents;
  },

  async getIncident(id: string): Promise<Incident> {
    const data = await request<{ incident: Incident }>(`${API_BASE}/incidents/${id}`);
    return data.incident;
  },

  async createIncident(formData: FormData): Promise<Incident> {
    const data = await request<{ incident: Incident }>(`${API_BASE}/incidents`, {
      method: 'POST',
      body: formData,
    });
    return data.incident;
  },

  async previewAI(formData: FormData): Promise<AIAnalysisResult> {
    const data = await request<{ aiAnalysis: AIAnalysisResult }>(`${API_BASE}/ai/preview`, {
      method: 'POST',
      body: formData,
    });
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

    const data = await request<{ incident: Incident }>(`${API_BASE}/incidents/${id}/status`, {
      method: 'PATCH',
      body: formData,
    });
    return data.incident;
  },

  async getStats(): Promise<DashboardStats> {
    const data = await request<{ stats: DashboardStats }>(`${API_BASE}/stats`);
    return data.stats;
  },

  async resetSeed(): Promise<void> {
    await request<{ success: boolean }>(`${API_BASE}/seed`, { method: 'POST' });
  }
};
