import type { AxiosInstance } from "axios";

class TareasService {
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async getTareas(): Promise<any> {
    try {
      const response = await this.axios.get(`${this.serverip}:5000/tareas`);
      return response.data;
    } catch (error) {
      console.error("Error fetching tareas:", error);
      throw error;
    }
  }

  async getTareasDisponibles(): Promise<any> {
    try {
      const response = await this.axios.get(
        `${this.serverip}:5000/tareas/disponible`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching tareas:", error);
      throw error;
    }
  }

  async updateTareaEstado(id_tarea: String, estado:any, fecha_vencimiento:any): Promise<any> {
    try {
        console.log("try update tarea",id_tarea+" est: "+estado);
      if(!fecha_vencimiento){ //si no terminado
        const response = await this.axios.put(`${this.serverip}:5000/tareas/${id_tarea}`,{estado: estado, id_usuario: localStorage.getItem("userid")});
        return response.data;
      }else{ // si terminado
        const response = await this.axios.put(`${this.serverip}:5000/tareas/${id_tarea}`,{estado: estado, id_usuario: localStorage.getItem("userid"), fecha_vencimiento: fecha_vencimiento});
        return response.data;
      }
    } catch (error) {
      console.error("error update tarea", error);
      throw error;
    }
  }

}

export default TareasService;
