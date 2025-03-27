import type { AxiosInstance } from "axios";

class ClienteService {
    private serverip: string;
    private axios: AxiosInstance;

    constructor(serverip: string, axios: AxiosInstance) {
        this.serverip = serverip;
        this.axios = axios;
    }

    async getClientes(): Promise<any> {
        try {
            const response = await this.axios.get(`${this.serverip}:5000/clientes`);
            console.log("cliente",response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching clientes:", error);
            throw error;
        }
    }

    async addCliente(cliente:any){
        try{
            const response = await this.axios.post(`${this.serverip}:5000/clientes`,cliente);
            console.log("try insert cliente",cliente);
            return response.data;
        }catch(error){
            console.error("error insert cliente", error)
            throw error;
        }
    }
}

export default ClienteService;