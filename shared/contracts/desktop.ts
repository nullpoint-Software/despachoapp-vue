import type { ClientRequest, ClientResult } from './clients'
import type { DocumentViewRequest, DocumentViewResult } from './documents'
import type { MovementFilter, MovementRequest, MovementResult } from './movements'
import type { PrintResult, TicketPreview } from './printing'
import type { CfdiAnalysis } from './cfdi'
import type { FileSaveResult, FiscalReportAddition, FiscalReportRequest, FiscalReportResult } from './fiscalReports'
import type { SatCredentialInfo, SatDownloadResult, SatDownloadSubmission, SatDownloadViewRequest } from './satDownloads'
import type { OpinionRequest, OpinionResult } from './complianceOpinions'
import type { TaxStatusRequest, TaxStatusResult } from './taxStatus'
import type { SatPortalViewRequest, SatPortalViewResult } from './satPortal'
import type { SatPortalCfdiViewRequest, SatPortalCfdiViewResult } from './satPortalCfdi'
import type { TeamOverviewRequest, TeamOverviewResult } from './teamOverview'
import type { UserPhotoRequest, UserPhotoResult } from './userPhotos'
import type { MailAccountRequest, MailAccountResult, MailViewRequest, MailViewResult } from './mail'
import type { MailDomainRequest, MailDomainResult } from './mailDomain'
import type { CfdiPdfRequest, FiscalTableRequest, FiscalTableResult, ReportPdfRequest } from './fiscalWorkspace'
import type { PdfResult, PdfSaveResult } from './pdfViewer'
import type { CompletedTasksPdfRequest } from './taskReports'
import type { ObligationReportPdfRequest, StoredCertificateResult, TaxObligationRequest, TaxObligationResult } from './taxObligations'
import type { ScheduleRequest, ScheduleResult } from './schedules'
import type { BackupRequest, BackupResult } from './backups'
import type { LegacyMigrationRequest, LegacyMigrationResult } from './legacyMigration'
import type { BackupRestoreRequest, BackupRestoreResult } from './backupRestore'
import type { DiagnosticsAction, DiagnosticsResult } from './diagnostics'
import type { NoteImageResult } from './noteImages'
import type { ClientCredentialRequest, ClientCredentialStatus } from './clientCredentials'
import type { SatCatalogRequest, SatCatalogResult } from './satCatalogs'
import type { ReconciliationResult, ReconciliationRunOutcome, ReconciliationRunRequest, ReconciliationViewRequest } from './bankReconciliation'
import type { TaskRequest, TaskResult } from './tasks'
import type { AccessRequest, AccessSnapshot } from './access'
import type { LoginRequest, PasswordChangeRequest, SessionStatus } from './session'
import type { WorkspaceAccess } from './workspace'
import type { HostEventsStatus } from './hostEvents'
import type { PairingStatus, DeviceAdministrationRequest, DeviceAdministration } from './pairing'
import type { HostTrustAction, HostTrustStatus } from './hostTrust'
import type { DockerRuntimeAction, DockerRuntimeStatus } from './dockerRuntime'

import type { CreateAdministratorRequest } from './administrator'

import type { DiscoveryStatus } from './discovery'

import type { LocalNotes, NotesExportResult, NotesImportResult } from './localNotes'
import type { LocalXmlFilter, LocalXmlList, XmlImportContent, XmlImportResult } from './localXml'
import type { LocalPreferences, LocalPreferencesPatch, LocalPrinter } from './localPreferences'

import type { ManagedDatabaseStatus } from './managedDatabase'

import type { OfficeBranding } from './branding'

import type { HostStatus, DatabaseConfiguration, MigrationCredentials } from './host'

import type { InstallationInformation, ConfigureInstallationRequest } from './installation'

/** Información pública EPHEMERAL; el contrato nunca devuelve tokens ni rutas locales. */

export interface ApplicationInformation {

  version: string

  platform: string

}

export interface DesktopApi {
  manageLinkFile(action: 'export' | 'import', proof?: string, maximumDeviceCount?: number): Promise<boolean>
  manageClients(request: ClientRequest, proof?: string): Promise<ClientResult>
  manageDocuments(request: DocumentViewRequest, proof?: string): Promise<DocumentViewResult>
  manageMovements(request: MovementRequest, proof?: string): Promise<MovementResult>
  manageTasks(request: TaskRequest): Promise<TaskResult>
  administerAccess(request: AccessRequest, proof?: string): Promise<AccessSnapshot>
  authenticateUser(request: LoginRequest): Promise<SessionStatus>
  /** Cambia la contraseña del usuario de la sesión (2026-10-17); rechaza si la actual no coincide. */
  changeOwnPassword(request: PasswordChangeRequest): Promise<void>
  manageSession(action: 'status' | 'activity' | 'logout' | 'logoutAll'): Promise<SessionStatus>
  /** Capacidades de la sesión según el Host; todo en falso sin sesión o sin conexión. */
  readWorkspaceAccess(): Promise<WorkspaceAccess>
  manageHostEvents(action: 'status' | 'start' | 'stop'): Promise<HostEventsStatus>
  managePairing(action: 'status' | 'request' | 'refresh'): Promise<PairingStatus>
  administerDevices(request: DeviceAdministrationRequest): Promise<DeviceAdministration>
  manageHostTrust(action: HostTrustAction): Promise<HostTrustStatus>

