import type { Browser, BrowserContext } from 'puppeteer';
import puppeteer from 'puppeteer';
import { Semaphore } from './lib/semaphore.js';
import { config } from './config/config.js';
import { ConnectionClosedError } from 'puppeteer';

export class BrowserSingleton {
  constructor(slots: number) {
    this.slots = new Semaphore(slots);
  }
  slots: Semaphore;

  private browser: Promise<Browser> | null = null;
  public async instance() {
    if (!this.browser) {
      this.browser = puppeteer.launch({
        headless: true, // or 'new' on newer versions
      });
    }
    return this.browser;
  }

  public async createContext(retryCount = 0): Promise<BrowserContext> {
    await this.slots.acquire();
    try {
      const context = await (await this.instance()).createBrowserContext();
      const originalClose = context.close.bind(context);

      // Patch context.close to release the semaphore when the context is closed
      context.close = (async () => {
        console.log('Closing context');
        await originalClose().catch(() => {});
        this.slots.release();
      }).bind(this);
      return context;
    } catch (error) {
      console.error(error);
      if (error instanceof ConnectionClosedError && retryCount < 1) {
        await (await this.browser)?.close();
        this.browser = null;
        this.slots.release();
        return this.createContext(retryCount + 1);

        // TODO: This kills all other currently running browser tasks
        // TODO: Wait for all running tasks to complete before closing the browser
      }
      this.slots.release();
      throw error;
    }
  }

  public async shutdown() {
    try {
      const b = await this.browser;
      await b?.close();
    } catch {}
    process.exit(0);
  }
}

export const browser = new BrowserSingleton(config.MAX_PARALLEL_CONTEXTS);

process.on('SIGINT', browser.shutdown);
process.on('SIGTERM', browser.shutdown);
