import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
class authService {
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async loginUser(credentials: { username: string, password: string}) {
    try {
      const response = await this.axios.post(`${this.serverip}:5000/login`, credentials);

      localStorage.setItem("token", response.data.token); // Store JWT token

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
}

export default authService;
