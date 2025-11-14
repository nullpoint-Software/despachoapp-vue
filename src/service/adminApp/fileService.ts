import type { AxiosInstance } from "axios";

class FileService {
  private serverip: string;
  private axios: AxiosInstance;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  async upload(file: File, type?: string, cliente_id?: number | null): Promise<any> {
    try {
      const form = new FormData();
      form.append("file", file);
      if (type) form.append("type", type);
      if (cliente_id != null) form.append("cliente_id", String(cliente_id));

      const response = await this.axios.post(`${this.serverip}/files/upload`, form);
      return response.data;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }

async getFiles(cliente_id?: string | number, fileid?: string | number): Promise<any> {
    try {
        const params: any = {};
        if (cliente_id !== undefined && cliente_id !== null) params.cliente_id = cliente_id;
        if (fileid !== undefined && fileid !== null) params.id = fileid;
        const response = await this.axios.get(`${this.serverip}/files`, { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching files:", error);
        throw error;
    }
}

  // Returns a Blob for the caller to handle (save file, createObjectURL, etc.)
  async downloadFile(id: number | string): Promise<Blob> {
    try {
      const response = await this.axios.get(`${this.serverip}/files/${id}/download`, { responseType: "blob" });
      return response.data as Blob;
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  }

  async deleteFile(id: number | string): Promise<any> {
    try {
      const response = await this.axios.delete(`${this.serverip}/files/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }

  async renameFile(id: number | string, newFilename: string): Promise<any> {
    try {
      const response = await this.axios.put(`${this.serverip}/files/${id}`, { newFilename });
      return response.data;
    } catch (error) {
      console.error("Error renaming file:", error);
      throw error;
    }
  }
}

export default FileService;
