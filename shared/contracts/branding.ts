export interface OfficeBranding { officeName: string; logoDataUrl: string | null }
export const defaultOfficeBranding: OfficeBranding = { officeName: 'Fiscenix', logoDataUrl: null }
export const brandingChannels = { get: 'branding:get', chooseLogo: 'branding:chooseLogo', save: 'branding:save' } as const
/** Sólo un PNG acotado, sin URLs externas, HTML, SVG activo ni rutas del dispositivo. */
export function parseOfficeBranding(value: unknown): OfficeBranding {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'logoDataUrl,officeName') throw new Error('Invalid branding')
  const record = value as Record<string, unknown>
  if (typeof record.officeName !== 'string' || record.officeName.trim().length < 1 || record.officeName.length > 80 || [...record.officeName].some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid office name')
  return { officeName: record.officeName.trim(), logoDataUrl: parseLogoDataUrl(record.logoDataUrl) }
}
export function parseLogoDataUrl(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > 700000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Invalid office logo')
  return value
}
