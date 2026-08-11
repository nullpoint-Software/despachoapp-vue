import type { AxiosInstance } from "axios";

export type ComplianceStatus =
  | "positiva"
  | "negativa"
  | "suspension_actividades"
  | "inscrito_sin_obligaciones"
  | "no_inscrito"
  | "cancelado"
  | "no_localizado"
  | "no_publica"
  | "otro"
  | "sin_consulta"
  | "error";

export interface ComplianceIssue {
  code: string;
  title: string;
  detail: string;
  confirmed: boolean;
  action?: string;
}

export interface ComplianceRecord {
  id_cliente: number;
  nombre: string;
  rfc: string;
  regimen_fiscal: string | null;
  status: ComplianceStatus;
  fuente: string | null;
  fecha_consulta: string | null;
  fecha_emision: string | null;
  vigente_hasta: string | null;
  mensaje: string | null;
  pendientes: ComplianceIssue[];
  documento_id: number | null;
  documento_guardado: boolean;
}

export interface ComplianceSummary {
  total: number;
  positiva: number;
  negativa: number;
  suspension_actividades: number;
  inscrito_sin_obligaciones: number;
  no_inscrito: number;
  cancelado: number;
  no_localizado: number;
  no_publica: number;
  otro: number;
  sin_consulta: number;
  error: number;
  especial: number;
  con_documento: number;
}

export interface ComplianceResponse {
  records: ComplianceRecord[];
  summary: ComplianceSummary;
}

export default class CumplimientoService {
  constructor(private serverip: string, private axios: AxiosInstance) {}

  async getOpiniones(params?: { search?: string; status?: string }) {
    return (await this.axios.get(`${this.serverip}/cumplimiento`, { params })).data as ComplianceResponse;
  }

  async sincronizar(options?: { clientIds?: number[]; offset?: number; limit?: number }) {
    return (await this.axios.post(`${this.serverip}/cumplimiento/sync`, options || {})).data as {
      results: ComplianceRecord[];
      message: string;
      total: number;
      processed: number;
      hasMore: boolean;
      documents: number;
    };
  }

  async getHistorial(clientId: number) {
    return (await this.axios.get(`${this.serverip}/cumplimiento/${clientId}/history`)).data;
  }
}
