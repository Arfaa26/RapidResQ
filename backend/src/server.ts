import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { incidentStore } from './services/incidentStore.js';
import { triageIncident } from './services/aiTriage.js';
import { getDatabase, isDatabaseConfigured } from './services/database.js';
import { readMedia, saveMedia } from './services/mediaStore.js';
import { Incident, IncidentStatus, AssignedUnit } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: [path.join(__dirname, '../.env'), '.env'], quiet: true });

const app = express();
const isVercel = Boolean(process.env.VERCEL);
const configuredPort = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 5000;
const validStatuses = new Set<IncidentStatus>(['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED']);
const uploadExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/quicktime', '.mov'],
]);

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unexpected server error';

const removeUploadedFile = (file?: Express.Multer.File) => {
  if (!file?.path) return;
  fs.rm(file.path, { force: true }, (error) => {
    if (error) console.warn(`Unable to remove temporary upload ${file.filename}:`, error);
  });
};

const parseCoordinate = (value: unknown, min: number, max: number) => {
  if (typeof value === 'string' && !value.trim()) return undefined;
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
};

const parsePositiveInteger = (value: unknown) => {
  const parsed = typeof value === 'string' || typeof value === 'number'
    ? Number.parseInt(String(value), 10)
    : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseAccuracy = (value: unknown) => {
  if (typeof value === 'string' && !value.trim()) return undefined;
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
};

const parseTimestamp = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
};

