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
      const response = await this.axios.get(`${this.serverip}/usuarios`,{
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addUsuario(usuario: any) {
    try {
      const response = await this.axios.post(
        `${this.serverip}/usuarios`,
        usuario
      ,{
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getUsuarioPS(id_usuario: any, currentPassword: string) {
    try {
      const response = await this.axios.post(
        `${this.serverip}/usuarios/password`,
        { id_usuario, currentPassword },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async editUsuario(id_usuario:any, usuario: any) {
    try {
      const response = await this.axios.put(
        `${this.serverip}/usuarios/${id_usuario}`,
        usuario,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteUsuario(id_usuario: string) {
    try {
      const response = await this.axios.delete(
        `${this.serverip}/usuarios/${id_usuario}`,{
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async createPasswordReset(id_usuario: string | number, sendEmail = false) {
    try {
      const response = await this.axios.post(
        `${this.serverip}/usuarios/${id_usuario}/password-reset`,
        { sendEmail },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default UsuarioService;
