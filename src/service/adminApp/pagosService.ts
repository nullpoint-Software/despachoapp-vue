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
      const response = await this.axios.get(`${this.serverip}/pagohistorial`);
      return response.data;
// oxlint-disable-next-line no-useless-catch
    } catch (error) {
      throw error;
    }
  }

  async addPagoHistorial(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagohistorial`, data);
      return response.data;
// oxlint-disable-next-line no-useless-catch
    } catch (error) {
      throw error;
    }
  }

  async updatePagoHistorial(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagohistorial/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoHistorial(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagohistorial/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ----------- PagoMensual -----------

  async getPagoMensual() {
    try {
      const response = await this.axios.get(`${this.serverip}/pagomensual`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addPagoMensual(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagomensual`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updatePagoMensual(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagomensual/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoMensual(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagomensual/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ----------- PagoConcepto -----------

  async getPagoConcepto() {
    try {
      const response = await this.axios.get(`${this.serverip}/pagoconcepto`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addPagoConcepto(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagoconcepto`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updatePagoConcepto(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagoconcepto/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoConcepto(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagoconcepto/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default PagosService;
