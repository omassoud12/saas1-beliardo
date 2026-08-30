import puppeteer from "puppeteer";
import { existsSync } from "node:fs";
import { AppError } from "../../shared/errors/AppError.js";

const launchOptions = {
  headless: true,
  args: ["--disable-dev-shm-usage"],
  timeout: 30_000,
};

export function resolveBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform !== "win32") return undefined;
  return [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((path) => existsSync(path));
}

export function createPdfRenderer({
  launch = (options) => puppeteer.launch(options),
  timeoutMs = 45_000,
  executablePath = resolveBrowserExecutable(),
} = {}) {
  return async function renderPdf({ html, footerTemplate }, signal) {
    let browser;
    let page;
    let timer;
    let handleExternalAbort;
    const generationController = new AbortController();
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        generationController.abort();
        reject(new AppError(504, "PDF generation timed out", "PDF_GENERATION_TIMEOUT"));
      }, timeoutMs);
    });
    const aborted = new Promise((_, reject) => {
      if (!signal) return;
      handleExternalAbort = () => {
        generationController.abort();
        reject(new AppError(499, "PDF generation was cancelled", "PDF_GENERATION_CANCELLED"));
      };
      if (signal.aborted) handleExternalAbort();
      else signal.addEventListener("abort", handleExternalAbort, { once: true });
    });
    const generation = (async () => {
      browser = await launch({
        ...launchOptions,
        ...(executablePath ? { executablePath } : {}),
        signal: generationController.signal,
      });
      page = await browser.newPage();
      page.setDefaultTimeout(timeoutMs);
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.evaluate(() => document.fonts?.ready);
      return page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate,
        margin: { top: "16mm", right: "12mm", bottom: "20mm", left: "12mm" },
      });
    })();
    try {
      return await Promise.race([generation, timeout, aborted]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const wrapped = new AppError(503, "Unable to generate the PDF report", "PDF_GENERATION_FAILED");
      wrapped.cause = error;
      wrapped.hint = error?.message;
      throw wrapped;
    } finally {
      clearTimeout(timer);
      if (signal && handleExternalAbort) signal.removeEventListener("abort", handleExternalAbort);
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  };
}

export const renderPdf = createPdfRenderer();
