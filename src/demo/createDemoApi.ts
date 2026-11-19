import type { DesktopApi } from '../../shared/contracts/desktop'
import { rejectInDemo } from './demoUnavailable'
import type { DemoStore } from './demoStore'
import { createDemoSessionHandler } from './handlers/demoSessionHandler'
import { createDemoPlatformHandler } from './handlers/demoPlatformHandler'
import { createDemoPreferencesHandler } from './handlers/demoPreferencesHandler'
import { createDemoBrandingHandler } from './handlers/demoBrandingHandler'

export interface DemoApiOptions { now?: () => Date; storage?: Pick<Storage, 'getItem' | 'setItem'> | null; reloadPage?: () => void }

/**
 * Ensambla `window.contapp` de la demo: los handlers simulados más todo el resto del contrato rechazado con
 * `rejectInDemo`. El literal está tipado `DesktopApi`, así que añadir un método al contrato rompe el typecheck
 * hasta que se liste aquí.
 */
export function createDemoApi(store: DemoStore, options: DemoApiOptions = {}): DesktopApi {
  return {
    ...createDemoSessionHandler(store, options.now ?? (() => new Date())),
    ...createDemoPlatformHandler(options.reloadPage ?? (() => undefined)),
    ...createDemoPreferencesHandler(options.storage ?? null),
    ...createDemoBrandingHandler(store),
    manageLinkFile: rejectInDemo('manageLinkFile'),
    manageClients: rejectInDemo('manageClients'),
    manageDocuments: rejectInDemo('manageDocuments'),
    manageMovements: rejectInDemo('manageMovements'),
    manageTasks: rejectInDemo('manageTasks'),
    administerAccess: rejectInDemo('administerAccess'),
    administerDevices: rejectInDemo('administerDevices'),
    manageHostTrust: rejectInDemo('manageHostTrust'),
    manageDockerRuntime: rejectInDemo('manageDockerRuntime'),
    createAdministrator: rejectInDemo('createAdministrator'),
    getDiscoveryStatus: rejectInDemo('getDiscoveryStatus'),
    findHosts: rejectInDemo('findHosts'),
    selectDiscoveredHost: rejectInDemo('selectDiscoveredHost'),
    setManualHost: rejectInDemo('setManualHost'),
    readLocalNotes: rejectInDemo('readLocalNotes'),
    saveLocalNotes: rejectInDemo('saveLocalNotes'),
    exportLocalNotes: rejectInDemo('exportLocalNotes'),
    chooseNotesImport: rejectInDemo('chooseNotesImport'),
    listLocalXml: rejectInDemo('listLocalXml'),
    prepareMovementReceipt: rejectInDemo('prepareMovementReceipt'),
    prepareCashCutTicket: rejectInDemo('prepareCashCutTicket'),
    prepareTestTicket: rejectInDemo('prepareTestTicket'),
    printTicket: rejectInDemo('printTicket'),
    importLocalXml: rejectInDemo('importLocalXml'),
    importLocalXmlFiles: rejectInDemo('importLocalXmlFiles'),
    readLocalXml: rejectInDemo('readLocalXml'),
    analyzeLocalXml: rejectInDemo('analyzeLocalXml'),
    manageFiscalReports: rejectInDemo('manageFiscalReports'),
    addCfdisToReport: rejectInDemo('addCfdisToReport'),
    exportReportCsv: rejectInDemo('exportReportCsv'),
    exportReportXlsx: rejectInDemo('exportReportXlsx'),
    exportDiotFile: rejectInDemo('exportDiotFile'),
    manageTaxObligations: rejectInDemo('manageTaxObligations'),
    readStoredCertificateObligations: rejectInDemo('readStoredCertificateObligations'),
    openObligationReportPdf: rejectInDemo('openObligationReportPdf'),
    manageSatDownloads: rejectInDemo('manageSatDownloads'),
    requestSatDownload: rejectInDemo('requestSatDownload'),
    readSatCredential: rejectInDemo('readSatCredential'),
    saveSatCredential: rejectInDemo('saveSatCredential'),
    deleteSatCredential: rejectInDemo('deleteSatCredential'),
    manageOpinions: rejectInDemo('manageOpinions'),
    manageTaxStatus: rejectInDemo('manageTaxStatus'),
    manageSatPortal: rejectInDemo('manageSatPortal'),
    manageSatPortalCfdi: rejectInDemo('manageSatPortalCfdi'),
    manageSchedules: rejectInDemo('manageSchedules'),
    manageBackups: rejectInDemo('manageBackups'),
    restoreBackup: rejectInDemo('restoreBackup'),
    runLegacyMigration: rejectInDemo('runLegacyMigration'),
    readDiagnostics: rejectInDemo('readDiagnostics'),
    fetchNoteImage: rejectInDemo('fetchNoteImage'),
    manageClientCredentials: rejectInDemo('manageClientCredentials'),
    manageSatCatalogs: rejectInDemo('manageSatCatalogs'),
    readTeamOverview: rejectInDemo('readTeamOverview'),
    manageUserPhotos: rejectInDemo('manageUserPhotos'),
    manageMailAccount: rejectInDemo('manageMailAccount'),
    manageMailDomain: rejectInDemo('manageMailDomain'),
    manageMail: rejectInDemo('manageMail'),
    readFiscalTable: rejectInDemo('readFiscalTable'),
    openReportPdf: rejectInDemo('openReportPdf'),
    openCfdiPdf: rejectInDemo('openCfdiPdf'),
    openCompletedTasksPdf: rejectInDemo('openCompletedTasksPdf'),
    savePdfView: rejectInDemo('savePdfView'),
    printPdfView: rejectInDemo('printPdfView'),
    releasePdfView: rejectInDemo('releasePdfView'),
    manageBankReconciliation: rejectInDemo('manageBankReconciliation'),
    reconcileBankStatement: rejectInDemo('reconcileBankStatement'),
    exportReconciliationCsv: rejectInDemo('exportReconciliationCsv'),
    saveLocalXmlCopy: rejectInDemo('saveLocalXmlCopy'),
    trashLocalXml: rejectInDemo('trashLocalXml'),
    restoreLocalXml: rejectInDemo('restoreLocalXml'),
    startManagedDatabase: rejectInDemo('startManagedDatabase'),
    chooseOfficeLogo: rejectInDemo('chooseOfficeLogo'),
    saveOfficeBranding: rejectInDemo('saveOfficeBranding'),
    configureInstallation: rejectInDemo('configureInstallation'),
    restorePreviousInstallation: rejectInDemo('restorePreviousInstallation'),
    configureHostDatabase: rejectInDemo('configureHostDatabase'),
    prepareHostDatabase: rejectInDemo('prepareHostDatabase')
  }
}
