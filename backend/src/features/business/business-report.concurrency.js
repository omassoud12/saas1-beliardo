import { AppError } from "../../shared/errors/AppError.js";

export function createReportGenerationGate(limit = 2) {
  let active = 0;
  return {
    async run(task) {
      if (active >= limit) {
        throw new AppError(429, "PDF generation is busy. Please try again shortly.", "REPORT_GENERATION_BUSY");
      }
      active += 1;
      try {
        return await task();
      } finally {
        active -= 1;
      }
    },
  };
}

export const reportGenerationGate = createReportGenerationGate();
