import type { AxiosInstance } from "axios";

class LogsService {
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async getLogs(): Promise<any> {
    try {
      const response = await this.axios.get(`${this.serverip}/logs`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching logs:", error);
      throw error;
    }
  }

  async revertLog(log:any): Promise<any> {
    try {
      const response = await this.axios.post(`${this.serverip}/logs`, log,
        {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching logs:", error);
      throw error;
    }
  }
}
export default LogsService;
