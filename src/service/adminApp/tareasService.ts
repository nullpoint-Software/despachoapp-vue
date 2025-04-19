import type { AxiosInstance } from "axios";

class TareasService {
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async addTarea(tarea: any, id_usuario?: any): Promise<any> {
    try {
      if (id_usuario) {
        tarea.id_usuario = id_usuario;
      }
      const response = await this.axios.post(`${this.serverip}/tareas`, tarea);
      return response.data;
    } catch (err) {
      console.error("Error al agregar tarea:", err);
      throw err;
    }
  }

  async getTareas(): Promise<any> {
    try {
      const response = await this.axios.get(`${this.serverip}/tareas`);
      return response.data;
    } catch (error) {
      console.error("Error fetching tareas:", error);
      throw error;
    }
  }

  async getTareasDisponibles(): Promise<any> {
    try {
      const response = await this.axios.get(
        `${this.serverip}/tareas/disponible`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching tareas:", error);
      throw error;
    }
  }

  async updateTarea(id_tarea: string, id_usuario: any, estado: any, fecha_vencimiento: any): Promise<any> {
    try {
      console.log("try update tarea", id_tarea + " est: " + estado);
  
      const usuario = id_usuario || localStorage.getItem("userid");
  
      const payload: any = {
        estado: estado,
        id_usuario: usuario
      };
  
      if (fecha_vencimiento && estado === "Terminado") {
        payload.fecha_vencimiento = fecha_vencimiento;
      }
  
      const response = await this.axios.put(`${this.serverip}/tareas/${id_tarea}`, payload);
      return response.data;
    } catch (error) {
      console.error("error update tarea", error);
      throw error;
    }
  }



}

export default TareasService;