// Vercel Functions have a read-only deployment filesystem; /tmp is writable for
// transient uploads. Local development keeps uploads inside the backend folder.
const uploadsDir = isVercel
  ? path.join(os.tmpdir(), 'rapidresq-uploads')
  : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = uploadExtensions.get(file.mimetype) || '.bin';
    cb(null, `report-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // Keep multipart requests below the Vercel function payload limit.
  fileFilter: (_req, file, cb) => {
    if (uploadExtensions.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image and video uploads are supported.'));
  },
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((_req: Request, res: Response, next: express.NextFunction) => {
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  next();
});
app.use('/uploads', express.static(uploadsDir));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// --- API ROUTES ---

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const sql = await getDatabase();
    if (sql) await sql`SELECT 1`;
    res.json({ success: true, status: 'ok', storage: sql ? 'postgres' : 'local-demo', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ success: false, error: 'Database unavailable. Check the database connection and redeploy.' });
  }
});

app.get('/api/media/:id', async (req: Request, res: Response) => {
  const media = await readMedia(req.params.id as string);
  if (!media) return res.status(404).json({ success: false, error: 'Attachment not found.' });
  res.type(media.mimeType).send(media.content);
});

// 1. Get all incidents with optional filters
app.get('/api/incidents', async (req: Request, res: Response) => {
  const { department, status, priority } = req.query;
  const incidents = await incidentStore.getAllIncidents({
    department: department as string,
    status: status as string,
    priority: priority as string,
  });
  res.json({ success: true, count: incidents.length, incidents });
});

// 2. Get single incident by ID
app.get('/api/incidents/:id', async (req: Request, res: Response) => {
  const incidentId = req.params.id as string;
  const incident = await incidentStore.getIncidentById(incidentId);
  if (!incident) {
    return res.status(404).json({ success: false, message: 'Incident not found' });
  }
  res.json({ success: true, incident });
});

// 3. AI Triage Preview (for live instant feedback in the Mobile App)
app.post('/api/ai/preview', upload.single('media'), async (req: Request, res: Response) => {
  try {
    const { title, description, categoryHint } = req.body ?? {};
    let imageBuffer: Buffer | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype;
    }

    const aiResult = await triageIncident({
      title,
      description: description || '',
      categoryHint,
      imageBuffer,
      mimeType,
    });

    res.json({ success: true, aiAnalysis: aiResult });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  } finally {
    // Preview uploads are temporary; only submitted incident media is retained.
    removeUploadedFile(req.file);
  }
});

// 4. Submit New Incident (From Citizen Mobile App or SOS)
app.post('/api/incidents', upload.single('media'), async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      categoryHint,
      lat,
      lng,
      address,
      reporterName,
      reporterPhone,
      isEmergencySOS,
      accuracyMeters,
      capturedAt,
      locationSource,
    } = req.body ?? {};

    const emergencySos = isEmergencySOS === 'true' || isEmergencySOS === true;
    if (!emergencySos && !req.file && !String(title || '').trim() && !String(description || '').trim()) {
      removeUploadedFile(req.file);
      return res.status(400).json({ success: false, error: 'Add a title, description, or media file.' });
    }

    const latitude = parseCoordinate(lat, -90, 90);
    const longitude = parseCoordinate(lng, -180, 180);
    const gpsAccuracy = parseAccuracy(accuracyMeters);
    const gpsCapturedAt = parseTimestamp(capturedAt);
    const isGpsLocation = locationSource === 'GPS';

    if (latitude === undefined || longitude === undefined || locationSource === 'FALLBACK') {
      removeUploadedFile(req.file);
      return res.status(400).json({ success: false, error: 'Valid device coordinates are required. Refresh GPS and try again.' });
    }

    if (isGpsLocation && (
      latitude === undefined
      || longitude === undefined
      || gpsAccuracy === undefined
      || gpsCapturedAt === undefined
      || Date.now() - Date.parse(gpsCapturedAt) > 120_000
      || Date.parse(gpsCapturedAt) > Date.now() + 30_000
    )) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        error: 'A valid live GPS fix with accuracy and capture time is required.',
      });
    }

    let mediaUrl: string | undefined;
    let imageBuffer: Buffer | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype;
    }

    // Run AI Triage Engine
    const aiAnalysis = await triageIncident({
      title: title || (isEmergencySOS === 'true' ? 'Emergency SOS Triggered' : 'Citizen Incident Report'),
      description: description || 'Immediate assistance requested by citizen.',
      categoryHint,
      imageBuffer,
      mimeType,
    });

    // If SOS triggered explicitly, ensure priority is CRITICAL
    if (emergencySos) {
      aiAnalysis.priority = 'CRITICAL';
    }
    if (req.file) mediaUrl = await saveMedia(req.file);

    const newId = `INC-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const incident: Incident = {
      id: newId,
      title: title || `${aiAnalysis.hazardType} at ${address ? address.split(',')[0] : 'Current Location'}`,
      description: description || 'Citizen reported an urgent incident.',
      mediaUrl,
      mediaType: req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : undefined,
      category: aiAnalysis.detectedCategory,
      priority: aiAnalysis.priority,
      department: aiAnalysis.department,
      status: 'PENDING',
      location: {
        lat: latitude ?? 40.7128,
        lng: longitude ?? -74.0060,
        address: address || 'Downtown Metropolitan Area',
        accuracyMeters: gpsAccuracy,
        capturedAt: gpsCapturedAt,
        source: isGpsLocation ? 'GPS' : undefined,
      },
      reportedBy: {
        name: reporterName || 'Arfa Altaf',
        phone: reporterPhone || '+1 (555) 019-2834',
        isAnonymous: false,
      },
      aiAnalysis,
      timeline: [
        {
          id: `TL-${Date.now()}`,
          status: 'PENDING',
          timestamp: now,
          note: `Report submitted. AI classified as ${aiAnalysis.priority} ${aiAnalysis.detectedCategory} and routed to ${aiAnalysis.department.replace('_', ' ')}.`,
          updatedBy: 'AI Triage & Router',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const saved = await incidentStore.createIncident(incident);
    res.status(201).json({ success: true, incident: saved });
  } catch (error: unknown) {
    removeUploadedFile(req.file);
    console.error('Error creating incident:', error);
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

// 5. Update Incident Status (From Authority Command Center)
app.patch('/api/incidents/:id/status', upload.single('proofPhoto'), async (req: Request, res: Response) => {
  try {
    const incidentId = req.params.id as string;
    const { status, note, updatedBy, unitName, unitBadge, unitPhone, etaMinutes } = req.body ?? {};

    if (!validStatuses.has(status as IncidentStatus)) {
      removeUploadedFile(req.file);
      return res.status(400).json({ success: false, error: 'Invalid incident status.' });
    }
    if (!await incidentStore.getIncidentById(incidentId)) {
      removeUploadedFile(req.file);
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    
    let proofPhotoUrl: string | undefined;
    if (req.file) {
      proofPhotoUrl = await saveMedia(req.file);
    }

    let unit: AssignedUnit | undefined;
    if (unitName) {
      unit = {
        id: `UNIT-${Date.now().toString().slice(-4)}`,
        name: unitName,
        badge: unitBadge || 'DISPATCH-01',
        phone: unitPhone || '+1 (555) 911-0000',
        etaMinutes: parsePositiveInteger(etaMinutes),
      };
    }

    const updated = await incidentStore.updateIncidentStatus(
      incidentId,
      status as IncidentStatus,
      note || `Status changed to ${status}`,
      updatedBy || 'Central Dispatch Command',
      proofPhotoUrl,
      unit
    );

    if (!updated) {
      removeUploadedFile(req.file);
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    res.json({ success: true, incident: updated });
  } catch (error: unknown) {
    removeUploadedFile(req.file);
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

// 6. Real-Time Stats Overview
app.get('/api/stats', async (_req: Request, res: Response) => {
  const stats = await incidentStore.getStats();
  res.json({ success: true, stats });
});

// 7. Reset / Seed Demo
app.post('/api/seed', async (_req: Request, res: Response) => {
  if (isDatabaseConfigured() || isVercel) {
    return res.status(403).json({ success: false, error: 'Demo reset is disabled for the shared database.' });
  }
  await incidentStore.resetDemoData();
  res.json({ success: true, message: 'Demo data reseeded' });
});

app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Upload is too large. The maximum file size is 4 MB.'
      : error.message;
    res.status(400).json({ success: false, error: message });
    return;
  }

  res.status(400).json({ success: false, error: errorMessage(error) });
});

// Serve frontend in production if built
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req: Request, res: Response, next: express.NextFunction) => {
    if (req.method === 'GET' && req.accepts('html')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
      return;
    }
    next();
  });
}

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`RapidResQ Incident & Dispatch Backend running on http://localhost:${PORT}`);
  });
}

export default app;
