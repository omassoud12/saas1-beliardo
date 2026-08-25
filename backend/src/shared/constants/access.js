export function permissionsForAccess({ role, isPlatformAdmin = false, active = false }) {
  if (isPlatformAdmin) return {
    platformAdministration: true,
    operateSessions: false,
    viewAnalytics: false,
    manageStations: false,
    manageEmployees: false,
    manageTenantSettings: false,
  };
  const isOwner = active && role === "owner";
  const isEmployee = active && role === "employee";
  return {
    platformAdministration: false,
    operateSessions: isOwner || isEmployee,
    viewAnalytics: isOwner,
    manageStations: isOwner,
    manageEmployees: isOwner,
    manageTenantSettings: isOwner,
  };
}
