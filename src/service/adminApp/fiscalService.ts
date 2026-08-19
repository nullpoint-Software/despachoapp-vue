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

export interface SatDownloadJob {
  id: number;
  id_cliente: number;
  cliente: string;
  rfc: string;
  direccion: "emitida" | "recibida";
  fecha_inicial: string;
  fecha_final: string;
  id_solicitud: string;
  estado: "solicitada" | "procesando" | "descargando" | "completada" | "sin_datos" | "error" | "cancelada";
  codigo_sat?: string | null;
  mensaje_sat?: string | null;
  numero_cfdi: number;
  importados: number;
  duplicados: number;
  rechazados: number;
  intentos: number;
  ultimo_error?: string | null;
  proxima_revision?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  fecha_finalizacion?: string | null;
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

  async createSatDownloads(data: {
    clientId: number;
    direction: "ambas" | "emitida" | "recibida";
    startDate: string;
    endDate: string;
    certificate: File;
    privateKey: File;
    password: string;
  }): Promise<{ jobs: SatDownloadJob[]; errors: Array<{ direction: string; error: string }> }> {
    const form = new FormData();
    form.append("clientId", String(data.clientId));
    form.append("direction", data.direction);
    form.append("startDate", data.startDate);
    form.append("endDate", data.endDate);
    form.append("password", data.password);
    form.append("certificate", data.certificate);
    form.append("privateKey", data.privateKey);
    return (await this.axios.post(`${this.serverip}/fiscal/sat-downloads`, form, { timeout: 180_000 })).data;
  }

  async getSatDownloads(clientId: number): Promise<SatDownloadJob[]> {
    return (await this.axios.get(`${this.serverip}/fiscal/sat-downloads`, { params: { clientId } })).data;
  }

  async cancelSatDownload(id: number): Promise<SatDownloadJob> {
    return (await this.axios.delete(`${this.serverip}/fiscal/sat-downloads/${id}`)).data;
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

  async removeReportInvoice(reportId: number, invoiceId: number) {
    return (await this.axios.delete(`${this.serverip}/fiscal/reports/${reportId}/invoices/${invoiceId}`)).data;
  }

  async deleteReport(reportId: number) {
    return (await this.axios.delete(`${this.serverip}/fiscal/reports/${reportId}`)).data;
  }

  async exportReport(id: number, fallbackName: string) {
    const response = await this.axios.get(`${this.serverip}/fiscal/reports/${id}/export`, { responseType: "blob" });
    const disposition = String(response.headers["content-disposition"] || "");
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
    saveAs(response.data, filename);
  }

  async reconcileBankStatement(data: {
    clienteId: number;
    year: number;
    month: number;
    bank: string;
    password?: string;
    amountTolerance: number;
    dateWindow: number;
    file: File;
  }) {
    const form = new FormData();
    form.append("clienteId", String(data.clienteId));
    form.append("year", String(data.year));
    form.append("month", String(data.month));
    form.append("bank", data.bank);
    form.append("password", data.password || "");
    form.append("amountTolerance", String(data.amountTolerance));
    form.append("dateWindow", String(data.dateWindow));
    form.append("userId", localStorage.getItem("userid") || "");
    form.append("file", data.file);
    return (
      await this.axios.post(`${this.serverip}/fiscal/reconciliation`, form, {
        timeout: 120_000,
      })
    ).data;
  }
}
