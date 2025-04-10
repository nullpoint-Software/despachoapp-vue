import permissions from "@/assets/permissions.json";
import { as } from "./client";
interface PermissionsService {
  [level: string]: {
    [permission: string]: boolean;
  };
}
const perms: PermissionsService = permissions;

export async function hasPermission(permissionKey: string) {
  // Get the user's level from localStorage
  await as.getUserInfo();
  const userLevel = localStorage.getItem("level");
  console.log("the level: ",userLevel);
  
  // Check if userLevel exists and if permissions for that level are defined
  if (userLevel && perms[userLevel]) {
    return perms[userLevel][permissionKey] === true;
  }

  return false; // Default to false if no valid userLevel
}
