declare module '@abrazasoft/thermal_printer_vuejs' {
  export default class ThermalPrinterConnector {
    static obtenerImpresoras(): Promise<string[]>
    textaling(alignment: 'left' | 'center' | 'right'): void
    img_url(url: string): void
    feed(lines: string): void
    fontsize(size: string): void
    text(value: string): void
    barcode_128(value: string): void
    cut(mode: string): void
    imprimir(printer: string, apiKey: string): Promise<boolean | string>
  }
}
