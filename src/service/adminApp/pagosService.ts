// oxlint-disable no-useless-catch
import type { AxiosInstance } from "axios";

class PagosService {
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  // ----------- PagoHistorial -----------

  async getPagoHistorial() {
    try {
      const response = await this.axios.get(`${this.serverip}/pagos/historial`);
      return response.data;
// oxlint-disable-next-line no-useless-catch
    } catch (error) {
      throw error;
    }
  }

  async addPagoHistorial(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagos/historial`, data);
      return response.data;
// oxlint-disable-next-line no-useless-catch
    } catch (error) {
      throw error;
    }
  }

  async updatePagoHistorial(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagos/historial/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoHistorial(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagos/historial/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ----------- PagoMensual -----------

  async getPagoMensual() {
    try {
      const response = await this.axios.get(`${this.serverip}/pagos/mensual`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addPagoMensual(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagos/mensual`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updatePagoMensual(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagos/mensual/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoMensual(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagos/mensual/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ----------- PagoConcepto -----------

  async getPagoConcepto() {
    try {
      const response = await this.axios.get(`${this.serverip}/pagos/concepto`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addPagoConcepto(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagos/concepto`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updatePagoConcepto(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagos/concepto/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoConcepto(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagos/concepto/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default PagosService;
