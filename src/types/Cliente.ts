interface Cliente {
  id_cliente: String
  nombre: String
  rfc: String
  regimen_fiscal?: String | null
  fiel: String
  ciecf: String
  email: String
  telefono: String
}

export type { Cliente }
