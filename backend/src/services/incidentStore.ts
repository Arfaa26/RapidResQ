import { Incident, IncidentStatus, AssignedUnit } from '../types/index.js';
import { getDatabase } from './database.js';
import { presentIncident, resolveGroupedReports } from './presentIncident.js';

class IncidentStore {
  private incidents: Map<string, Incident> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const seed: Incident[] = [
      {
        id: 'INC-2026-8801',
        title: 'Building Smoke & Electrical Sparking',
        description: 'Heavy black smoke coming from the 2nd floor electrical room of the commercial complex. Flames visible near window.',
        mediaUrl: 'https://images.unsplash.com/photo-1542382257-80dedb725088?auto=format&fit=crop&w=800&q=80',
        mediaType: 'image',
        category: 'FIRE',
        priority: 'CRITICAL',
        department: 'FIRE_DEPARTMENT',
        status: 'IN_PROGRESS',
        location: {
          lat: 40.7128,
          lng: -74.0060,
          address: '424 Broadway, Downtown Core, NY',
        },
        reportedBy: {
          name: 'Arfa Altaf',
          phone: '+1 (555) 019-2834',
          isAnonymous: false,
        },
        aiAnalysis: {
          confidence: null,
          detectedCategory: 'FIRE',
          priority: 'CRITICAL',
          department: 'FIRE_DEPARTMENT',
          hazardType: 'Active Commercial Structure Fire',
          extractedKeywords: ['flames', 'electrical room', 'black smoke', 'evacuation'],
          recommendedAction: 'Immediate 2nd-alarm fire dispatch + deploy ladder team and notify power grid.',
          reasoning: 'Visual verification of flames and high toxic smoke volume. High life-safety risk.',
        },
        timeline: [
          {
            id: 'TL-1',
            status: 'PENDING',
            timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
            note: 'Citizen report submitted with photo & GPS location. AI classified as CRITICAL FIRE.',
            updatedBy: 'AI Triage Engine',
          },
          {
            id: 'TL-2',
            status: 'ACKNOWLEDGED',
            timestamp: new Date(Date.now() - 28 * 60000).toISOString(),
            note: 'Fire Control Dispatcher acknowledged report. Dispatched Engine 14 and Ladder 4.',
            updatedBy: 'Captain R. Miller (Fire HQ)',
          },
          {
            id: 'TL-3',
            status: 'IN_PROGRESS',
            timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
            note: 'Fire crew on scene. Power isolated. Hose lines deployed to 2nd floor.',
            updatedBy: 'Engine 14 Commander',
          }
        ],
        assignedUnit: {
          id: 'UNIT-F14',
          name: 'Engine 14 Fire & Rescue Crew',
          badge: 'FDNY-E14',
          phone: '+1 (555) 911-0414',
          etaMinutes: 3,
        },
        createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
        updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      },
      {
        id: 'INC-2026-8802',
        title: 'Two-Car T-Bone Collision',
        description: 'Two sedans collided at the intersection. One driver seems dizzy. Airbags deployed, traffic blocked.',
        mediaUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80',
        mediaType: 'image',
        category: 'ACCIDENT',
        priority: 'CRITICAL',
        department: 'EMS_AMBULANCE',
        status: 'ACKNOWLEDGED',
        location: {
          lat: 40.7282,
          lng: -73.9942,
          address: '8th St & 5th Ave, Greenwich Village',
        },
        reportedBy: {
          name: 'Marcus Vance',
          phone: '+1 (555) 438-9921',
          isAnonymous: false,
        },
        aiAnalysis: {
          confidence: null,
          detectedCategory: 'ACCIDENT',
          priority: 'CRITICAL',
          department: 'EMS_AMBULANCE',
          hazardType: 'High-Impact Road Collision',
          extractedKeywords: ['airbags', 'injury', 'intersection', 'traffic blocked'],
          recommendedAction: 'Dispatch EMS Ambulance + Traffic Police unit to secure intersection.',
          reasoning: 'Potential traumatic injury and severe traffic blockage at busy intersection.',
        },
        timeline: [
          {
            id: 'TL-4',
            status: 'PENDING',
            timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
            note: 'Report submitted via Mobile App SOS. AI routed to EMS & Police.',
            updatedBy: 'AI Triage Engine',
          },
          {
            id: 'TL-5',
            status: 'ACKNOWLEDGED',
            timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
            note: 'EMS Dispatch routed ALS Medic Unit 07 & Sector Patrol 4B.',
            updatedBy: 'Dispatcher S. Chen (EMS Command)',
          }
        ],
        assignedUnit: {
          id: 'UNIT-MED07',
          name: 'ALS Paramedic Ambulance 07',
          badge: 'EMS-07',
          phone: '+1 (555) 911-0707',
          etaMinutes: 4,
        },
        createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
      },
      {
        id: 'INC-2026-8803',
        title: 'Deep Hazardous Pothole Near School Crossing',
        description: 'Large crater pothole (~1.5 ft wide) in the right lane right next to Lincoln Elementary school crossing. Multiple tires damaged.',
        mediaUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
        mediaType: 'image',
        category: 'CIVIC',
        priority: 'MEDIUM',
        department: 'MUNICIPALITY',
        status: 'PENDING',
        location: {
          lat: 40.7589,
          lng: -73.9851,
          address: 'W 48th St & 7th Ave, Midtown West',
        },
        reportedBy: {
          name: 'Sarah Jenkins',
          phone: '+1 (555) 782-3341',
          isAnonymous: true,
        },
        aiAnalysis: {
          confidence: null,
          detectedCategory: 'CIVIC',
          priority: 'MEDIUM',
          department: 'MUNICIPALITY',
          hazardType: 'Road Surface Damage / Deep Pothole',
          extractedKeywords: ['crater', 'pothole', 'school zone', 'flat tires'],
          recommendedAction: 'Issue Municipal Work Order for asphalt patch crew within 24h.',
          reasoning: 'Moderate safety hazard to school traffic and vehicles. Routed to Department of Transportation / PWD.',
        },
        timeline: [
          {
            id: 'TL-6',
            status: 'PENDING',
            timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
            note: 'Citizen report received. AI categorized as Civic Pothole Hazard.',
            updatedBy: 'AI Triage Engine',
          }
        ],
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      },
      {
        id: 'INC-2026-8804',
        title: 'Water Main Pipe Rupture Flooding Sidewalk',
        description: 'High pressure water gushing out from broken underground main line. Flooding pedestrian pathway and basement entrance.',
        mediaUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80',
        mediaType: 'image',
        category: 'CIVIC',
        priority: 'HIGH',
        department: 'MUNICIPALITY',
        status: 'RESOLVED',
        location: {
          lat: 40.7829,
          lng: -73.9654,
          address: 'E 86th St & Lexington Ave, Upper East Side',
        },
        reportedBy: {
          name: 'David Goldberg',
          phone: '+1 (555) 902-1144',
          isAnonymous: false,
        },
        aiAnalysis: {
          confidence: null,
          detectedCategory: 'CIVIC',
          priority: 'HIGH',
          department: 'MUNICIPALITY',
          hazardType: 'Municipal Water Infrastructure Rupture',
          extractedKeywords: ['water burst', 'flooding', 'main line', 'basement flood'],
          recommendedAction: 'Dispatch Water Utility Emergency Valve Crew to shut off main.',
          reasoning: 'Active water loss and risk of structural water damage.',
        },
        timeline: [
          {
            id: 'TL-7',
            status: 'PENDING',
            timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
            note: 'Water pipe leak reported by citizen with photo.',
            updatedBy: 'AI Triage Engine',
          },
          {
            id: 'TL-8',
            status: 'ACKNOWLEDGED',
            timestamp: new Date(Date.now() - 160 * 60000).toISOString(),
            note: 'Municipal Water Board dispatched Emergency Repair Crew Unit 3.',
            updatedBy: 'Dispatch Officer D. Torres',
          },
          {
            id: 'TL-9',
            status: 'IN_PROGRESS',
            timestamp: new Date(Date.now() - 110 * 60000).toISOString(),
            note: 'Main line isolated. Replacement coupling installed.',
            updatedBy: 'Field Engineer K. Patel',
          },
          {
            id: 'TL-10',
            status: 'RESOLVED',
            timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
            note: 'Pipe repaired, pressure tested normal, road surface restored.',
            updatedBy: 'Supervisor J. Reynolds (Water Dept)',
            proofPhotoUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
          }
        ],
        assignedUnit: {
          id: 'UNIT-CIV3',
          name: 'Municipal Water & Sewer Response Crew 3',
          badge: 'DEP-W3',
          phone: '+1 (555) 311-9988',
        },
        createdAt: new Date(Date.now() - 180 * 60000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 60000).toISOString(),
      }
    ];

