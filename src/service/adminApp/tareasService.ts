import type { AxiosInstance } from "axios";

export type TareaEstado = "Disponible" | "Pendiente" | "En Progreso" | "Terminado";

export interface TareaDto {
  id_tarea: number | string;
  estado: TareaEstado;
  titulo?: string;
  descripcion?: string;
  id_usuario?: number | string | null;
  username?: string | null;
  nombre?: string | null;
  usuario_imagen?: string | null;
  fecha_creacion?: string;
  fecha_vencimiento?: string | null;
  [key: string]: unknown;
}

export interface TareaPageRequest {
  limit: number;
  offset: number;
}

export interface TareaInput {
  titulo?: string;
  descripcion?: string;
  estado?: TareaEstado;
  id_usuario?: number | string | null;
  [key: string]: unknown;
}

type UnknownRecord = Record<string, unknown>;

function normalizeEstado(value: unknown): TareaEstado {
  const normalized = String(value ?? "Disponible").trim().toLocaleLowerCase("es-MX");
  if (normalized === "pendiente") return "Pendiente";
  if (["en progreso", "en proceso", "progreso"].includes(normalized)) return "En Progreso";
  if (["terminado", "terminada", "completado", "completada"].includes(normalized)) return "Terminado";
  return "Disponible";
}

function normalizeTarea(item: unknown): TareaDto | null {
  if (!item || typeof item !== "object") return null;
  const record = item as UnknownRecord;
  const id = record.id_tarea ?? record.id ?? record.taskId;
  if (id === undefined || id === null) return null;
  return {
    ...record,
    id_tarea: id as number | string,
    estado: normalizeEstado(record.estado ?? record.status),
    titulo: String(record.titulo ?? record.title ?? "Sin título"),
    descripcion: String(record.descripcion ?? record.description ?? ""),
  };
}

function normalizeTareaCollection(payload: unknown, visited = new Set<unknown>()): TareaDto[] {
  if (payload === null || payload === undefined || visited.has(payload)) return [];
  if (Array.isArray(payload)) return payload.map(normalizeTarea).filter((task): task is TareaDto => task !== null);
  if (typeof payload !== "object") return [];
  visited.add(payload);
  for (const candidate of Object.values(payload as UnknownRecord)) {
    const normalized = normalizeTareaCollection(candidate, visited);
    if (normalized.length > 0 || Array.isArray(candidate)) return normalized;
  }
  return [];
}

class TareasService {
  constructor(
    private readonly serverip: string,
    private readonly axios: AxiosInstance,
  ) {}

  async addTarea(tarea: TareaInput, idUsuario?: number | string): Promise<unknown> {
    try {
      const payload = idUsuario ? { ...tarea, id_usuario: idUsuario } : tarea;
      const response = await this.axios.post(`${this.serverip}/tareas`, payload);
      return response.data;
    } catch (error) {
      console.error("Error al agregar tarea:", error);
      throw error;
    }
  }

  async getTareas(page?: TareaPageRequest): Promise<TareaDto[]> {
    try {
      const response = await this.axios.get(`${this.serverip}/tareas`, { params: page });
      return normalizeTareaCollection(response.data);
    } catch (error) {
      console.error("Error al obtener tareas:", error);
      throw error;
    }
  }

  async getTareasDisponibles(page?: TareaPageRequest): Promise<TareaDto[]> {
    try {
      const response = await this.axios.get(`${this.serverip}/tareas/disponible`, { params: page });
      return normalizeTareaCollection(response.data);
    } catch (error) {
      console.error("Error al obtener tareas disponibles:", error);
      throw error;
    }
  }

  async updateTarea(
    idTarea: string,
    idUsuario: number | string | null,
    estado: TareaEstado,
    fechaVencimiento: string | null,
    titulo?: string,
    descripcion?: string,
  ): Promise<unknown> {
    try {
      const usuario = idUsuario ?? localStorage.getItem("userid");
      const payload: TareaInput = { estado, id_usuario: usuario };
      payload.fecha_vencimiento = estado === "Terminado" ? fechaVencimiento : null;
      if (titulo !== undefined) payload.titulo = titulo;
      if (descripcion !== undefined) payload.descripcion = descripcion;
      const response = await this.axios.put(`${this.serverip}/tareas/${idTarea}`, payload);
      return response.data;
    } catch (error) {
      console.error("Error al actualizar tarea:", error);
      throw error;
    }
  }
}

export default TareasService;
