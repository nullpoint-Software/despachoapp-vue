<script setup lang="ts">
import { computed } from 'vue'
import type { CfdiAnalysis, CfdiTaxLine } from '../../../shared/contracts/cfdi'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { voucherTypeLabels, formatIssuedAt, formatTotal } from './xmlLabels'
import { describeCfdiIssue, describeCode, paymentFormNames, paymentMethodNames, relationTypeNames, taxNames } from './cfdiLabels'
import { cfdiDirectionLabels, type CfdiClientMatch } from './cfdiClientMatch'
import { describeTaxRegime } from '../../../shared/fiscal/taxRegimes'
import { useSatCodeDescriptions, type SatCodeRequest } from '../catalogs/satCodeLookup'

/**
 * Datos fiscales de un CFDI de este equipo (6.1): encabezado, partes, totales, desglose de impuestos
 * como el sistema original, conceptos, relaciones, pagos y avisos de estructura o totales. Sólo
 * presenta lo que Main calculó; nada de esto sale del equipo hasta relacionarlo con un reporte (6.2).
 */
const props = defineProps<{ analysis: CfdiAnalysis; clientMatch: CfdiClientMatch | null }>()
/**
 * Significados de los códigos con los catálogos SAT de este equipo (ADR-032): uso del CFDI, moneda y las claves de
 * producto y unidad de cada concepto. El régimen fiscal sale del catálogo incluido en la app.
 */
