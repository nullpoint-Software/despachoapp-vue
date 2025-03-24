import permissions from "@/assets/permissions.json";
interface PermissionsService {
  [level: string]: {
    [permission: string]: boolean;
  };
}
const perms: PermissionsService = permissions;

export function hasPermission(permissionKey: string) {
  // Get the user's level from localStorage
  const userLevel = localStorage.getItem("level");

  // Check if userLevel exists and if permissions for that level are defined
  if (userLevel && perms[userLevel]) {
    return perms[userLevel][permissionKey] === true;
  }

  return false; // Default to false if no valid userLevel
}
