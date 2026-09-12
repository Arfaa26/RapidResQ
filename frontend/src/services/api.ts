import { Incident, DashboardStats, AIAnalysisResult, HotspotResult, EvaluationResult } from '../types';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
const API_BASE = `${configuredBaseUrl}/api`;

async function request<T>(url: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let signal: AbortSignal = controller.signal;
  if (init?.signal) {
    if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any === 'function') {
      signal = (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([init.signal, controller.signal]);
    } else {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(url, { cache: 'no-store', ...init, signal });
    const data = await response.json().catch(() => null) as { error?: string; message?: string } | null;

    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    }

    if (!data) throw new Error('The API returned an invalid response. Check the backend connection.');

    return data as T;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (init?.signal?.aborted) throw err;
      throw new Error('Network request timed out. Please verify connection and retry.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  async getIncidents(filters?: { department?: string; status?: string; priority?: string }): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);

    const data = await request<{ incidents: Incident[] }>(`${API_BASE}/incidents?${params.toString()}`, undefined, 8000);
    return data.incidents;
  },

  async getIncident(id: string): Promise<Incident> {
    const data = await request<{ incident: Incident }>(`${API_BASE}/incidents/${id}`, undefined, 8000);
    return data.incident;
  },

  async createIncident(formData: FormData): Promise<Incident> {
    const data = await request<{ incident: Incident }>(`${API_BASE}/incidents`, {
      method: 'POST',
      body: formData,
    }, 35000);
    return data.incident;
  },

  async previewAI(formData: FormData, signal?: AbortSignal): Promise<AIAnalysisResult> {
    const data = await request<{ aiAnalysis: AIAnalysisResult }>(`${API_BASE}/ai/preview`, {
      signal,
      method: 'POST',
      body: formData,
    }, 18000);
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

  async getHotspots(days: number): Promise<HotspotResult> {
    return (await request<{ analytics: HotspotResult }>(`${API_BASE}/analytics/hotspots?days=${days}`)).analytics;
  },
  async getEvaluation(): Promise<Record<string, EvaluationResult>> {
    return (await request<{ models: Record<string, EvaluationResult> }>(`${API_BASE}/ml/evaluation`)).models;
  },
  async reviewDuplicate(id: string, decision: 'CONFIRM' | 'REJECT'): Promise<Incident> {
    return (await request<{ incident: Incident }>(`${API_BASE}/incidents/${id}/duplicate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
    })).incident;
  },
  async resetSeed(): Promise<void> {
    await request<{ success: boolean }>(`${API_BASE}/seed`, { method: 'POST' });
  }
};
