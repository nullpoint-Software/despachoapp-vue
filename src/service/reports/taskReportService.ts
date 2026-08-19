import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import companyLogoUrl from "@/assets/img/logsymbolwhite.png";

export interface TaskReportItem {
  id_tarea: number | string;
  id_usuario?: number | string | null;
  titulo?: string;
  descripcion?: string;
  estado: string;
  fecha_creacion?: string;
  fecha_vencimiento?: string | null;
}

export interface TaskReportSession {
  userId: number | string | null;
  responsibleName: string;
}

export interface TaskReportResult {
  exportedTasks: number;
  fileName: string;
}

export interface TaskReportDocument extends TaskReportResult {
  document: jsPDF | null;
}

export interface TaskReportPreviewResult extends TaskReportResult {
  previewUrl: string | null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCutoff(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function selectedDayRange(value: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(year, month, day);

  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month ||
    start.getDate() !== day
  ) return null;

  const end = new Date(year, month, day + 1);
  return { start, end };
}

function completedTasksOnDay(
  items: TaskReportItem[],
  selectedDate: string,
  userId: TaskReportSession["userId"],
): TaskReportItem[] {
  const range = selectedDayRange(selectedDate);
  if (!range) return [];

  return items.filter((task) => {
    if (task.estado !== "Terminado") return false;
    if (userId !== null && String(task.id_usuario ?? "") !== String(userId)) return false;

    const completedAt = parseDate(task.fecha_vencimiento);
    if (!completedAt) return false;
    return completedAt >= range.start && completedAt < range.end;
  });
}

async function loadCompanyLogo(): Promise<string | null> {
  if (typeof fetch !== "function") return null;

  try {
    const response = await fetch(companyLogoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function createTaskReportDocument(
  items: TaskReportItem[],
  cutoff: string,
  session: TaskReportSession,
  logoDataUrl: string | null = null,
): TaskReportDocument {
  const reportTasks = completedTasksOnDay(items, cutoff, session.userId);
  const fileName = `tareas-finalizadas-${cutoff || "actual"}.pdf`;

  if (reportTasks.length === 0) {
    return { document: null, exportedTasks: 0, fileName };
  }

  const document = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();

  document.setFillColor(16, 16, 15);
  document.rect(0, 0, pageWidth, 48, "F");

  if (logoDataUrl) {
    document.addImage(logoDataUrl, "PNG", 6, 9, 42, 23);
  }

  const titleX = logoDataUrl ? 52 : 14;
  document.setTextColor(244, 241, 233);
  document.setFont("helvetica", "bold");
  document.setFontSize(18);
  document.text("REPORTE DE TAREAS FINALIZADAS", titleX, 20);
  document.setFont("courier", "normal");
  document.setFontSize(8.5);
  document.text("DESPACHO CONTABLE Y FISCAL SANCHEZ", titleX, 28);
  document.setTextColor(217, 164, 65);
  document.text(`${reportTasks.length} tareas registradas`, titleX, 36);

  document.setTextColor(34, 33, 30);
  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.text("RESPONSABLE", 14, 59);
  document.text("FECHA DEL REPORTE", 116, 59);

  document.setDrawColor(202, 197, 187);
  document.setFillColor(246, 244, 238);
  document.roundedRect(14, 63, 94, 13, 1.5, 1.5, "FD");
  document.roundedRect(116, 63, 80, 13, 1.5, 1.5, "FD");
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text(session.responsibleName || "Usuario sin nombre", 18, 71.5);
  document.text(formatCutoff(cutoff), 120, 71.5);

  autoTable(document, {
    startY: 84,
    margin: { top: 20, left: 14, right: 14, bottom: 18 },
    head: [["Tarea", "Finalización", "Descripción"]],
    body: reportTasks.map((task) => [
      task.titulo || "Tarea sin título",
      formatDate(task.fecha_vencimiento),
      task.descripcion || "Sin descripción",
    ]),
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 4,
      overflow: "linebreak",
      fillColor: [244, 241, 233],
      lineColor: [59, 57, 51],
      lineWidth: 0.18,
      textColor: [35, 34, 31],
      valign: "middle",
    },
    headStyles: {
      fillColor: [24, 24, 22],
      textColor: [217, 164, 65],
      lineColor: [217, 164, 65],
      lineWidth: 0.35,
      fontStyle: "bold",
      minCellHeight: 11,
    },
    alternateRowStyles: {
      fillColor: [232, 228, 217],
    },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold" },
      1: { cellWidth: 34, halign: "center" },
      2: { cellWidth: 100 },
    },
    didDrawPage: () => {
      const pageNumber = document.getCurrentPageInfo().pageNumber;
      document.setDrawColor(205, 201, 192);
      document.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);
      document.setFont("courier", "normal");
      document.setFontSize(8);
      document.setTextColor(105, 101, 94);
      document.text("ContaApp / Tareas", 14, pageHeight - 8);
      document.text(`Página ${pageNumber}`, pageWidth - 14, pageHeight - 8, { align: "right" });
    },
  });

  return {
    document,
    exportedTasks: reportTasks.length,
    fileName,
  };
}

export async function prepareTaskReportPreview(
  items: TaskReportItem[],
  cutoff: string,
  session: TaskReportSession,
): Promise<TaskReportPreviewResult> {
  const logoDataUrl = await loadCompanyLogo();
  const result = createTaskReportDocument(items, cutoff, session, logoDataUrl);
  const previewUrl = result.document
    ? URL.createObjectURL(result.document.output("blob"))
    : null;

  return {
    exportedTasks: result.exportedTasks,
    fileName: result.fileName,
    previewUrl,
  };
}

export function revokeTaskReportPreview(preview: TaskReportPreviewResult): void {
  if (preview.previewUrl) URL.revokeObjectURL(preview.previewUrl);
}
