import type { AxiosInstance } from 'axios'

export interface BackupFile {
  filename: string
  size: number
  createdAt: string
}

export interface BackupConfig {
  backupDir: string
  storageRoot: string
  cron: string
  timezone: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  time: string
  dayOfWeek: number
  dayOfMonth: number
  retentionDays: number
  retentionMaxFiles: number
  schedulerEnabled: boolean
  creating: boolean
  importing: boolean
}

export type BackupSchedulePayload = Pick<
  BackupConfig,
  'schedulerEnabled' | 'frequency' | 'time' | 'dayOfWeek' | 'dayOfMonth' | 'timezone' | 'cron'
>

export interface BackupOverview {
  backups: BackupFile[]
  config: BackupConfig
}

class BackupService {
  constructor(
    private serverip: string,
    private axios: AxiosInstance
  ) {}

  async getOverview(): Promise<BackupOverview> {
    return (await this.axios.get(`${this.serverip}/backups`)).data
  }

  async createBackup(reason = 'manual'): Promise<BackupFile> {
    return (await this.axios.post(`${this.serverip}/backups`, { reason })).data.backup
  }

  async updateConfig(config: BackupSchedulePayload): Promise<BackupConfig> {
    return (await this.axios.put(`${this.serverip}/backups/config`, config)).data.config
  }

  async deleteBackup(filename: string): Promise<void> {
    await this.axios.delete(`${this.serverip}/backups/${encodeURIComponent(filename)}`)
  }

  async pruneBackups(): Promise<{ deleted: number }> {
    return (await this.axios.post(`${this.serverip}/backups/prune`)).data
  }

  async downloadBackup(filename: string): Promise<Blob> {
    return (
      await this.axios.get(`${this.serverip}/backups/${encodeURIComponent(filename)}/download`, {
        responseType: 'blob'
      })
    ).data
  }

  async importBackup(file: File): Promise<any> {
    const data = new FormData()
    data.append('backup', file)
    return (
      await this.axios.post(`${this.serverip}/backups/import`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      })
    ).data
  }
  async previewLegacy(file: File, decisions: Record<string, string> = {}): Promise<any> {
    const data = new FormData()
    data.append('file', file)
    data.append('decisions', JSON.stringify(decisions))
    return (
      await this.axios.post(`${this.serverip}/legacy-migration/preview`, data, { timeout: 120000 })
    ).data
  }
  async migrateLegacy(
    file: File,
    token: string,
    confirmation: string,
    decisions: Record<string, string> = {}
  ): Promise<any> {
    const data = new FormData()
    data.append('file', file)
    data.append('decisions', JSON.stringify(decisions))
    data.append('token', token)
    data.append('confirmation', confirmation)
    return (
      await this.axios.post(`${this.serverip}/legacy-migration/execute`, data, { timeout: 600000 })
    ).data
  }
  async legacyEvents(): Promise<Blob> {
    return (
      await this.axios.get(`${this.serverip}/legacy-migration/events`, { responseType: 'blob' })
    ).data
  }
}

export default BackupService
