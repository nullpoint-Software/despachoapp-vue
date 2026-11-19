/**
 * pdfjs-dist no publica tipos para su módulo de worker. `readPdfText` sólo lo carga para dejarlo en
 * `globalThis.pdfjsWorker` (worker en el mismo proceso); de él pdfjs usa `WorkerMessageHandler`.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown
}
