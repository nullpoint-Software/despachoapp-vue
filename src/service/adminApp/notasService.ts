import type { Note } from "@/composables/useNotesStore";
import type { AxiosInstance } from "axios";

class NotasService {
  updateNota(_noteId: number, _updatedData: Partial<Omit<Note, "id">>) {
    throw new Error("Method not implemented.");
  }
  saveNoteLayout(_layout: { id: number; x?: number; y?: number; w?: number; h?: number; }[]) {
    throw new Error("Method not implemented.");
  }
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async getNotas(): Promise<any> {
    try {
      const response = await this.axios.get(`${this.serverip}/notas`);
      console.log("notas", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching notas:", error);
      throw error;
    }
  }

  async addNota(nota: any) {
    try {
      const res = await this.axios.post(`${this.serverip}/notas`, nota);
      console.log("Nota guardada:", res.data);
    } catch (err) {
      console.error("Error al guardar nota:", err);
    }
  }

  async deleteNota(id: any) {
    try {
      const res = await this.axios.delete(`${this.serverip}/notas/${id}`);
      console.log("Nota eliminada:", res.data);
    } catch (err) {
      console.error("Error al guardar nota:", err);
    }
  }
}

export default NotasService;
