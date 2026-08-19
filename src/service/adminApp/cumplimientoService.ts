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
  ultima_fecha_intento: string | null;
  ultimo_error: string | null;
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
  con_error_reciente: number;
}

export interface ComplianceResponse {
  records: ComplianceRecord[];
  summary: ComplianceSummary;
}

export type ComplianceScheduleFrequency = "daily" | "weekdays" | "weekly";

export interface ComplianceScheduleConfig {
  enabled: boolean;
  frequency: ComplianceScheduleFrequency;
  runTime: string;
  dayOfWeek: number;
  timezone: string;
  regimes: string[];
  lastRunAt: string | null;
  lastStatus: "never" | "running" | "success" | "partial" | "error";
  lastMessage: string | null;
  lastTotal: number;
  lastCompleted: number;
  lastFailed: number;
  pendingRetries: number;
  exhaustedRetries: number;
}


export interface ThirdPartySessionState {
  id: string;
  image: string | null;
  captchaImage: string | null;
  width: number;
  height: number;
  title: string;
  phase: "loading" | "login" | "ready" | "syncing" | "error";
  ready: boolean;
  message: string | null;
  expiresInSeconds: number;
}

export type ThirdPartyInput =
  | { type: "click"; x: number; y: number }
  | { type: "text"; text: string }
  | { type: "key"; key: string }
  | { type: "scroll"; deltaY: number };

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

  async getProgramacion() {
    return (await this.axios.get(`${this.serverip}/cumplimiento/schedule`)).data as ComplianceScheduleConfig;
  }

  async guardarProgramacion(config: Pick<ComplianceScheduleConfig, "enabled" | "frequency" | "runTime" | "dayOfWeek" | "regimes">) {
    return (await this.axios.put(`${this.serverip}/cumplimiento/schedule`, config)).data as {
      config: ComplianceScheduleConfig;
      message: string;
    };
  }

  async iniciarSesionTerceros() {
    return (await this.axios.post(`${this.serverip}/cumplimiento/terceros/sessions`, undefined, { timeout: 15000 })).data as ThirdPartySessionState;
  }

  async obtenerSesionTerceros(sessionId: string) {
    return (await this.axios.get(`${this.serverip}/cumplimiento/terceros/sessions/${sessionId}`, { params: { _ts: Date.now() }, headers: { "Cache-Control": "no-cache" }, timeout: 10000 })).data as ThirdPartySessionState;
  }

  async iniciarAccesoTerceros(sessionId: string, credentials: { rfc: string; password: string; captcha: string }) {
    return (await this.axios.post(`${this.serverip}/cumplimiento/terceros/sessions/${sessionId}/login`, credentials, { timeout: 15000 })).data as ThirdPartySessionState;
  }

  async recargarSesionTerceros(sessionId: string) {
    return (await this.axios.post(`${this.serverip}/cumplimiento/terceros/sessions/${sessionId}/reload`, undefined, { timeout: 10000 })).data as ThirdPartySessionState;
  }

  async enviarEntradaTerceros(sessionId: string, input: ThirdPartyInput) {
    return (await this.axios.post(`${this.serverip}/cumplimiento/terceros/sessions/${sessionId}/input`, input, { timeout: 10000 })).data as ThirdPartySessionState;
  }

  async sincronizarTerceros(sessionId: string, options: { offset: number; limit: number }) {
    return (await this.axios.post(`${this.serverip}/cumplimiento/terceros/sessions/${sessionId}/sync`, options)).data as {
      results: ComplianceRecord[];
      total: number;
      processed: number;
      hasMore: boolean;
      documents: number;
      message: string;
    };
  }

  async cerrarSesionTerceros(sessionId: string) {
    await this.axios.delete(`${this.serverip}/cumplimiento/terceros/sessions/${sessionId}`);
  }
}
