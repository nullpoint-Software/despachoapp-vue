import type { AxiosInstance } from "axios";
import { saveAs } from "file-saver";

export interface InvoiceFilters {
  clienteId: number;
  direction?: "emitida" | "recibida";
  year?: number;
  month?: number | null;
  search?: string;
  limit?: number;
  offset?: number;
}

export default class FiscalService {
  constructor(private serverip: string, private axios: AxiosInstance) {}

  async importXml(clienteId: number, files: File[]) {
    const data = new FormData();
    data.append("clienteId", String(clienteId));
    data.append("userId", localStorage.getItem("userid") || "");
    files.forEach((file) => data.append("files", file));
    return (await this.axios.post(`${this.serverip}/fiscal/import`, data)).data;
  }

  async getInvoices(filters: InvoiceFilters) {
    return (await this.axios.get(`${this.serverip}/fiscal/invoices`, { params: filters })).data;
  }

  async getInvoice(id: number) {
    return (await this.axios.get(`${this.serverip}/fiscal/invoices/${id}`)).data;
  }

  async updateDiot(id: number, data: Record<string, unknown>) {
    return (await this.axios.patch(`${this.serverip}/fiscal/invoices/${id}/diot`, data)).data;
  }

  async getProvider(clienteId: number, rfc: string) {
    return (await this.axios.get(`${this.serverip}/fiscal/providers/${clienteId}/${encodeURIComponent(rfc)}`)).data;
  }

  async updateProvider(clienteId: number, rfc: string, data: Record<string, unknown>) {
    return (await this.axios.patch(`${this.serverip}/fiscal/providers/${clienteId}/${encodeURIComponent(rfc)}`, data)).data;
  }

  async deleteInvoice(id: number) {
    return (await this.axios.delete(`${this.serverip}/fiscal/invoices/${id}`)).data;
  }

  async downloadInvoiceXml(id: number, uuid: string) {
    const response = await this.axios.get(`${this.serverip}/fiscal/invoices/${id}/xml`, { responseType: "blob" });
    saveAs(response.data, `${uuid}.xml`);
  }

  async createReport(data: Record<string, unknown>) {
    return (await this.axios.post(`${this.serverip}/fiscal/reports`, data)).data;
  }

  async getReports(clienteId?: number) {
    return (await this.axios.get(`${this.serverip}/fiscal/reports`, { params: { clienteId } })).data;
  }

  async getReport(id: number) {
    return (await this.axios.get(`${this.serverip}/fiscal/reports/${id}`)).data;
  }

  async exportReport(id: number, fallbackName: string) {
    const response = await this.axios.get(`${this.serverip}/fiscal/reports/${id}/export`, { responseType: "blob" });
    const disposition = String(response.headers["content-disposition"] || "");
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
    saveAs(response.data, filename);
  }
}
