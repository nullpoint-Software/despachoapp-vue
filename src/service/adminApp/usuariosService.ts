import type { AxiosInstance } from "axios";

class UsuarioService {
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async getUsuarios(): Promise<any> {
    try {
      const response = await this.axios.get(`${this.serverip}/usuarios`);
      console.log("usuarios", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching usuarios:", error);
      throw error;
    }
  }

  async addUsuario(usuario: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/usuarios`, usuario);
      console.log("try insert usuario", usuario);
      return response.data;
    } catch (error) {
      console.error("error insert usuario", error);
      throw error;
    }
  }

  async editUsuario(usuario: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/usuarios/${usuario.id_usuario}`, usuario);
      console.log("try edit usuario", usuario);
      return response.data;
    } catch (error) {
      console.error("error edit usuario", error);
      throw error;
    }
  }

  async deleteUsuario(id_usuario: string) {
    try {
      const response = await this.axios.delete(`${this.serverip}/usuarios/${id_usuario}`);
      console.log("try delete usuario", id_usuario);
      return response.data;
    } catch (error) {
      console.error("error delete usuario", error);
      throw error;
    }
  }
}

export default UsuarioService;