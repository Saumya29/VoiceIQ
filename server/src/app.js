import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './auth/auth.routes.js';
import agentsRoutes from './agents/agents.routes.js';
import testsRoutes from './tests/tests.routes.js';
import optimizationsRoutes from './optimizations/optimizations.routes.js';
import { config } from './config/env.js';

const app = express();
const allowedOrigins = new Set(config.corsOrigins);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

// Allow GHL to embed this app in an iframe (Custom Page).
// frame-ancestors replaces X-Frame-Options and tells browsers which domains can frame us.
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://app.gohighlevel.com https://app.leadconnectorhq.com http://localhost:*"
  );
  next();
});

app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/v1/agents', agentsRoutes);
app.use('/api/v1/tests', testsRoutes);
app.use('/api/v1/optimizations', optimizationsRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

export default app;
