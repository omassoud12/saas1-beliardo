import { businessReportService } from "./business-report.service.js";

export async function generateBusinessReport(request, response, next) {
  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  request.once("aborted", handleAbort);
  try {
    const report = await businessReportService.generate({
      businessId: request.auth.businessId,
      userId: request.auth.user.id,
      timezone: request.auth.timezone,
      config: request.validated,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return undefined;
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(report.buffer.length),
    });
    return response.status(200).send(report.buffer);
  } catch (error) {
    if (controller.signal.aborted) return undefined;
    return next(error);
  } finally {
    request.removeListener("aborted", handleAbort);
  }
}

export async function listBusinessReports(request, response, next) {
  try {
    const data = await businessReportService.list({
      businessId: request.auth.businessId,
      timezone: request.auth.timezone,
    });
    return response.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function downloadSavedBusinessReport(request, response, next) {
  try {
    const report = await businessReportService.download({
      businessId: request.auth.businessId,
      reportId: request.validated.reportId,
    });
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(report.buffer.length),
    });
    return response.status(200).send(report.buffer);
  } catch (error) {
    return next(error);
  }
}
