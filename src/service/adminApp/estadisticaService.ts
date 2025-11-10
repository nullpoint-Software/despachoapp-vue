import type { AxiosInstance } from "axios";

class EstadisticaService {
    private serverip: string;
    private axios: AxiosInstance;

    constructor(serverip: string, axios: AxiosInstance) {
        this.serverip = serverip;
        this.axios = axios;
    }

    // Method to get statistics for the year
    async getGananciasPorAno(): Promise<any> {
        try {
            const response = await this.axios.get(`${this.serverip}/stats/gananciasporano`);
            console.log("Ganancias por Año:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching ganancias por año:", error);
            throw error;
        }
    }

    // Method to get statistics for daily earnings by hour
    async getGananciasPorDiaHora(): Promise<any> {
        try {
            const response = await this.axios.get(`${this.serverip}/stats/gananciaspordiahora`);
            console.log("Ganancias por Día por Hora:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching ganancias por día y hora:", error);
            throw error;
        }
    }

    // Method to get statistics for the month
    async getGananciasPorDiaMes(): Promise<any> {
        try {
            const response = await this.axios.get(`${this.serverip}/stats/gananciaspordiames`);
            console.log("Ganancias por Día y Mes:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching ganancias por día y mes:", error);
            throw error;
        }
    }

    // Method to get monthly statistics for each year
    async getGananciasPorMesAno(): Promise<any> {
        try {
            const response = await this.axios.get(`${this.serverip}/stats/gananciaspormesano`);
            console.log("Ganancias por Mes del Año:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching ganancias por mes del año:", error);
            throw error;
        }
    }

    async getDatos(): Promise<any> {
        try {
            const diaRaw = await this.getGananciasPorDiaHora();
            const mesRaw = await this.getGananciasPorDiaMes();
            const anio = await this.getGananciasPorMesAno();
            const anios = await this.getGananciasPorAno();
    
            // Format "dia": Ensure hour has leading zero and add ":00"
            const dia = diaRaw.map((item: any) => {
                const hour = String(item.nombre).padStart(2, '0') + ":00";
                return { nombre: hour, ganancia: item.ganancia, ingresos: item.ingresos, costos: item.costos };
            });
    
            // Format "mes": Show as "1 Abr", "2 Abr", etc.
            const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            const mes = mesRaw.map((item: any) => {
                const date = new Date(item.nombre);  // Convert to Date object
                const nombre = `${date.getDate()} ${monthNames[date.getMonth()]}`;
                return { nombre, ganancia: item.ganancia, ingresos: item.ingresos, costos: item.costos  };
            });
    
            const datos = {
                dia,    // Formatted with 08:00 style
                mes,    // Formatted with 1 Abr, 2 Abr, etc.
                anio,   // As is
                anios   // As is
            };
    
            console.log("Formatted Datos:", datos);
            return datos;
        } catch (error) {
            console.error("Error fetching or formatting data:", error);
            throw error;
        }
    }
    
}

export default EstadisticaService;
