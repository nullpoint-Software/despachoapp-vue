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

export async function hasPermission(permissionKey: string): Promise<boolean> {

  const userLevel = localStorage.getItem("level");
// oxlint-disable-next-line no-unused-vars
  const userId = localStorage.getItem("userid");

  try {
    const [globalRes, userRes] = await Promise.all([
      fetch(`${serverip}/permissions`),
      fetch(`${serverip}/user_permissions`)
    ]);
    
    
    perms = await globalRes.json();
    userPerms = await userRes.json();
    console.log("got global perms ",perms);
  } catch (error) {
    console.error("Failed to load permissions:", error);
    return false;
  }

  // // First check user-level permissions
  // if (userPerms && userId && userPerms[userId] && userPerms[userId][permissionKey] !== undefined) {
  //   return userPerms[userId][permissionKey] === true;
  // }

  // Fallback to role-based permissions
  console.log("key: "+permissionKey)
  
  if (perms && userLevel && perms[userLevel]) {
    return perms[userLevel][permissionKey] === true;
  }

  return false;
}

export async function updatePermissions(newPerms: object) {
  await fetch(`${serverip}/permissions`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newPerms)
  });
}

export async function getPermissions(): Promise<any> {
  try {
      const response = await axios.get(`${serverip}/permissions`);
      console.log("perms got",response.data);
      return response.data;
  } catch (error) {
      console.error("Error fetching permissions:", error);
      throw error;
  }
}

export async function getUserPermissions(): Promise<any> {
  try {
      const response = await axios.get(`${serverip}/user-permissions`);
      console.log("perms got",response.data);
      return response.data;
  } catch (error) {
      console.error("Error fetching permissions:", error);
      throw error;
  }
}

export async function updateUserPermissions(newUserPerms: object) {
  await fetch(`${serverip}/user-permissions`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newUserPerms)
  });
}
