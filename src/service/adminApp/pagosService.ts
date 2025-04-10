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
      const response = await this.axios.get(`${this.serverip}:5000/pagohistorial`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addPagoHistorial(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}:5000/pagohistorial`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updatePagoHistorial(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}:5000/pagohistorial/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoHistorial(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}:5000/pagohistorial/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ----------- PagoMensual -----------

  async getPagoMensual() {
    try {
      const response = await this.axios.get(`${this.serverip}:5000/pagomensual`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addPagoMensual(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}:5000/pagomensual`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updatePagoMensual(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}:5000/pagomensual/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoMensual(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}:5000/pagomensual/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ----------- PagoConcepto -----------

  async getPagoConcepto() {
    try {
      const response = await this.axios.get(`${this.serverip}:5000/pagoconcepto`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async addPagoConcepto(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}:5000/pagoconcepto`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updatePagoConcepto(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}:5000/pagoconcepto/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deletePagoConcepto(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}:5000/pagoconcepto/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default PagosService;
