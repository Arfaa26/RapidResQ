import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { incidentStore } from './services/incidentStore.js';
import { triageIncident } from './services/aiTriage.js';
import { Incident, IncidentStatus, AssignedUnit } from './types/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
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
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `report-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// --- API ROUTES ---

// 1. Get all incidents with optional filters
app.get('/api/incidents', (req: Request, res: Response) => {
  const { department, status, priority } = req.query;
  const incidents = incidentStore.getAllIncidents({
    department: department as string,
    status: status as string,
    priority: priority as string,
  });
  res.json({ success: true, count: incidents.length, incidents });
});

// 2. Get single incident by ID
app.get('/api/incidents/:id', (req: Request, res: Response) => {
  const incidentId = req.params.id as string;
  const incident = incidentStore.getIncidentById(incidentId);
  if (!incident) {
    return res.status(404).json({ success: false, message: 'Incident not found' });
  }
  res.json({ success: true, incident });
});

// 3. AI Triage Preview (for live instant feedback in the Mobile App)
app.post('/api/ai/preview', upload.single('media'), async (req: Request, res: Response) => {
  try {
    const { title, description, categoryHint } = req.body;
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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
      isAnonymous,
      isEmergencySOS,
    } = req.body;

    let mediaUrl: string | undefined;
    let imageBuffer: Buffer | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
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
    if (isEmergencySOS === 'true' || isEmergencySOS === true) {
      aiAnalysis.priority = 'CRITICAL';
    }

    const newId = `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const incident: Incident = {
      id: newId,
      title: title || `${aiAnalysis.hazardType} at ${address ? address.split(',')[0] : 'Current Location'}`,
      description: description || 'Citizen reported an urgent incident.',
      mediaUrl,
      mediaType: req.file?.mimetype.startsWith('video') ? 'video' : 'image',
      category: aiAnalysis.detectedCategory,
      priority: aiAnalysis.priority,
      department: aiAnalysis.department,
      status: 'PENDING',
      location: {
        lat: parseFloat(lat) || 40.7128,
        lng: parseFloat(lng) || -74.0060,
        address: address || 'Downtown Metropolitan Area',
      },
      reportedBy: {
        name: reporterName || 'Olivia Smith',
        phone: reporterPhone || '+1 (555) 019-2834',
        isAnonymous: isAnonymous === 'true' || isAnonymous === true,
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

    const saved = incidentStore.createIncident(incident);
    res.status(201).json({ success: true, incident: saved });
  } catch (err: any) {
    console.error('Error creating incident:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Update Incident Status (From Authority Command Center)
app.patch('/api/incidents/:id/status', upload.single('proofPhoto'), (req: Request, res: Response) => {
  try {
    const incidentId = req.params.id as string;
    const { status, note, updatedBy, unitName, unitBadge, unitPhone, etaMinutes } = req.body;
    
    let proofPhotoUrl: string | undefined;
    if (req.file) {
      proofPhotoUrl = `/uploads/${req.file.filename}`;
    }

    let unit: AssignedUnit | undefined;
    if (unitName) {
      unit = {
        id: `UNIT-${Date.now().toString().slice(-4)}`,
        name: unitName,
        badge: unitBadge || 'DISPATCH-01',
        phone: unitPhone || '+1 (555) 911-0000',
        etaMinutes: etaMinutes ? parseInt(etaMinutes, 10) : undefined,
      };
    }

    const updated = incidentStore.updateIncidentStatus(
      incidentId,
      status as IncidentStatus,
      note || `Status changed to ${status}`,
      updatedBy || 'Central Dispatch Command',
      proofPhotoUrl,
      unit
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    res.json({ success: true, incident: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Real-Time Stats Overview
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = incidentStore.getStats();
  res.json({ success: true, stats });
});

// 7. Reset / Seed Demo
app.post('/api/seed', (_req: Request, res: Response) => {
  incidentStore.resetDemoData();
  res.json({ success: true, message: 'Demo data reseeded' });
});

// Serve frontend in production if built
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 RapidResQ Incident & Dispatch Backend running on http://localhost:${PORT}`);
});
