import express from 'express';
import {
  DEFAULT_PAGE_CONFIG,
  PageConfig,
  PageRequest,
  renderPDF,
} from '@/render.js';
import { config, renderConfig } from '@/config/config.js';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { requireRenderApiKey } from './middleware/auth.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

app.use(config.NODE_ENV === 'development' ? morgan('dev') : morgan('combined'));

app.use('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    renderConfig: renderConfig,
  });
});

app.post('/api/render/:renderer', requireRenderApiKey, async (req, res) => {
  const renderer = req.params.renderer;
  if (!renderer) {
    return res.status(400).json({ error: 'Missing renderer parameter' });
  }

  const json = req.body;
  const data = json['page']['data'];

  const pageRequest = PageRequest.safeParse(json['page']);
  if (!pageRequest.success) {
    return res.status(400).send({
      status: 'error',
      message: `Invalid page config: ${pageRequest.error}`,
    });
  }

  const pdf = await renderPDF(pageRequest.data, renderer);

  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
