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

  async getNotas(page?: { limit: number; offset: number }): Promise<any> {
    try {
      const response = await this.axios.get(`${this.serverip}/notas`, { params: page });
      return response.data;
    } catch (error) {
      console.error("Error fetching notas:", error);
      throw error;
    }
  }

  async addNota(nota: any) {
    try {
      const res = await this.axios.post(`${this.serverip}/notas`, nota);
      return res.data;
    } catch (err) {
      console.error("Error al guardar nota:", err);
      throw err;
    }
  }

  async deleteNota(id: any) {
    try {
      const res = await this.axios.delete(`${this.serverip}/notas/${id}`);
    } catch (err) {
      console.error("Error al guardar nota:", err);
    }
  }
}

export default NotasService;