  manageDockerRuntime(action: DockerRuntimeAction): Promise<DockerRuntimeStatus>

  createAdministrator(request: CreateAdministratorRequest): Promise<HostStatus>

  getDiscoveryStatus(): Promise<DiscoveryStatus>

  findHosts(): Promise<DiscoveryStatus>

  selectDiscoveredHost(candidateId: string | null): Promise<DiscoveryStatus>

  setManualHost(endpoint: { address: string; port: number }): Promise<DiscoveryStatus>

  readLocalNotes(): Promise<LocalNotes>

  saveLocalNotes(value: LocalNotes): Promise<LocalNotes>
  exportLocalNotes(): Promise<NotesExportResult>
  chooseNotesImport(): Promise<NotesImportResult>
  listLocalXml(filter: LocalXmlFilter): Promise<LocalXmlList>
  readLocalPreferences(): Promise<LocalPreferences>
  updateLocalPreferences(patch: LocalPreferencesPatch): Promise<LocalPreferences>
  listLocalPrinters(): Promise<LocalPrinter[]>
  /** Impresión LOCAL (5.4): Main prepara el ticket con datos del Host y lo imprime por su id. */
  prepareMovementReceipt(movementId: string): Promise<TicketPreview>
  prepareCashCutTicket(filter: MovementFilter): Promise<TicketPreview>
  prepareTestTicket(): Promise<TicketPreview>
  printTicket(ticketId: string): Promise<PrintResult>
  importLocalXml(): Promise<XmlImportResult>
  /** Archivos arrastrados al modal "Importar XML": nombre y bytes leídos en el Renderer, nunca rutas. */
  importLocalXmlFiles(files: XmlImportContent[]): Promise<XmlImportResult>
  readLocalXml(uuid: string): Promise<string>
  /** Datos fiscales estructurados del XML de este equipo (6.1); se calculan en Main y no salen del equipo. */
  analyzeLocalXml(uuid: string): Promise<CfdiAnalysis>
  /** Reportes fiscales y DIOT (6.2): GLOBAL en el Host; agregar CFDI envía sólo datos derivados del XML LOCAL. */
  manageFiscalReports(request: FiscalReportRequest): Promise<FiscalReportResult>
  addCfdisToReport(addition: FiscalReportAddition): Promise<FiscalReportResult>
  exportReportCsv(reportId: string): Promise<FileSaveResult>
  /** Excel con el diseño de la app (2026-10-13); el CSV queda para importar en otros sistemas. */
  exportReportXlsx(reportId: string): Promise<FileSaveResult>
  exportDiotFile(reportId: string): Promise<FileSaveResult>
  /** Obligaciones fiscales de los clientes (2026-10-18): GLOBAL en el Host, con permisos de reportes y asignación. */
  manageTaxObligations(request: TaxObligationRequest): Promise<TaxObligationResult>
  /** Obligaciones de la CSF guardada en el expediente del cliente (Main la lee; el PDF no llega a la ventana). */
  readStoredCertificateObligations(request: { clientId: string }): Promise<StoredCertificateResult>
  /** PDF del reporte de obligaciones del periodo (ver o guardar). */
  openObligationReportPdf(request: ObligationReportPdfRequest): Promise<PdfResult>
  /** Descargas del SAT (6.3): la e.firma se elige y se sella en Main; la vista sólo envía la contraseña al capturarla. */
  manageSatDownloads(request: SatDownloadViewRequest): Promise<SatDownloadResult>
  requestSatDownload(submission: SatDownloadSubmission): Promise<SatDownloadResult>
  readSatCredential(clientId: string): Promise<SatCredentialInfo | null>
  saveSatCredential(clientId: string, password: string): Promise<'saved' | 'cancelled'>
  deleteSatCredential(clientId: string): Promise<'deleted'>
  /** Opiniones de cumplimiento (6.4): el Host consulta al SAT por lotes y guarda el último PDF en el expediente. */
  manageOpinions(request: OpinionRequest): Promise<OpinionResult>
  /** Constancia de situación fiscal (2026-10-11): leer el último resultado o iniciar la consulta pública por idCIF + RFC. */
  manageTaxStatus(request: TaxStatusRequest): Promise<TaxStatusResult>
  /** Portal del SAT con RFC y CIEC (2026-10-11): abrir la ventana del SAT para la CSF o la opinión, leer el avance o cancelar. */
  manageSatPortal(request: SatPortalViewRequest): Promise<SatPortalViewResult>
  /** Descarga de CFDI por el portal del SAT con RFC y CIEC (2026-10-11): iniciar (cliente, dirección y periodo), leer el avance o cancelar. */
  manageSatPortalCfdi(request: SatPortalCfdiViewRequest): Promise<SatPortalCfdiViewResult>
  /** Programaciones del Host (7.1): consultar y guardar la consulta programada de opiniones. */
  manageSchedules(request: ScheduleRequest): Promise<ScheduleResult>
  /** Respaldos del Host (7.2): sólo en el equipo Host; configurar pide la contraseña de la sesión. */
  manageBackups(request: BackupRequest, password?: string): Promise<BackupResult>
  /** Probar, restaurar o volver a la base anterior (7.3); en la instalación, restaurar sin sesión. */
  restoreBackup(request: BackupRestoreRequest, password?: string): Promise<BackupRestoreResult>
  /** Migración desde el sistema heredado (8.1): sólo en el equipo Host; ejecutar pide la contraseña de la sesión. */
  runLegacyMigration(request: LegacyMigrationRequest, password?: string): Promise<LegacyMigrationResult>
  /** Diagnóstico del equipo para soporte (7.4): leerlo o exportarlo a un archivo. */
  readDiagnostics(action: DiagnosticsAction): Promise<DiagnosticsResult>
  /** Descarga una imagen HTTPS para incrustarla en una nota (pulido 2026-10-03). */
  fetchNoteImage(url: string): Promise<NoteImageResult>
  /** CIEC del cliente guardada sólo en este equipo (ADR-032); copiar pide la contraseña del usuario. */
  manageClientCredentials(request: ClientCredentialRequest, password?: string): Promise<ClientCredentialStatus>
  /** Catálogos SAT descargados en este equipo (ADR-032). */
  manageSatCatalogs(request: SatCatalogRequest): Promise<SatCatalogResult>
  /** Panel de equipo de Inicio (administrador): actividad, tareas y movimientos de todos los usuarios. */
  readTeamOverview(request: TeamOverviewRequest): Promise<TeamOverviewResult>
  manageUserPhotos(request: UserPhotoRequest): Promise<UserPhotoResult>
  /** Correo a clientes (2026-10-17): cuenta SMTP vinculada en este equipo (sellada en Main) y probar la conexión. */
  manageMailAccount(request: MailAccountRequest): Promise<MailAccountResult>
  manageMailDomain(request: MailDomainRequest): Promise<MailDomainResult>
  /** Plantillas GLOBAL, archivos del equipo por id (nunca rutas) y envío con nodemailer en Main. */
  manageMail(request: MailViewRequest): Promise<MailViewResult>
  readFiscalTable(request: FiscalTableRequest): Promise<FiscalTableResult>
  openReportPdf(request: ReportPdfRequest): Promise<PdfResult>
  openCfdiPdf(request: CfdiPdfRequest): Promise<PdfResult>
  openCompletedTasksPdf(request: CompletedTasksPdfRequest): Promise<PdfResult>
  /** Visor de PDF de Fiscenix (2026-10-06): guardar, imprimir y liberar el PDF abierto, sólo por su `viewId`. */
  savePdfView(viewId: string): Promise<PdfSaveResult>
  printPdfView(viewId: string): Promise<void>
  releasePdfView(viewId: string): Promise<void>
  /** Conciliación bancaria (6.5): Main lee el estado de cuenta en memoria; el Host concilia y guarda la revisión. */
  manageBankReconciliation(request: ReconciliationViewRequest): Promise<ReconciliationResult>
  reconcileBankStatement(request: ReconciliationRunRequest): Promise<ReconciliationRunOutcome>
  exportReconciliationCsv(request: Extract<ReconciliationViewRequest, { action: 'get' }>): Promise<FileSaveResult>
  saveLocalXmlCopy(uuid: string): Promise<'saved' | 'cancelled'>
  trashLocalXml(uuids: string[]): Promise<number>
  restoreLocalXml(uuids: string[]): Promise<number>

