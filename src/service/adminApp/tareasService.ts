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
}

export default TareasService;