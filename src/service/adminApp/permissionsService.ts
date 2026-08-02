const serverip = import.meta.env.VITE_API_SERVER_IP;
import axios from "axios";
interface PermissionsService {
  [level: string]: {
    [permission: string]: boolean;
  };
}

interface UserPermissions {
  [id_usuario: string]: {
    [permission: string]: boolean;
  };
}

let perms: PermissionsService | null = null;
// oxlint-disable-next-line no-unused-vars
let userPerms: UserPermissions | null = null;
let loadingPermissions: Promise<void> | null = null;

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function loadPermissions() {
  if (perms && userPerms) return;
  if (!loadingPermissions) {
    loadingPermissions = (async () => {
      const [globalRes, userRes] = await Promise.all([
        fetch(`${serverip}/permissions`, { headers: authHeaders() }),
        fetch(`${serverip}/permissions/user`, { headers: authHeaders() }),
      ]);
      if (!globalRes.ok || !userRes.ok) throw new Error(`Permissions request failed (${globalRes.status}/${userRes.status})`);
      perms = await globalRes.json();
      userPerms = await userRes.json();
    })().finally(() => { loadingPermissions = null; });
  }
  await loadingPermissions;
}

export async function hasPermission(permissionKey: string): Promise<boolean> {

  const userLevel = localStorage.getItem("level");
// oxlint-disable-next-line no-unused-vars
  const userId = localStorage.getItem("userid");

  try {
    await loadPermissions();
  } catch (error) {
    console.error("Failed to load permissions:", error);
    return false;
  }

  if (userPerms && userId && userPerms[userId] && userPerms[userId][permissionKey] !== undefined) {
    return userPerms[userId][permissionKey] === true;
  }

  // Fallback to role-based permissions

  if (perms && userLevel && perms[userLevel]) {
    return perms[userLevel][permissionKey] === true;
  }

  return false;
}

export async function updatePermissions(newPerms: object) {
  await fetch(`${serverip}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(newPerms)
  });
  perms = null;
}

export async function getPermissions(): Promise<any> {
  try {
      const response = await axios.get(`${serverip}/permissions`, { headers: authHeaders() });
      return response.data;
  } catch (error) {
      console.error("Error fetching permissions:", error);
      throw error;
  }
}

export async function getUserPermissions(): Promise<any> {
  try {
      const response = await axios.get(`${serverip}/permissions/user`, { headers: authHeaders() });
      return response.data;
  } catch (error) {
      console.error("Error fetching permissions:", error);
      throw error;
  }
}

export async function updateUserPermissions(newUserPerms: object) {
  await fetch(`${serverip}/permissions/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(newUserPerms)
  });
  userPerms = null;
}