const describeSatCode = useSatCodeDescriptions(() => [
  { catalogId: 'usoCfdi', code: props.analysis.usage ?? '' }, { catalogId: 'moneda', code: props.analysis.currency },
  ...props.analysis.concepts.flatMap((concept): SatCodeRequest[] => [{ catalogId: 'claveProdServ', code: concept.productCode }, { catalogId: 'claveUnidad', code: concept.unitCode }])
])
const withMeaning = (code: string | null, meaning: string) => code ? code + (meaning ? ' · ' + meaning : '') : '—'
const money = (value: string | null) => value === null ? '—' : formatTotal(value, props.analysis.currency)
const breakdownRows = computed(() => {
  const value = props.analysis.breakdown
  return [
    ['Base IVA 16 %', value.vatBase16], ['IVA 16 %', value.vat16], ['Base IVA 8 %', value.vatBase8], ['IVA 8 %', value.vat8],
    ['Base IVA 0 %', value.vatBase0], ['Base exenta', value.exemptBase], ['Base no objeto', value.notSubjectBase],
    ['IVA retenido', value.vatWithheld], ['ISR retenido', value.isrWithheld], ['IEPS trasladado', value.iepsTransferred], ['IEPS retenido', value.iepsWithheld], ['Otros impuestos', value.otherTaxes]
  ].filter(([, amount]) => amount !== '0.00') as Array<[string, string]>
})
function describeTax(line: CfdiTaxLine): string {
  const name = taxNames[line.taxCode] ?? line.taxCode
  if (line.factorType === 'Exento') return name + ' exento'
  const rate = line.rate === null ? '' : ' ' + (Number(line.rate) * 100).toLocaleString('es-MX', { maximumFractionDigits: 4 }) + (line.factorType === 'Cuota' ? '' : ' %')
  return name + rate + (line.amount === null ? '' : ': ' + money(line.amount))
}
</script>
<template>
  <div
    class="cfdi-detail"
    data-testid="cfdi-detail"
  >
    <InlineNotice
      v-if="analysis.issues.length"
      title="Revisa este CFDI"
      tone="warning"
    >
      <ul class="cfdi-issues">
        <li
          v-for="issue in analysis.issues"
          :key="issue.code"
        >
          {{ describeCfdiIssue(issue) }}
        </li>
      </ul>
      <p class="field-help">
        Se conserva tal como llegó; los avisos no lo rechazan.
      </p>
    </InlineNotice>
    <p
      v-else
      class="field-help cfdi-ok"
    >
      Estructura y totales en orden. El sello y el estatus en el SAT no se revisan aquí.
    </p>

    <dl class="cfdi-facts">
      <div>
        <dt>Tipo</dt><dd>
          <StatusBadge :tone="analysis.voucherType === 'E' ? 'warning' : analysis.voucherType === 'I' ? 'success' : 'info'">
            {{ voucherTypeLabels[analysis.voucherType] }}
          </StatusBadge>
        </dd>
      </div>
      <div><dt>Serie y folio</dt><dd>{{ [analysis.series, analysis.folio].filter(Boolean).join('-') || '—' }}</dd></div>
      <div><dt>Emitido</dt><dd>{{ formatIssuedAt(analysis.issuedAt) }}</dd></div>
      <div><dt>Timbrado</dt><dd>{{ analysis.stampedAt ? formatIssuedAt(analysis.stampedAt) : '—' }}</dd></div>
      <div><dt>Moneda</dt><dd>{{ withMeaning(analysis.currency, describeSatCode('moneda', analysis.currency)) }}{{ analysis.exchangeRate ? ' · TC ' + analysis.exchangeRate : '' }}</dd></div>
      <div><dt>Método de pago</dt><dd>{{ describeCode(analysis.paymentMethod, paymentMethodNames) }}</dd></div>
      <div><dt>Forma de pago</dt><dd>{{ describeCode(analysis.paymentForm, paymentFormNames) }}</dd></div>
      <div><dt>Uso CFDI</dt><dd>{{ withMeaning(analysis.usage, describeSatCode('usoCfdi', analysis.usage)) }}</dd></div>
    </dl>

    <div class="cfdi-parties">
      <section aria-label="Emisor">
        <p class="party-label">
          Emisor{{ clientMatch?.direction === 'issued' ? ' · cliente' : '' }}
        </p>
        <strong>{{ analysis.issuer.name || analysis.issuer.rfc }}</strong>
        <span class="field-help">{{ analysis.issuer.rfc }}{{ analysis.issuer.taxRegime ? ' · régimen ' + describeTaxRegime(analysis.issuer.taxRegime) : '' }}</span>
      </section>
      <section aria-label="Receptor">
        <p class="party-label">
          Receptor{{ clientMatch?.direction === 'received' ? ' · cliente' : '' }}
        </p>
        <strong>{{ analysis.receiver.name || analysis.receiver.rfc }}</strong>
        <span class="field-help">{{ analysis.receiver.rfc }}{{ analysis.receiver.taxRegime ? ' · régimen ' + describeTaxRegime(analysis.receiver.taxRegime) : '' }}</span>
      </section>
      <section aria-label="Cliente">
        <p class="party-label">
          Cliente
        </p>
        <strong>{{ clientMatch ? clientMatch.clientName : 'Sin cliente' }}</strong>
        <span class="field-help">{{ clientMatch ? cfdiDirectionLabels[clientMatch.direction] + ' por el cliente' : 'Ningún RFC coincide con tus clientes asignados.' }}</span>
      </section>
    </div>

    <div class="cfdi-columns">
      <section aria-labelledby="cfdi-totals">
        <h3 id="cfdi-totals">
          Totales
        </h3>
        <dl class="cfdi-amounts">
          <div>
            <dt>Subtotal</dt><dd class="numeric">
              {{ money(analysis.subtotal) }}
            </dd>
          </div>
          <div v-if="analysis.discount">
            <dt>Descuento</dt><dd class="numeric">
              -{{ money(analysis.discount) }}
            </dd>
          </div>
          <div v-if="analysis.transferredTaxTotal">
            <dt>Impuestos trasladados</dt><dd class="numeric">
              {{ money(analysis.transferredTaxTotal) }}
            </dd>
          </div>
          <div v-if="analysis.withheldTaxTotal">
            <dt>Impuestos retenidos</dt><dd class="numeric">
              -{{ money(analysis.withheldTaxTotal) }}
            </dd>
          </div>
          <div class="cfdi-total">
            <dt>Total</dt><dd class="numeric">
              {{ money(analysis.total) }}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="cfdi-breakdown">
        <h3 id="cfdi-breakdown">
          Desglose de impuestos
        </h3>
        <dl
          v-if="breakdownRows.length"
          class="cfdi-amounts"
        >
          <div
            v-for="[label, amount] in breakdownRows"
            :key="label"
          >
            <dt>{{ label }}</dt><dd class="numeric">
              {{ money(amount) }}
            </dd>
          </div>
        </dl>
        <p
          v-else
          class="field-help"
        >
          Sin impuestos.
        </p>
      </section>
    </div>

    <section
      v-if="analysis.concepts.length"
      aria-labelledby="cfdi-concepts"
    >
      <h3 id="cfdi-concepts">
        Conceptos ({{ analysis.concepts.length }})
      </h3>
      <div
        class="table-region"
        tabindex="0"
        aria-label="Conceptos del CFDI"
      >
        <table>
          <thead>
            <tr>
              <th>Clave</th><th>Descripción</th><th>Cantidad</th><th>Importe</th><th>Impuestos</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(concept, index) in analysis.concepts"
              :key="index"
            >
              <td class="nowrap">
                {{ concept.productCode }}<span
                  v-if="describeSatCode('claveProdServ', concept.productCode)"
                  class="field-help concept-meaning"
                >{{ describeSatCode('claveProdServ', concept.productCode) }}</span>
              </td>
              <td>{{ concept.description }}</td>
              <td class="numeric">
                {{ concept.quantity }} {{ concept.unitCode }}<span
                  v-if="describeSatCode('claveUnidad', concept.unitCode)"
                  class="field-help concept-meaning"
                >{{ describeSatCode('claveUnidad', concept.unitCode) }}</span>
              </td>
              <td class="numeric nowrap">
                {{ money(concept.amount) }}<span
                  v-if="concept.discount"
                  class="field-help"
                > (−{{ money(concept.discount) }})</span>
              </td>
              <td>
                <span
                  v-for="(line, lineIndex) in concept.transfers"
                  :key="'t' + lineIndex"
                  class="cfdi-tax"
                >{{ describeTax(line) }}</span>
                <span
                  v-for="(line, lineIndex) in concept.withholdings"
                  :key="'r' + lineIndex"
                  class="cfdi-tax"
                >Ret. {{ describeTax(line) }}</span>
                <span
                  v-if="!concept.transfers.length && !concept.withholdings.length"
                  class="field-help"
                >{{ concept.taxObject === '01' ? 'No objeto' : '—' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="analysis.relations.length"
      aria-labelledby="cfdi-relations"
    >
      <h3 id="cfdi-relations">
        CFDI relacionados
      </h3>
      <ul class="cfdi-list">
        <li
          v-for="relation in analysis.relations"
          :key="relation.relationType"
        >
          <strong>{{ describeCode(relation.relationType, relationTypeNames) }}</strong>
          <span
            v-for="uuid in relation.uuids"
            :key="uuid"
            class="cfdi-uuid"
          >{{ uuid.toUpperCase() }}</span>
        </li>
      </ul>
    </section>

    <section
      v-if="analysis.payments.length"
      aria-labelledby="cfdi-payments"
    >
      <h3 id="cfdi-payments">
        Pagos ({{ analysis.payments.length }})
      </h3>
      <ul class="cfdi-list">
        <li
          v-for="(item, index) in analysis.payments"
          :key="index"
        >
          <strong>{{ formatIssuedAt(item.paidAt) }} · {{ formatTotal(item.amount, item.currency) }} · {{ describeCode(item.paymentForm, paymentFormNames) }}</strong>
          <span
            v-for="document in item.documents"
            :key="document.uuid"
            class="field-help"
          >{{ document.uuid.toUpperCase() }} · parcialidad {{ document.installment ?? '—' }} · pagado {{ formatTotal(document.paidAmount, document.currency ?? item.currency) }}{{ document.remainingBalance ? ' · saldo ' + formatTotal(document.remainingBalance, document.currency ?? item.currency) : '' }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
<style scoped>
.cfdi-detail { display: grid; gap: var(--spaceMedium); min-width: 0; container-type: inline-size; }
.cfdi-detail h3 { font-size: 13px; letter-spacing: .05em; text-transform: uppercase; margin: 0 0 8px; }
.cfdi-ok { margin: 0; }
/* Significado de la clave según el catálogo SAT descargado, debajo del código. */
.concept-meaning { display: block; max-width: 22ch; white-space: normal; }
.cfdi-issues { margin: 0 0 6px; padding-left: 18px; }
/* Líneas por celda (no con el hueco del grid): una fila incompleta no deja un bloque de color de borde. */
.cfdi-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); margin: 0; border-top: 1px solid var(--borderColor); border-left: 1px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); overflow: hidden; }
.cfdi-facts div { padding: 10px 12px; min-width: 0; border-right: 1px solid var(--borderColor); border-bottom: 1px solid var(--borderColor); }
.cfdi-facts dt, .cfdi-amounts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.cfdi-facts dd { margin: 4px 0 0; overflow-wrap: anywhere; }
.cfdi-parties { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--spaceMedium); }
.cfdi-parties section { display: grid; gap: 4px; padding: 12px; border: 2px solid var(--borderColor); background: var(--surfaceColor); min-width: 0; overflow-wrap: anywhere; border-radius: var(--radiusNested); }
.cfdi-parties .party-label { margin: 0; font-size: 12px; color: var(--mutedTextColor); }
.cfdi-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: var(--spaceMedium); }
.cfdi-amounts { margin: 0; display: grid; border: 2px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); }
.cfdi-amounts div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--borderColor); }
.cfdi-amounts div:last-child { border-bottom: 0; }
.cfdi-amounts dd { margin: 0; }
.cfdi-total { background: var(--subtleColor); font-weight: 700; }
.cfdi-tax { display: block; font-size: 12px; }
.cfdi-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.cfdi-list li { display: grid; gap: 4px; padding: 10px 12px; border: 2px solid var(--borderColor); background: var(--surfaceColor); overflow-wrap: anywhere; border-radius: var(--radiusNested); }
.cfdi-uuid { font-family: var(--monoFontFamily); font-size: 12px; }
</style>
