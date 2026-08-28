const reportTypes = new Set(["daily", "monthly", "yearly"]);
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateBusinessReportId(request) {
  return uuidPattern.test(request.params.reportId ?? "")
    ? { success: true, data: { reportId: request.params.reportId } }
    : { success: false, errors: ["reportId must be a UUID"] };
}

function validYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function validDate(value) {
  const match = typeof value === "string" ? value.match(datePattern) : null;
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function cleanText(value, field, maximum, errors, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${field} is required`);
    return "";
  }
  if (typeof value !== "string") {
    errors.push(`${field} must be text`);
    return "";
  }
  const result = value.trim();
  if (required && !result) errors.push(`${field} is required`);
  if (result.length > maximum) errors.push(`${field} must be ${maximum} characters or fewer`);
  return result.slice(0, maximum);
}

export function validateBusinessReport(request) {
  const body = request.body ?? {};
  const errors = [];
  const reportType = body.reportType;
  if (!reportTypes.has(reportType)) errors.push("reportType must be daily, monthly, or yearly");

  const year = validYear(body.year);
  const month = Number(body.month);
  const date = body.date;
  if (reportType === "daily" && !validDate(date)) errors.push("date must be a valid YYYY-MM-DD date");
  if (["monthly", "yearly"].includes(reportType) && !year) errors.push("year must be between 2000 and 2100");
  if (reportType === "monthly" && (!Number.isInteger(month) || month < 1 || month > 12)) {
    errors.push("month must be between 1 and 12");
  }

  const title = cleanText(body.title, "title", 120, errors);
  const notes = cleanText(body.notes, "notes", 1000, errors);
  const rawSections = body.sections;
  if (rawSections !== undefined && (typeof rawSections !== "object" || rawSections === null || Array.isArray(rawSections))) {
    errors.push("sections must be an object");
  }
  const sections = {};
  for (const key of ["summary", "charts", "categoryBreakdown", "detailsTable"]) {
    const value = rawSections?.[key];
    if (value !== undefined && typeof value !== "boolean") errors.push(`sections.${key} must be true or false`);
    sections[key] = value ?? true;
  }
  if (!Object.values(sections).some(Boolean)) errors.push("At least one report section must be included");

  const language = body.language ?? "en";
  if (!["en", "ar"].includes(language)) errors.push("language must be en or ar");
  return errors.length ? { success: false, errors } : {
    success: true,
    data: {
      reportType,
      ...(reportType === "daily" ? { date } : {}),
      ...(["monthly", "yearly"].includes(reportType) ? { year } : {}),
      ...(reportType === "monthly" ? { month } : {}),
      title,
      notes,
      sections,
      language,
    },
  };
}
