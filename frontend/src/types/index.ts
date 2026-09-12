export type IncidentCategory = 
  | 'FLOOD'
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
  accuracyMeters?: number;
  capturedAt?: string;
  source?: 'GPS' | 'FALLBACK';
}

export interface AIAnalysisResult {
  disaster?: DisasterPrediction;
  video?: VideoPrediction;
  objects?: ObjectEvidence;
  priorityCode?: string;
  confidence: number | null;
  source?: 'ml' | 'manual_review' | 'demo' | 'legacy';
  status?: string;
  needsReview?: boolean;
  image?: ModelPrediction;
  text?: ModelPrediction;
  imageHash?: string | null;
  latencyMs?: number;
  fusion?: { version: string; score: number | null; isProbability: false; steps: string[]; context?: { populatedArea?: boolean; source?: string } };
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
  reportCount?: number;
  reportText?: { title: string; description: string };
  isDemo?: boolean;
  duplicateCheck?: DuplicateCheck;
  duplicate?: { status: 'POSSIBLE' | 'CONFIRMED' | 'REJECTED'; of: string; match: DuplicateMatch; reviewedAt?: string; reviewedBy?: string };
  timeline: TimelineEvent[];
  assignedUnit?: AssignedUnit;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  total: number;
  criticalActive: number;
  pending: number;
  inProgress: number;
  resolved: number;
  avgResponseMinutes: number | null;
  highActive: number;
  possibleDuplicates: number;
  totalReports: number;
  byDepartment: {
    FIRE_DEPARTMENT: number;
    POLICE_DEPARTMENT: number;
    EMS_AMBULANCE: number;
    MUNICIPALITY: number;
  };
}

export interface ModelPrediction {
  inferenceMode?: 'pretrained_zero_shot' | 'pretrained_embeddings';
  trainedOnRapidResQ?: boolean;
  scoreType?: string;
  calibrated?: boolean;
  uncertain?: boolean;
  priorityUncertain?: boolean;
  explanation?: string;
  explanationStatus?: string;
  hypotheses?: Array<{ label: string; description: string; score: number }>;
  status: string;
  modelVersion?: string;
  label?: string;
  priority?: PriorityLevel;
  confidence?: number;
  probabilities?: Record<string, number> | null;
  top3?: Array<{ label: string; probability: number }>;
  severityScore?: number;
  features?: Array<{ feature: string; contribution: number }>;
  category?: IncidentCategory;
  categoryProbabilities?: Record<string, number>;
  gradCam?: string | null;
  latencyMs?: number | null;
}
export interface DuplicateMatch {
  incidentId: string;
  distanceMeters: number;
  timeDifferenceMinutes: number;
  textSimilarity: number;
  imageHashDistance: number | null;
  locationUncertain: boolean;
  reason: string;
}
export interface DuplicateCheck {
  semanticCandidatesTruncated?: boolean;
  semanticCandidatesChecked?: number;
  semanticModel?: { status: string; modelVersion?: string };
  status: 'checked' | 'unavailable';
  matches: DuplicateMatch[];
  method: string;
  candidatesTruncated?: boolean;
}
export interface Hotspot {
  id: string; lat: number; lng: number; radiusMeters: number; count: number;
  mainCategory: string; categories: Record<string, number>; incidentIds: string[];
}
export interface HotspotResult {
  status: string; days: number; incidentCount: number; noiseCount: number;
  hotspots: Hotspot[]; trends: Array<{ date: string; count: number }>;
  radiusMeters: number; minSamples: number; generatedAt: string; forecast: false;
  truncated?: boolean; excludedDemoCount?: number;
}
export interface EvaluationMetrics {
  accuracy: number; precision: number; recall: number; f1: number; averaging: string;
  labels: string[]; confusionMatrix: number[][];
  perClass: Record<string, { precision: number; recall: number; 'f1-score': number; support: number }>;
}
export interface EvaluationResult {
  status: string;
  model: { status: string; modelVersion?: string | null; inferenceMode?: string; trainedOnRapidResQ?: boolean };
  evaluation: null | {
    modelVersion: string; algorithm: string; split: string; sampleCount: number;
    evaluatedAt: string; manifestSha256: string; metrics: Record<string, EvaluationMetrics>;
    coverage?: number; acceptedAccuracy?: number | null; abstentionPolicy?: string;
    latencyMs?: { mean: number; p50: number; p95: number; scope: string }; abstentionCount: number;
  };
}

export interface DisasterPrediction {
  status: string; dataset: 'MEDIC'; model: string; modelVersion?: string;
  incidentType: string | null; candidateType?: string; predictedLabel?: string;
  confidence: number | null; threshold?: number; lowConfidence?: boolean;
  probabilities?: Record<string, number>; needsReview: boolean; message?: string;
}
export interface VideoPrediction {
  status: string; method: string; durationSeconds?: number;
  sampledFrameCount: number; analyzedFrameCount: number; audioAnalyzed: boolean;
  disagreement?: boolean; uncertain?: boolean; explanation: string;
  frames: Array<{ timestampSeconds: number; status: string; label?: string; confidence?: number; uncertain: boolean }>;
  eventModel?: { status: string; label?: string; anomalyScore?: number; explanation?: string };
}
export interface ObjectEvidence {
  status: string; modelVersion: string; explanation: string;
  frames: Array<{ timestampSeconds?: number; detections: Array<{ label: string; confidence: number; box: number[] }> }>;
}
