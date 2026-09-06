export type IncidentCategory = 
  | 'FIRE' 
  | 'ACCIDENT' 
  | 'MEDICAL' 
  | 'CRIME' 
  | 'CIVIC' 
  | 'HAZARD';

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DepartmentType = 
  | 'FIRE_DEPARTMENT' 
  | 'POLICE_DEPARTMENT' 
  | 'EMS_AMBULANCE' 
  | 'MUNICIPALITY';

export type IncidentStatus = 
  | 'PENDING' 
  | 'ACKNOWLEDGED' 
  | 'IN_PROGRESS' 
  | 'RESOLVED';

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

export interface AIAnalysisResult {
  confidence: number;
  detectedCategory: IncidentCategory;
  priority: PriorityLevel;
  department: DepartmentType;
  hazardType: string;
  extractedKeywords: string[];
  recommendedAction: string;
  reasoning: string;
}

export interface TimelineEvent {
  id: string;
  status: IncidentStatus;
  timestamp: string;
  note: string;
  updatedBy: string;
  proofPhotoUrl?: string;
}

export interface AssignedUnit {
  id: string;
  name: string;
  badge: string;
  phone: string;
  etaMinutes?: number;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  category: IncidentCategory;
  priority: PriorityLevel;
  department: DepartmentType;
  status: IncidentStatus;
  location: LocationData;
  reportedBy: {
    name: string;
    phone: string;
    isAnonymous: boolean;
  };
  aiAnalysis: AIAnalysisResult;
  timeline: TimelineEvent[];
  assignedUnit?: AssignedUnit;
  createdAt: string;
  updatedAt: string;
}