    seed.forEach(inc => {
      inc.isDemo = true;
      inc.reportCount = 1;
      inc.aiAnalysis = { ...inc.aiAnalysis, confidence: null, source: 'demo', status: 'demo', needsReview: true,
        reasoning: 'Seeded demonstration scenario; no trained model was used.' };
      this.incidents.set(inc.id, inc);
    });
  }

  public async getAllIncidents(filters?: { department?: string; status?: string; priority?: string }): Promise<Incident[]> {
    const sql = await getDatabase();
    let list: Incident[] = sql
      ? (await sql`SELECT data FROM rapidresq_incidents ORDER BY data->>'createdAt' DESC`).map((row) => row.data as Incident)
      : Array.from(this.incidents.values());

    list = resolveGroupedReports(list);
    if (filters?.department && filters.department !== 'ALL') {
      list = list.filter(i => i.department === filters.department);
    }
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter(i => i.status === filters.status);
    }
    if (filters?.priority && filters.priority !== 'ALL') {
      list = list.filter(i => i.priority === filters.priority);
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getIncidentById(id: string): Promise<Incident | undefined> {
    const sql = await getDatabase();
    const incident = sql ? (await sql`SELECT data FROM rapidresq_incidents WHERE id = ${id}`)[0]?.data as Incident | undefined : this.incidents.get(id);
    if (!incident) return undefined;
    if (incident.duplicate?.status === 'CONFIRMED') {
      const parent = sql ? (await sql`SELECT data FROM rapidresq_incidents WHERE id = ${incident.duplicate.of}`)[0]?.data as Incident | undefined : this.incidents.get(incident.duplicate.of);
      if (parent) return resolveGroupedReports([incident, parent])[0];
    }
    return presentIncident(incident);
  }

  public async createIncident(incident: Incident): Promise<Incident> {
    const sql = await getDatabase();
    if (sql) {
      const rows = await sql`INSERT INTO rapidresq_incidents (id, data)
        VALUES (${incident.id}, ${JSON.stringify(incident)}::jsonb) RETURNING data`;
      return rows[0].data as Incident;
    }
    this.incidents.set(incident.id, incident);
    return incident;
  }

  public async updateIncidentStatus(
    id: string, 
    status: IncidentStatus, 
    note: string, 
    updatedBy: string = 'Authority Dispatcher',
    proofPhotoUrl?: string,
    unit?: AssignedUnit
  ): Promise<Incident | null> {
    const sql = await getDatabase();
    if (sql) {
      const now = new Date().toISOString();
      const changes = { status, updatedAt: now, ...(unit ? { assignedUnit: unit } : {}) };
      const event = { id: `TL-${crypto.randomUUID()}`, status, timestamp: now, note, updatedBy, proofPhotoUrl };
      // Append against the current row in one statement, preserving concurrent notes.
      const rows = await sql`UPDATE rapidresq_incidents SET data = data || ${JSON.stringify(changes)}::jsonb
        || jsonb_build_object('timeline', COALESCE(data->'timeline', '[]'::jsonb) || ${JSON.stringify([event])}::jsonb)
        WHERE id = ${id} RETURNING data`;
      return rows[0]?.data as Incident ?? null;
    }
    const inc = this.incidents.get(id);
    if (!inc) return null;

    inc.status = status;
    inc.updatedAt = new Date().toISOString();

    if (unit) {
      inc.assignedUnit = unit;
    }

    inc.timeline.push({
      id: `TL-${Date.now()}`,
      status,
      timestamp: inc.updatedAt,
      note,
      updatedBy,
      proofPhotoUrl,
    });

    this.incidents.set(id, inc);
    return inc;
  }

  public async getStats() {
    const all = await this.getAllIncidents();
    const list = all.filter(i => i.duplicate?.status !== 'CONFIRMED');
    const criticalCount = list.filter(i => i.priority === 'CRITICAL' && i.status !== 'RESOLVED').length;
    const pendingCount = list.filter(i => i.status === 'PENDING').length;
    const inProgressCount = list.filter(i => i.status === 'IN_PROGRESS' || i.status === 'ACKNOWLEDGED').length;
    const resolvedCount = list.filter(i => i.status === 'RESOLVED').length;

    const byDepartment = {
      FIRE_DEPARTMENT: list.filter(i => i.department === 'FIRE_DEPARTMENT').length,
      POLICE_DEPARTMENT: list.filter(i => i.department === 'POLICE_DEPARTMENT').length,
      EMS_AMBULANCE: list.filter(i => i.department === 'EMS_AMBULANCE').length,
      MUNICIPALITY: list.filter(i => i.department === 'MUNICIPALITY').length,
    };

    return {
      total: list.length,
      criticalActive: criticalCount,
      pending: pendingCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      highActive: list.filter(i => i.priority === 'HIGH' && i.status !== 'RESOLVED').length,
      possibleDuplicates: list.filter(i => i.duplicate?.status === 'POSSIBLE').length,
      totalReports: all.length,
      avgResponseMinutes: (() => {
        const delays = list.flatMap(i => {
          const event = i.timeline.find(t => t.status === 'ACKNOWLEDGED');
          const minutes = event ? (Date.parse(event.timestamp) - Date.parse(i.createdAt)) / 60000 : -1;
          return minutes >= 0 ? [minutes] : [];
        });
        return delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
      })(),
      byDepartment,
    };
  }

  public async reviewDuplicate(id: string, decision: 'CONFIRM' | 'REJECT', reviewedBy: string): Promise<Incident | null> {
    const sql = await getDatabase();
    const now = new Date().toISOString();
    const event = { id: `TL-${crypto.randomUUID()}`, timestamp: now, status: 'PENDING',
      note: decision === 'CONFIRM' ? 'Authority confirmed duplicate. Original report and media retained.' : 'Authority rejected duplicate suggestion; report remains independent.', updatedBy: reviewedBy };
    if (sql) {
      if (decision === 'REJECT') {
        const rows = await sql`UPDATE rapidresq_incidents SET data = data
          || jsonb_build_object('duplicate', (data->'duplicate') || jsonb_build_object('status', 'REJECTED', 'reviewedAt', ${now}::text, 'reviewedBy', ${reviewedBy}::text),
             'updatedAt', ${now}::text, 'timeline', COALESCE(data->'timeline', '[]'::jsonb) || ${JSON.stringify([event])}::jsonb)
          WHERE id = ${id} AND data#>>'{duplicate,status}' = 'POSSIBLE' RETURNING data`;
        return rows[0]?.data as Incident ?? null;
      }
      // Lock both records in a stable order. A single atomic statement makes retries
      // idempotent and prevents lost increments when different reports share a target.
      const rows = await sql`WITH locked AS MATERIALIZED (
          SELECT id, data FROM rapidresq_incidents
          WHERE id = ${id} OR id = (SELECT data#>>'{duplicate,of}' FROM rapidresq_incidents WHERE id = ${id})
          ORDER BY id FOR UPDATE
        ), eligible AS MATERIALIZED (
          SELECT child.id AS child_id, child.data AS child_data, parent.id AS parent_id, parent.data AS parent_data
          FROM locked child JOIN locked parent ON parent.id = child.data#>>'{duplicate,of}'
          WHERE child.id = ${id} AND child.id <> parent.id
            AND child.data#>>'{duplicate,status}' = 'POSSIBLE'
            AND COALESCE(child.data->>'reportCount', '1')::int = 1
            AND COALESCE(parent.data#>>'{duplicate,status}', '') NOT IN ('POSSIBLE', 'CONFIRMED')
            AND parent.data->>'status' <> 'RESOLVED'
        ), parent_update AS (
          UPDATE rapidresq_incidents target SET data = eligible.parent_data
            || jsonb_build_object('reportCount', COALESCE((eligible.parent_data->>'reportCount')::int, 1) + 1,
                 'updatedAt', ${now}::text,
                 'priority', CASE WHEN array_position(ARRAY['LOW','MEDIUM','HIGH','CRITICAL'], eligible.child_data->>'priority')
                   > array_position(ARRAY['LOW','MEDIUM','HIGH','CRITICAL'], eligible.parent_data->>'priority')
                   THEN eligible.child_data->>'priority' ELSE eligible.parent_data->>'priority' END,
                 'timeline', COALESCE(eligible.parent_data->'timeline', '[]'::jsonb)
                   || jsonb_build_array(${JSON.stringify({ ...event, note: `Additional report ${id} confirmed; highest reported priority retained. Review combined evidence.` })}::jsonb))
          FROM eligible WHERE target.id = eligible.parent_id RETURNING target.id
        ) UPDATE rapidresq_incidents target SET data = eligible.child_data
          || jsonb_build_object('duplicate', (eligible.child_data->'duplicate')
               || jsonb_build_object('status', 'CONFIRMED', 'reviewedAt', ${now}::text, 'reviewedBy', ${reviewedBy}::text),
               'updatedAt', ${now}::text, 'timeline', COALESCE(eligible.child_data->'timeline', '[]'::jsonb) || ${JSON.stringify([event])}::jsonb)
          FROM eligible, parent_update WHERE target.id = eligible.child_id RETURNING target.data`;
      return rows[0]?.data as Incident ?? null;
    }
    // No awaits inside the in-memory mutation, so concurrent requests cannot interleave it.
    const child = this.incidents.get(id);
    if (!child || child.duplicate?.status !== 'POSSIBLE') return null;
    const parent = this.incidents.get(child.duplicate.of);
    if (decision === 'CONFIRM') {
      if (!parent || parent.id === id || parent.status === 'RESOLVED' || (child.reportCount ?? 1) !== 1
        || ['POSSIBLE', 'CONFIRMED'].includes(parent.duplicate?.status || '')) return null;
      parent.reportCount = (parent.reportCount ?? 1) + 1;
      const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (order.indexOf(child.priority) > order.indexOf(parent.priority)) parent.priority = child.priority;
      parent.updatedAt = now;
      parent.timeline.push({ ...event, status: parent.status, note: `Additional report ${id} confirmed; highest reported priority retained. Review combined evidence.` });
    }
    child.duplicate = { ...child.duplicate, status: decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED', reviewedAt: now, reviewedBy };
    child.updatedAt = now;
    child.timeline.push({ ...event, status: child.status });
    return child;
  }

  public async resetDemoData() {
    const sql = await getDatabase();
    if (sql) throw new Error('Demo reset is disabled for the shared database to protect submitted reports.');
    this.incidents.clear();
    this.seedInitialData();
  }
}

export const incidentStore = new IncidentStore();