  getManagedDatabaseStatus(): Promise<ManagedDatabaseStatus>

  startManagedDatabase(): Promise<ManagedDatabaseStatus>

  getOfficeBranding(): Promise<OfficeBranding>

  chooseOfficeLogo(): Promise<string | null>

  saveOfficeBranding(branding: OfficeBranding, proof?: string): Promise<OfficeBranding>

  getApplicationInformation(): Promise<ApplicationInformation>
  quitApplication(): Promise<void>

  getInstallationInformation(): Promise<InstallationInformation>

  configureInstallation(request: ConfigureInstallationRequest): Promise<InstallationInformation>

  restorePreviousInstallation(): Promise<InstallationInformation>

  restartApplication(): Promise<void>

  getHostStatus(): Promise<HostStatus>

  configureHostDatabase(request: DatabaseConfiguration): Promise<HostStatus>

  prepareHostDatabase(request: MigrationCredentials): Promise<HostStatus>

}

export const applicationInformationChannel = 'application:getInformation'
/**
 * Salir definitivamente (2026-10-04, pedido del usuario): con "seguir en segundo plano" cerrar la ventana sólo la
 * oculta y el Host sigue atendiendo a los demás equipos. Este canal cierra Fiscenix de verdad y detiene el Host, por el
 * mismo camino que "Salir y detener el Host" de la bandeja (antes revisa borradores sin guardar).
 */
export const applicationQuitChannel = 'application:quit'





