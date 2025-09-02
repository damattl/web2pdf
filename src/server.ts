import express from 'express';
import {
  DEFAULT_PAGE_CONFIG,
  PageConfig,
  PageRequest,
  PDFRenderer,
} from '@/render.js';
import { config, renderConfig } from '@/config/config.js';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { requireRenderApiKey } from './middleware/auth.js';
import { browser } from './browser.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / server-to-server
      if (config.CORS_ORIGINS.includes('*')) return cb(null, true); // allow all
      if (config.CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
);

app.use(compression());
app.use(express.json());

app.use(config.NODE_ENV === 'development' ? morgan('dev') : morgan('combined'));

app.use('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    renderConfig: config.NODE_ENV === 'development' ? renderConfig : 'redacted',
  });
});

app.post('/api/render/:renderer', requireRenderApiKey, async (req, res) => {
  const rendererType = req.params.renderer;
  if (!rendererType) {
    return res.status(400).json({ error: 'Missing renderer parameter' });
  }

  const json = req.body;

  const pageRequest = PageRequest.safeParse(json['page']);
  if (!pageRequest.success) {
    return res.status(400).send({
      status: 'error',
      message: `Invalid page config: ${pageRequest.error}`,
    });
  }

  const renderer = new PDFRenderer(browser);

  res.on('close', () => {
    renderer.abort();
  });

  try {
    const pdf = await renderer.render(pageRequest.data, rendererType);

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (error: any) {
    if (error.name == 'RenderError') {
      return res.status(500).send({
        status: 'render-error',
        message: 'Failed to render the pdf',
        reason: error.message,
      });
    }
    console.error(error);
    res.status(500).send({
      status: 'error',
      message: 'Internal server error',
    });
  }
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
