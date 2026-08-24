// oxlint-disable no-useless-catch
import type { AxiosInstance } from 'axios'

class PagosService {
  private serverip: string
  private axios: AxiosInstance

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip
    this.axios = axios
  }

  // ----------- PagoMensual -----------

  async getPagoMensual(page?: { limit: number; offset: number }) {
    try {
      const response = await this.axios.get(`${this.serverip}/pagos/mensual`, { params: page })
      return response.data
    } catch (error) {
      throw error
    }
  }

  async addPagoMensual(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagos/mensual`, data)
      return response.data
    } catch (error) {
      throw error
    }
  }

  async updatePagoMensual(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagos/mensual/${id}`, data)
      return response.data
    } catch (error) {
      throw error
    }
  }

  async deletePagoMensual(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagos/mensual/${id}`)
      return response.data
    } catch (error) {
      throw error
    }
  }

  // ----------- PagoConcepto -----------

  async getPagoConcepto(page?: { limit: number; offset: number }) {
    try {
      const response = await this.axios.get(`${this.serverip}/pagos/concepto`, { params: page })
      return response.data
    } catch (error) {
      throw error
    }
  }

  async getPagoConceptoPage(page: { limit: number; offset: number; search?: string }) {
    try {
      const response = await this.axios.get(`${this.serverip}/pagos/concepto`, {
        params: { ...page, includeTotal: true }
      })
      return response.data as { data: any[]; total: number; limit: number; offset: number }
    } catch (error) {
      throw error
    }
  }

  async addPagoConcepto(data: any) {
    try {
      const response = await this.axios.post(`${this.serverip}/pagos/concepto`, data)
      return response.data
    } catch (error) {
      throw error
    }
  }

  async updatePagoConcepto(id: number, data: any) {
    try {
      const response = await this.axios.put(`${this.serverip}/pagos/concepto/${id}`, data)
      return response.data
    } catch (error) {
      throw error
    }
  }

  async deletePagoConcepto(id: number) {
    try {
      const response = await this.axios.delete(`${this.serverip}/pagos/concepto/${id}`)
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export default PagosService
