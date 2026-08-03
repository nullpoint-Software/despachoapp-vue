import type { AxiosInstance } from "axios";

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export interface BackupConfig {
  backupDir: string;
  storageRoot: string;
  cron: string;
  timezone: string;
  retentionDays: number;
  retentionMaxFiles: number;
  schedulerEnabled: boolean;
  creating: boolean;
  importing: boolean;
}

export interface BackupOverview {
  backups: BackupFile[];
  config: BackupConfig;
}

class BackupService {
  constructor(private serverip: string, private axios: AxiosInstance) {}

  async getOverview(): Promise<BackupOverview> {
    return (await this.axios.get(`${this.serverip}/backups`)).data;
  }

  async createBackup(reason = "manual"): Promise<BackupFile> {
    return (await this.axios.post(`${this.serverip}/backups`, { reason })).data.backup;
  }

  async deleteBackup(filename: string): Promise<void> {
    await this.axios.delete(`${this.serverip}/backups/${encodeURIComponent(filename)}`);
  }

  async pruneBackups(): Promise<{ deleted: number }> {
    return (await this.axios.post(`${this.serverip}/backups/prune`)).data;
  }

  async downloadBackup(filename: string): Promise<Blob> {
    return (await this.axios.get(`${this.serverip}/backups/${encodeURIComponent(filename)}/download`, {
      responseType: "blob",
    })).data;
  }

  async importBackup(file: File): Promise<any> {
    const data = new FormData();
    data.append("backup", file);
    return (await this.axios.post(`${this.serverip}/backups/import`, data, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    })).data;
  }
}

export default BackupService;
