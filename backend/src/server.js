import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// The API is internal-only (fronted by the Next.js session proxy); refuse to
// boot without the shared secret rather than silently rejecting every request.
if (!process.env.INTERNAL_API_SECRET) {
  console.error('FATAL: INTERNAL_API_SECRET is not set. Add it to backend/.env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Credify API is running' });
});

import refundRoutes from './routes/refund.js';
import documentRoutes from './routes/document.js';
import idRoutes from './routes/id.js';
import reviewRoutes from './routes/review.js';
import userRoutes from './routes/user.js';
import profileRoutes from './routes/profile.js';
import dashboardRoutes from './routes/dashboard.js';
import extensionRoutes from './routes/extension.js';
import trustCanvasRoutes from './routes/trustcanvas.js';
import { requireInternal, rateLimit } from './middleware/internal.js';

// The extension bridge is the one deliberately public route: the Chrome
// extension is zero-config and holds no credentials, so it is gated by IP
// rate limiting instead of the internal secret.
app.use('/api/v1/extension', rateLimit({ windowMs: 60_000, max: 30 }), extensionRoutes);

// Everything else is reachable only through the Next.js proxy, which owns
// session auth and identity injection.
app.use('/api/v1/refund', requireInternal, refundRoutes);
app.use('/api/v1/document', requireInternal, documentRoutes);
app.use('/api/v1/id', requireInternal, idRoutes);
app.use('/api/v1/review', requireInternal, reviewRoutes);
app.use('/api/v1/user', requireInternal, userRoutes);
app.use('/api/v1/profile', requireInternal, profileRoutes);
app.use('/api/v1/dashboard', requireInternal, dashboardRoutes);
app.use('/api/v1/trustcanvas', requireInternal, trustCanvasRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
