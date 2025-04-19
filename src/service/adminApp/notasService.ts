import type { AxiosInstance } from "axios";

class NotasService {
    private serverip: string;
    private axios: AxiosInstance;

    constructor(serverip: string, axios: AxiosInstance) {
        this.serverip = serverip;
        this.axios = axios;
    }

    async getNotas(): Promise<any> {
        try {
            const response = await this.axios.get(`${this.serverip}/notas`);
            console.log("notas",response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching notas:", error);
            throw error;
        }
    }

    async addNota(nota:any){
        try {
          const res = await this.axios.post(`${this.serverip}/notas`, nota);
          console.log("Nota guardada:", res.data);
        } catch (err) {
          console.error("Error al guardar nota:", err);
        }
      };
}

export default NotasService;