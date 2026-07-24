import type { AxiosInstance } from "axios";

class ClienteService {
    private serverip: string;
    private axios: AxiosInstance;

    constructor(serverip: string, axios: AxiosInstance) {
        this.serverip = serverip;
        this.axios = axios;
    }

    async getClientes(page?: { limit: number; offset: number }): Promise<any> {
        try {
            const response = await this.axios.get(`${this.serverip}/clientes`, { params: page });
            console.log("cliente",response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching clientes:", error);
            throw error;
        }
    }

    async getClientesPage(page: { limit: number; offset: number; search?: string }): Promise<{ data: any[]; total: number; limit: number; offset: number }> {
        const response = await this.axios.get(`${this.serverip}/clientes`, {
            params: { ...page, includeTotal: true },
        });
        return response.data;
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

    async revelarCredencial(idCliente: number, field: "rfc" | "fiel" | "ciecf", password: string) {
        const response = await this.axios.post(
            `${this.serverip}/clientes/${idCliente}/credenciales/revelar`,
            { field, password },
        );
        return response.data as { field: "rfc" | "fiel" | "ciecf"; value: string };
    }

    async verificarDocumentos(idCliente: number, password: string) {
        const response = await this.axios.post(
            `${this.serverip}/clientes/${idCliente}/documentos/verificar`,
            { password },
        );
        return response.data as { accessToken: string; expiresIn: number };
    }

    private documentHeaders(accessToken: string) {
        return { "X-Document-Authorization": accessToken };
    }

    async getDocumentos(idCliente: number, accessToken: string) {
        const response = await this.axios.get(`${this.serverip}/clientes/${idCliente}/documentos`, {
            headers: this.documentHeaders(accessToken),
        });
        return response.data;
    }

    async subirDocumento(idCliente: number, tipo: string, file: File, accessToken: string) {
        const data = new FormData();
        data.append("tipo", tipo);
        data.append("file", file);
        const response = await this.axios.post(
            `${this.serverip}/clientes/${idCliente}/documentos`,
            data,
            { headers: this.documentHeaders(accessToken) },
        );
        return response.data;
    }

    async descargarDocumento(idCliente: number, documentId: number, accessToken: string) {
        const response = await this.axios.get(
            `${this.serverip}/clientes/${idCliente}/documentos/${documentId}/archivo`,
            { responseType: "blob", headers: this.documentHeaders(accessToken) },
        );
        return response.data as Blob;
    }

    async eliminarDocumento(idCliente: number, documentId: number, accessToken: string) {
        const response = await this.axios.delete(
            `${this.serverip}/clientes/${idCliente}/documentos/${documentId}`,
            { headers: this.documentHeaders(accessToken) },
        );
        return response.data;
    }
}

export default ClienteService;
