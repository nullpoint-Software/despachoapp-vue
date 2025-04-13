import { as } from "./client";
const serverip = import.meta.env.VITE_API_SERVER_IP;
interface PermissionsService {
  [level: string]: {
    [permission: string]: boolean;
  };
}
let perms: PermissionsService | null = null;

export async function hasPermission(permissionKey: string) {
  // Get the user's level from localStorage
  await as.getUserInfo();
  const userLevel = localStorage.getItem("level");
  console.log("the level: ", userLevel);

  try {
    const response = await fetch(`${serverip}:5000/permissions.json`);
    perms = await response.json();
    // Optionally cache the result in localStorage
  } catch (error) {
    console.error("Failed to load permissions:", error);
    return false; // Default to false if the request fails
  }
  // Check if userLevel exists and if permissions for that level are defined
  if (perms && userLevel && perms[userLevel]) {
    return perms[userLevel][permissionKey] === true;
  }

  return false; // Default to false if no valid userLevel
}
