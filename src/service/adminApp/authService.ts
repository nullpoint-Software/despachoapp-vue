import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
import { useRouter } from "vue-router";
class authService {
  private serverip: string;
  private axios: AxiosInstance;
  public authStatus: boolean = false;

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
  checkAuthRedirect = () => {
    const router = useRouter();

    // Check if the token exists in localStorage
    const token = localStorage.getItem("token");

    if (!token) {
      // If the token doesn't exist, redirect to /login
      router.push("/login");
      this.authStatus = false;
    }else{
      router.push("/app");
      this.authStatus = true;
    }
  };
}

export default authService;
