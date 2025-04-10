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
            const response = await this.axios.get(`${this.serverip}:5000/notas`);
            console.log("notas",response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching notas:", error);
            throw error;
        }
    }
}

export default NotasService;