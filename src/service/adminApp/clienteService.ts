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
            const response = await this.axios.get(`${this.serverip}/clientes`);
            console.log("cliente",response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching clientes:", error);
            throw error;
        }
    }

    async addCliente(cliente:any){
        try{
            const response = await this.axios.post(`${this.serverip}/clientes`,cliente);
            console.log("try insert cliente",cliente);
            return response.data;
        }catch(error){
            console.error("error insert cliente", error)
            throw error;
        }
    }

    async editCliente(cliente:any){
        try{
            const response = await this.axios.put(`${this.serverip}/clientes/${cliente.id_cliente}`,cliente);
            console.log("try edit cliente",cliente);
            return response.data;
        }catch(error){
            console.error("error edit cliente", error)
            throw error;
        }
    }

    async deleteCliente(id_cliente:String){
        try{
            const response = await this.axios.delete(`${this.serverip}/clientes/${id_cliente}`);
            console.log("try delete cliente",id_cliente);
            return response.data;
        }catch(error){
            console.error("error delete cliente", error)
            throw error;
        }
    }
}

export default ClienteService;