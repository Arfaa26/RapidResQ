import { Incident, IncidentStatus, AssignedUnit } from '../types/index.js';

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
          name: 'Olivia Smith',
          phone: '+1 (555) 019-2834',
          isAnonymous: false,
        },
        aiAnalysis: {
          confidence: 0.98,
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
          confidence: 0.95,
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
          confidence: 0.94,
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
          confidence: 0.96,
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

    seed.forEach(inc => this.incidents.set(inc.id, inc));
  }

  public getAllIncidents(filters?: { department?: string; status?: string; priority?: string }): Incident[] {
    let list = Array.from(this.incidents.values());

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

  public getIncidentById(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  public createIncident(incident: Incident): Incident {
    this.incidents.set(incident.id, incident);
    return incident;
  }

  public updateIncidentStatus(
    id: string, 
    status: IncidentStatus, 
    note: string, 
    updatedBy: string = 'Authority Dispatcher',
    proofPhotoUrl?: string,
    unit?: AssignedUnit
  ): Incident | null {
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

  public getStats() {
    const list = Array.from(this.incidents.values());
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
      avgResponseMinutes: 4.2,
      byDepartment,
    };
  }

  public resetDemoData() {
    this.incidents.clear();
    this.seedInitialData();
  }
}

export const incidentStore = new IncidentStore();
