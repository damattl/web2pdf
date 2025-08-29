import puppeteer from 'puppeteer';
import { config, renderConfig } from '@/config/config.js';

import { z } from 'zod';

export const PageConfig = z.object({
  margin: z.object({
    top: z.string().default('1cm'),
    bottom: z.string().default('1cm'),
    left: z.string().default('1cm'),
    right: z.string().default('1cm'),
  }),
});

export const DEFAULT_PAGE_CONFIG = PageConfig.parse({
  margin: {
    top: '1cm',
    bottom: '1cm',
    left: '1cm',
    right: '1cm',
  },
});

export const PageRequest = z.object({
  data: z.any(),
  config: PageConfig.default(DEFAULT_PAGE_CONFIG),
});

export async function renderPDF(
  request: z.Infer<typeof PageRequest>,
  renderer: string,
): Promise<Uint8Array<ArrayBufferLike>> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const cfg = request.config;

  const json = JSON.stringify(request.data);
  const b64 = Buffer.from(json, 'utf8').toString('base64');

  const renderUrl = renderConfig[renderer]?.url;
  if (renderUrl == null) {
    throw new Error(`Renderer ${renderer} not found`);
  }

  const url = `${renderUrl}?data=${b64}&renderer=${renderer}`;
  console.log(url);

  await page.goto(url, {
    waitUntil: 'networkidle2',
  });
  await page.emulateMediaType('screen');
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: cfg.margin.top,
      bottom: cfg.margin.bottom,
      left: cfg.margin.left,
      right: cfg.margin.right,
    },
  });
  await browser.close();

  return pdf;
}
