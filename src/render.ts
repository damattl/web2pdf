import { BrowserContext } from 'puppeteer';
import { config, DEFAULT_TIMEZONE, renderConfig } from '@/config/config.js';
import { z } from 'zod';
import { BrowserSingleton } from './browser.js';

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}

export class PDFRenderer {
  context: BrowserContext | null = null;
  browser: BrowserSingleton;

  constructor(browser: BrowserSingleton) {
    this.browser = browser;
  }

  public async abort() {
    console.log('PDFRenderer.abort() called');
    await this.context?.close();
    this.context = null;
  }
  public async render(
    request: z.Infer<typeof PageRequest>,
    renderer: string,
  ): Promise<Uint8Array<ArrayBufferLike>> {
    const json = JSON.stringify(request.data);

    const renderUrl = renderConfig[renderer]?.url;
    if (renderUrl == null) {
      console.error('Renderer not found');
      throw new Error(`INVALID_RENDERER=${renderer}`);
    }

    const cfg = request.config;

    const url = `${renderUrl}?renderer=${renderer}`;
    console.debug(url);

    this.context = await this.browser.createContext();
    const page = await this.context.newPage();

    const timezone = renderConfig[renderer]?.timezone ?? DEFAULT_TIMEZONE;
    if (timezone) {
      page.emulateTimezone(timezone);
    }

    page.evaluateOnNewDocument((renderData) => {
      // @ts-ignore
      window.__RENDER_DATA__ = renderData;
    }, json);

    await page.emulateMediaType('print');

    try {
      const error = Promise.race([
        new Promise((res, rej) =>
          page.once('error', (error) => {
            console.error(error);
            if (error instanceof Error) {
              res(new RenderError(error.message));
            }
          }),
        ),
        new Promise((res, rej) =>
          page.once('pageerror', (error) => {
            console.error(error);
            if (error instanceof Error) {
              res(new RenderError(error.message));
            }
          }),
        ),
      ]);

      console.log('Loading page...');

      const response = await Promise.race([
        page.goto(url, {
          waitUntil: 'networkidle0',
        }),
        error.then((error) => Promise.reject(error)),
      ]);

      if (!response) {
        throw new Error('NAVIGATION_FAILURE');
      }

      if (!response.ok()) {
        console.error(response.status(), response);
        throw new RenderError(`Page loaded with status ${response.status()}`);
      }

      const renderError = await page
        .locator('.render-error')
        .setTimeout(50)
        .map((div) => div.innerHTML as string)
        .wait()
        .catch(() => null);

      if (renderError) {
        console.log(renderError);
        throw new RenderError(renderError);
      }

      console.log('Page loaded');

      await Promise.race([
        page.waitForSelector('#ready'),
        error.then((error) => Promise.reject(error)),
      ]);

      await timeout(1000);
      console.log('Waited for 1 Second');

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: cfg.margin.top,
          bottom: cfg.margin.bottom,
          left: cfg.margin.left,
          right: cfg.margin.right,
        },
        scale: 1,
      });
      await this.context.close().catch(console.warn);

      return pdf;
    } catch (error) {
      await this.context.close().catch(console.warn);
      throw error;
    } finally {
      this.context = null;
    }
  }
}
