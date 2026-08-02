export interface SatProductRecord {
  i: string;
  d: string;
  s: string;
  v: string;
  f: string;
  t: string;
  e: string;
}

export interface SatSearchRecord extends SatProductRecord {
  normalizedDescription: string;
  normalizedSimilar: string;
}

let catalogPromise: Promise<SatSearchRecord[]> | null = null;

export const normalizeSatText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const loadSatProductCatalog = (): Promise<SatSearchRecord[]> => {
  if (!catalogPromise) {
    catalogPromise = fetch(`${import.meta.env.BASE_URL}data/catalogo-productos-sat.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`No se pudo cargar el cat?logo (${response.status})`);
        }
        return response.json() as Promise<SatProductRecord[]>;
      })
      .then((records) =>
        records.map((record) => ({
          ...record,
          normalizedDescription: normalizeSatText(record.d),
          normalizedSimilar: normalizeSatText(record.s),
        })),
      )
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }

  return catalogPromise;
};

export const resetSatProductCatalog = () => {
  catalogPromise = null;
};
