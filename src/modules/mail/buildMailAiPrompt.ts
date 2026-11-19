/**
 * Prompt para que una IA externa diseñe un cuerpo o una firma de correo (2026-10-18, pedido del usuario: "un botón para
 * que la IA cree un cuerpo o firma con el HTML y estos valores (sólo un prompt y que pregunte otros datos como correos y
 * números)"). Fiscenix NO se conecta a ninguna IA: arma el texto, la persona lo copia en la que prefiera, contesta sus
 * preguntas y pega el HTML resultante en «HTML y vista previa», donde se sanea como cualquier otro código.
 *
 * El prompt fija las reglas que acepta `sanitizeMailHtml` (tablas y estilos en línea, enlaces https/mailto/tel, sin
 * imágenes externas ni `<style>`), los marcadores que Fiscenix llena al enviar y pide a la IA que pregunte antes los
 * datos que falten en lugar de inventarlos.
 */
export type MailAiPurpose = 'body' | 'signature'

const placeholdersByPurpose: Record<MailAiPurpose, string[]> = {
  signature: ['{usuario} — nombre de quien envía el correo', '{despacho} — nombre del despacho', '{logo} — logo del despacho (imagen)'],
  body: ['{cliente} — nombre del cliente', '{documento} — documento que se envía (por ejemplo, Factura)', '{usuario} — nombre de quien envía el correo', '{despacho} — nombre del despacho', '{logo} — logo del despacho (imagen)']
}

export function buildMailAiPrompt(parts: { purpose: MailAiPurpose; request: string; officeName: string }): string {
  const what = parts.purpose === 'signature' ? 'una firma de correo electrónico' : 'el cuerpo de un correo electrónico'
  const request = parts.request.trim() || (parts.purpose === 'signature' ? 'Una firma profesional y sobria.' : 'Un correo profesional y breve para enviar documentos a los clientes.')
  return [
    `Eres diseñador de correos electrónicos. Crea ${what} en HTML para el despacho contable "${parts.officeName.trim() || 'el despacho'}".`,
    '',
    'Lo que necesito:',
    request,
    '',
    'Antes de escribir el HTML, pregúntame en una sola lista los datos que te falten (por ejemplo: nombre y puesto, correos, teléfonos, dirección, sitio web, redes sociales y colores de la marca). No inventes correos, teléfonos, direcciones ni enlaces: espera mis respuestas.',
    '',
    'Reglas del HTML (el sistema descarta todo lo demás):',
    '- Sólo el contenido del correo: sin <html>, <head>, <body>, <style>, <script>, formularios ni comentarios.',
    '- Maquetación con <table> (cellpadding, cellspacing, border, width), <tr>, <td>, <div>, <span>, <p>, <a>, <strong>, <br> y <hr>.',
    '- Todos los estilos en línea con el atributo style (color, background-color, font-family, font-size, font-weight, letter-spacing, line-height, text-align, padding, margin, border, width). Sin clases, sin url() ni imágenes de fondo.',
    '- Fuentes seguras para correo: Arial, Helvetica, sans-serif. Ancho máximo de 600 px.',
    '- Enlaces sólo con https:, mailto: o tel:.',
    '- Sin imágenes externas. Para el logo del despacho escribe {logo} donde deba aparecer.',
    '- Escribe estos marcadores tal cual donde correspondan; el sistema los llena al enviar:',
    ...placeholdersByPurpose[parts.purpose].map(item => '  ' + item),
    '',
    'Cuando tengas mis respuestas, entrega sólo el código HTML en un bloque de código, sin explicación.'
  ].join('\n')
}
