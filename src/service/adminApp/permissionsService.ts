import axios from "axios";

const serverip = import.meta.env.VITE_API_SERVER_IP;

export interface PermissionProfile {
  user: {
    id: number;
    name: string;
    role: "Administrador" | "Empleado";
    active: boolean;
  };
  template: Record<string, boolean>;
  overrides: Record<string, boolean>;
  effective: Record<string, boolean>;
}

let currentProfile: PermissionProfile | null = null;
let currentProfileRequest: Promise<PermissionProfile> | null = null;
let currentProfileLoadedAt = 0;
let permissionPollTimer: ReturnType<typeof window.setInterval> | null = null;
const permissionListeners = new Set<(profile: PermissionProfile) => void>();
const PERMISSION_REFRESH_MS = 3000;

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function clearPermissionCache(): void {
  currentProfile = null;
  currentProfileRequest = null;
  currentProfileLoadedAt = 0;
}

const permissionSignature = (profile: PermissionProfile | null): string =>
  profile ? JSON.stringify([profile.user.role, profile.user.active, profile.effective]) : "";

function applyCurrentProfile(profile: PermissionProfile): PermissionProfile {
  const changed = permissionSignature(currentProfile) !== permissionSignature(profile);
  currentProfile = profile;
  currentProfileLoadedAt = Date.now();
  if (changed) {
    permissionListeners.forEach((listener) => {
      try {
        listener(profile);
      } catch (error) {
        console.error("Permission subscriber failed:", error);
      }
    });
  }
  return profile;
}

async function refreshCurrentPermissionProfile(): Promise<PermissionProfile> {
  if (!currentProfileRequest) {
    currentProfileRequest = axios
      .get<PermissionProfile>(`${serverip}/permissions/me`, {
        headers: authHeaders(),
        params: { updatedAt: Date.now() },
      })
      .then((response) => applyCurrentProfile(response.data))
      .finally(() => {
        currentProfileRequest = null;
      });
  }
  return currentProfileRequest;
}

function syncWhileVisible(): void {
  if (document.visibilityState === "visible" && localStorage.getItem("token")) {
    void refreshCurrentPermissionProfile().catch((error) => {
      console.error("Failed to refresh permissions:", error);
    });
  }
}

function updatePermissionPolling(): void {
  if (permissionListeners.size && permissionPollTimer === null) {
    permissionPollTimer = window.setInterval(syncWhileVisible, PERMISSION_REFRESH_MS);
    document.addEventListener("visibilitychange", syncWhileVisible);
  } else if (!permissionListeners.size && permissionPollTimer !== null) {
    window.clearInterval(permissionPollTimer);
    permissionPollTimer = null;
    document.removeEventListener("visibilitychange", syncWhileVisible);
  }
}

export function subscribeToPermissions(listener: (profile: PermissionProfile) => void): () => void {
  permissionListeners.add(listener);
  updatePermissionPolling();
  if (currentProfile) listener(currentProfile);
  void refreshCurrentPermissionProfile().catch((error) => {
    console.error("Failed to start permission sync:", error);
  });
  return () => {
    permissionListeners.delete(listener);
    updatePermissionPolling();
  };
}

export function permissionDeniedMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 403) return null;
  clearPermissionCache();
  const data = error.response.data as { error?: unknown } | undefined;
  return typeof data?.error === "string" && data.error.trim()
    ? data.error
    : "No tienes permiso para realizar esta acción.";
}

export async function getMyPermissionProfile(): Promise<PermissionProfile> {
  if (currentProfile && Date.now() - currentProfileLoadedAt < PERMISSION_REFRESH_MS) return currentProfile;
  return refreshCurrentPermissionProfile();
}

export async function hasPermission(permissionKey: string): Promise<boolean> {
  try {
    const profile = await getMyPermissionProfile();
    return profile.effective[permissionKey] === true;
  } catch (error) {
    console.error("Failed to load permissions:", error);
    return false;
  }
}

export async function getUserPermissionProfile(userId: string | number): Promise<PermissionProfile> {
  const response = await axios.get<PermissionProfile>(`${serverip}/permissions/users/${userId}`, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function updateUserPermissionOverrides(
  userId: string | number,
  overrides: Record<string, boolean>,
): Promise<PermissionProfile> {
  const response = await axios.put<PermissionProfile>(
    `${serverip}/permissions/users/${userId}`,
    { overrides },
    { headers: authHeaders() },
  );
  if (String(userId) === localStorage.getItem("userid")) applyCurrentProfile(response.data);
  return response.data;
}

export async function resetUserPermissionOverrides(userId: string | number): Promise<PermissionProfile> {
  const response = await axios.delete<PermissionProfile>(`${serverip}/permissions/users/${userId}`, {
    headers: authHeaders(),
  });
  if (String(userId) === localStorage.getItem("userid")) applyCurrentProfile(response.data);
  return response.data;
}
