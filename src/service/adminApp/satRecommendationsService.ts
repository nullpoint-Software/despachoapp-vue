import type { AxiosInstance } from 'axios'

export interface SatRecommendationSuggestion {
  code: string
  description: string
  reason: string
}

export interface SatRecommendationResult {
  key: string
  query: string
  aliases: string[]
  summary: string
  suggestions: SatRecommendationSuggestion[]
  note: string
  status: 'generated' | 'confirmed'
  source: 'seed' | 'learned'
  uses: number
}

export interface SatCodeExamples {
  code: string
  description: string
  examples: string[]
  note: string
  source: 'seed' | 'learned'
}

export interface SatManualRecommendationInput {
  query: string
  summary: string
  aliases: string[]
  suggestions: SatRecommendationSuggestion[]
  note: string
}

export interface SatImportResult {
  importedRecommendations: number
  importedCodeExamples: number
  totalRecommendations: number
  totalCodeExamples: number
}

export default class SatRecommendationsService {
  constructor(
    private readonly serverip: string,
    private readonly axios: AxiosInstance
  ) {}

  async find(query: string): Promise<SatRecommendationResult | null> {
    const response = await this.axios.get(`${this.serverip}/sat-recommendations/search`, {
      params: { q: query }
    })
    return response.data.recommendation || null
  }

  async save(
    query: string,
    summary: string,
    suggestions: SatRecommendationSuggestion[],
    note: string
  ): Promise<SatRecommendationResult> {
    const response = await this.axios.post(`${this.serverip}/sat-recommendations/search`, {
      query,
      summary,
      suggestions,
      note
    })
    return response.data.recommendation
  }

  async confirm(query: string, code: string): Promise<SatRecommendationResult> {
    const response = await this.axios.patch(`${this.serverip}/sat-recommendations/confirm`, {
      query,
      code
    })
    return response.data.recommendation
  }

  async getExamples(code: string): Promise<SatCodeExamples | null> {
    const response = await this.axios.get(
      `${this.serverip}/sat-recommendations/codes/${encodeURIComponent(code)}`
    )
    return response.data.examples || null
  }

  async saveExamples(payload: Omit<SatCodeExamples, 'source'>): Promise<SatCodeExamples> {
    const response = await this.axios.post(
      `${this.serverip}/sat-recommendations/codes/${encodeURIComponent(payload.code)}`,
      payload
    )
    return response.data.examples
  }

  async saveManual(input: SatManualRecommendationInput): Promise<SatRecommendationResult> {
    const response = await this.axios.post(`${this.serverip}/sat-recommendations/search`, input)
    return response.data.recommendation
  }

  async exportRecommendations(): Promise<Blob> {
    const response = await this.axios.get(`${this.serverip}/sat-recommendations/export`, {
      responseType: 'blob'
    })
    return response.data
  }

  async importRecommendations(payload: unknown): Promise<SatImportResult> {
    const response = await this.axios.post(`${this.serverip}/sat-recommendations/import`, payload)
    return response.data.result
  }
}
