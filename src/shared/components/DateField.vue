<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { CalendarCheck, CalendarDays, CalendarX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from '@lucide/vue'
import { useDialogMotion } from '../motion/dialogMotion'
import { formatTypedDate } from './typedDate'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import { getOfficeToday } from '../../../shared/contracts/movements'

/**
 * Campo de fecha con el formato de la app (2026-10-04, pedido del usuario), reutilizado en Tareas, Pagos, el corte de
 * caja y las descargas del SAT. El campo es un botón que muestra "04 oct 2026"; al pulsarlo abre un modal propio:
 * - calendario del mes (lunes primero) con día de hoy marcado y el elegido en azul tinta;
 * - « ‹ › » cambian de año y de mes; junto a "Escribir fecha", el icono Hoy elige la fecha de la oficina y el de
 *   Quitar fecha aparece sólo si `isClearable`;
 * - "Escribir fecha" acepta dd/mm/aaaa (más rápido al capturar) y se aplica con Enter.
 * Teclado en el calendario: flechas mueven el día, Re Pág / Av Pág cambian de mes, Enter elige, Escape cierra.
 * El modelo es la fecha de negocio `aaaa-mm-dd` (o vacío), la misma que validan los contratos. `min`/`max` deshabilitan
 * los días fuera de rango.
 */
const props = defineProps<{ id: string; label: string; help?: string; error?: string; disabled?: boolean; isClearable?: boolean; min?: string; max?: string; placeholder?: string }>()
const value = defineModel<string>({ default: '' })
const dialog = ref<HTMLDialogElement | null>(null), grid = ref<HTMLElement | null>(null)
const motion = useDialogMotion(dialog)
const titleId = useId()
const today = getOfficeToday()
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const weekdayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const weekdayLongNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
/** Mes visible (año y mes 1-12) y día con el foco del teclado dentro del calendario. */
const visibleYear = ref(0), visibleMonth = ref(1), focusedDate = ref(''), typedDate = ref(''), typedError = ref('')

const pad = (number: number) => String(number).padStart(2, '0')
const toBusinessDate = (year: number, month: number, day: number) => year + '-' + pad(month) + '-' + pad(day)
const parts = (date: string) => date.split('-').map(Number) as [number, number, number]
function shiftDays(date: string, days: number): string {
  const [year, month, day] = parts(date)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}
function shiftMonths(date: string, months: number): string {
  const [year, month, day] = parts(date)
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10)
}
const isOutOfRange = (date: string) => Boolean((props.min && date < props.min) || (props.max && date > props.max))
/** 6 semanas × 7 días del mes visible, empezando en lunes; los días de otros meses se ven atenuados. */
const weeks = computed(() => {
  const firstWeekday = (new Date(Date.UTC(visibleYear.value, visibleMonth.value - 1, 1)).getUTCDay() + 6) % 7
  const start = shiftDays(toBusinessDate(visibleYear.value, visibleMonth.value, 1), -firstWeekday)
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, weekday) => {
    const date = shiftDays(start, week * 7 + weekday)
    return { date, day: parts(date)[2], isOtherMonth: parts(date)[1] !== visibleMonth.value }
  }))
})
const displayText = computed(() => value.value ? formatBusinessDate(value.value) : props.placeholder ?? 'Elegir fecha')

function showMonthOf(date: string): void { const [year, month] = parts(date); visibleYear.value = year; visibleMonth.value = month }
async function focusDay(date: string): Promise<void> {
  focusedDate.value = date; showMonthOf(date)
  await nextTick()
  grid.value?.querySelector<HTMLButtonElement>('[data-date="' + date + '"]')?.focus()
}
function openPicker(): void {
  if (props.disabled) return
  typedDate.value = value.value ? value.value.split('-').reverse().join('/') : ''; typedError.value = ''
  motion.open()
  void focusDay(value.value || today)
}
function closePicker(): void { motion.close() }
function choose(date: string): void {
  if (isOutOfRange(date)) return
  value.value = date; closePicker()
}
function changeMonth(months: number): void { void focusDay(shiftMonths(focusedDate.value || today, months)) }
function handleGridKey(event: KeyboardEvent): void {
  const moves: Record<string, () => string> = {
    ArrowLeft: () => shiftDays(focusedDate.value, -1), ArrowRight: () => shiftDays(focusedDate.value, 1),
    ArrowUp: () => shiftDays(focusedDate.value, -7), ArrowDown: () => shiftDays(focusedDate.value, 7),
    PageUp: () => shiftMonths(focusedDate.value, -1), PageDown: () => shiftMonths(focusedDate.value, 1)
  }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault(); void focusDay(move())
}
/** Pone las diagonales mientras se escribe (`formatTypedDate`) y deja el cursor al final del texto ya formateado. */
function onTypedInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const isAtEnd = input.selectionStart === input.value.length
  typedDate.value = formatTypedDate(input.value, (event as InputEvent).inputType?.startsWith('insert') ?? false)
  input.value = typedDate.value
  if (isAtEnd) input.setSelectionRange(input.value.length, input.value.length)
}
/** "dd/mm/aaaa" (también acepta guiones o puntos y año de dos cifras) → fecha de negocio válida, o error. */
function applyTyped(): void {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(typedDate.value.trim())
  if (!match) { typedError.value = 'Escribe la fecha como dd/mm/aaaa.'; return }
  const year = match[3]!.length === 2 ? 2000 + Number(match[3]) : Number(match[3])
  const date = toBusinessDate(year, Number(match[2]), Number(match[1]))
  if (shiftDays(date, 0) !== date) { typedError.value = 'Esa fecha no existe.'; return }
  if (isOutOfRange(date)) { typedError.value = 'Esa fecha está fuera del rango permitido.'; return }
  choose(date)
}
function describeDay(date: string): string {
  const [year, month, day] = parts(date)
  const weekday = weekdayLongNames[(new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7]
  return weekday + ' ' + day + ' de ' + monthNames[month - 1] + ' de ' + year + (date === today ? ', hoy' : '')
}
</script>
<template>
  <div class="field date-field">
    <span
      :id="id + '-label'"
      class="date-field-label"
    >{{ label }}</span>
    <button
      :id="id"
      type="button"
      class="date-trigger"
      :class="{ 'is-empty': !value }"
      :disabled="disabled"
      :aria-labelledby="id + '-label'"
      :aria-describedby="id + '-value' + (error ? ' ' + id + '-error' : help ? ' ' + id + '-help' : '')"
      :aria-invalid="Boolean(error)"
      aria-haspopup="dialog"
      @click="openPicker"
    >
      <CalendarDays
        :size="16"
        aria-hidden="true"
      /><span :id="id + '-value'">{{ displayText }}</span>
    </button>
    <p
      v-if="error"
      :id="id + '-error'"
      class="field-help tone-error"
    >
      {{ error }}
    </p>
    <p
      v-else-if="help"
      :id="id + '-help'"
      class="field-help"
    >
      {{ help }}
    </p>
    <dialog
      ref="dialog"
      class="date-dialog"
      :aria-labelledby="titleId"
      @cancel.prevent="closePicker"
      @click.self="closePicker"
    >
      <div
        v-if="motion.isRendered.value"
        class="date-dialog-body"
      >
        <header class="date-dialog-header">
          <h2 :id="titleId">
            {{ label }}
          </h2>
          <button
            type="button"
            class="icon-button"
            aria-label="Cerrar calendario"
            @click="closePicker"
          >
            <X
              :size="18"
              aria-hidden="true"
            />
          </button>
        </header>
        <div class="date-month">
          <button
            type="button"
            class="icon-button"
            aria-label="Año anterior"
            @click="changeMonth(-12)"
          >
            <ChevronsLeft
              :size="18"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="Mes anterior"
            @click="changeMonth(-1)"
          >
            <ChevronLeft
              :size="18"
              aria-hidden="true"
            />
          </button>
          <strong aria-live="polite">{{ monthNames[visibleMonth - 1] }} {{ visibleYear }}</strong>
          <button
            type="button"
            class="icon-button"
            aria-label="Mes siguiente"
            @click="changeMonth(1)"
          >
            <ChevronRight
              :size="18"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="Año siguiente"
            @click="changeMonth(12)"
          >
            <ChevronsRight
              :size="18"
              aria-hidden="true"
            />
          </button>
        </div>
        <div
          ref="grid"
          class="date-grid"
          role="grid"
          :aria-label="monthNames[visibleMonth - 1] + ' ' + visibleYear"
          @keydown="handleGridKey"
        >
          <div
            class="date-row"
            role="row"
          >
            <span
              v-for="(weekday, index) in weekdayNames"
              :key="index"
              role="columnheader"
              :aria-label="weekdayLongNames[index]"
              class="date-weekday"
            >{{ weekday }}</span>
          </div>
          <div
            v-for="(week, weekIndex) in weeks"
            :key="weekIndex"
            class="date-row"
            role="row"
          >
            <span
              v-for="cell in week"
              :key="cell.date"
              role="gridcell"
              :aria-selected="cell.date === value"
            >
              <button
                type="button"
                class="date-day"
                :class="{ 'is-other-month': cell.isOtherMonth, 'is-today': cell.date === today, 'is-selected': cell.date === value }"
                :data-date="cell.date"
                :tabindex="cell.date === focusedDate ? 0 : -1"
                :disabled="isOutOfRange(cell.date)"
                :aria-label="describeDay(cell.date)"
                @click="choose(cell.date)"
              >{{ cell.day }}</button>
            </span>
          </div>
        </div>
        <form
          class="date-typed"
          @submit.prevent="applyTyped"
        >
          <label :for="id + '-typed'">Escribir fecha</label>
          <div class="date-typed-row">
            <input
              :id="id + '-typed'"
              :value="typedDate"
              class="formatted-mono"
              maxlength="10"
              inputmode="numeric"
              autocomplete="off"
              placeholder="dd/mm/aaaa"
              :aria-invalid="Boolean(typedError)"
              :aria-describedby="typedError ? id + '-typed-error' : undefined"
              @input="onTypedInput"
            >
            <button
              type="submit"
              class="action-button button-secondary"
            >
              Aplicar
            </button>
            <!-- Hoy y Quitar como iconos junto a la fecha (2026-10-04): el modal ya no tiene pie. -->
            <button
              type="button"
              class="action-button button-secondary date-icon-button"
              aria-label="Elegir hoy"
              title="Hoy"
              :disabled="isOutOfRange(today)"
              @click="choose(today)"
            >
              <CalendarCheck
                :size="16"
                aria-hidden="true"
              />
            </button>
            <button
              v-if="isClearable && value"
              type="button"
              class="action-button button-secondary date-icon-button"
              aria-label="Quitar fecha"
              title="Quitar fecha"
              @click="value = ''; closePicker()"
            >
              <CalendarX
                :size="16"
                aria-hidden="true"
              />
            </button>
          </div>
          <p
            v-if="typedError"
            :id="id + '-typed-error'"
            class="field-help tone-error"
          >
            {{ typedError }}
          </p>
        </form>
      </div>
    </dialog>
  </div>
</template>
<style scoped>
.date-field-label { font-weight: 500; font-size: 14px; }
.date-trigger { display: flex; align-items: center; gap: 10px; width: 100%; min-height: var(--controlHeight); padding: 8px 14px; border: 2px solid var(--borderColor); background: var(--inputColor); color: var(--textColor); font: inherit; font-family: var(--monoFontFamily); font-weight: 600; text-align: left; cursor: pointer; }
.date-trigger.is-empty span { color: var(--mutedTextColor); font-family: var(--fontFamily, inherit); font-weight: 500; }
.date-trigger:hover:not(:disabled) { background: var(--hoverColor); }
.date-trigger:disabled { opacity: .6; cursor: not-allowed; }
.date-dialog { width: min(360px, calc(100vw - 32px)); padding: 0; }
.date-dialog-body { display: grid; gap: 14px; padding: 18px; }
.date-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.date-dialog-header h2 { margin: 0; font-size: 18px; font-weight: 800; }
.date-month { display: grid; grid-template-columns: auto auto 1fr auto auto; align-items: center; gap: 4px; border-block: 2px solid var(--borderColor); padding: 6px 0; }
.date-month strong { text-align: center; font-size: 15px; font-weight: 800; text-transform: capitalize; }
.date-grid { display: grid; gap: 2px; }
.date-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
.date-weekday { display: grid; place-items: center; height: 26px; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; color: var(--mutedTextColor); }
.date-day { width: 100%; aspect-ratio: 1; display: grid; place-items: center; border: 2px solid transparent; background: transparent; color: var(--textColor); font: inherit; font-family: var(--monoFontFamily); font-size: 13px; font-weight: 600; cursor: pointer; }
.date-day:hover:not(:disabled) { border-color: var(--borderColor); }
.date-day.is-other-month { color: var(--mutedTextColor); font-weight: 400; }
.date-day.is-today { border-color: var(--borderColor); }
.date-day.is-selected { background: var(--primaryBackgroundColor); border-color: var(--borderColor); color: var(--primaryTextColor); box-shadow: 2px 2px 0 var(--borderColor); }
.date-day:disabled { opacity: .3; cursor: not-allowed; }
.date-day:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 1px; }
.date-typed { display: grid; gap: 6px; }
.date-typed label { font-size: 13px; font-weight: 600; }
.date-typed-row { display: flex; gap: 8px; }
.date-typed-row input { flex: 1; min-width: 0; min-height: var(--controlHeight); padding: 0 12px; border: 2px solid var(--borderColor); background: var(--inputColor); color: var(--textColor); font: inherit; }
.date-icon-button { width: var(--controlHeight); padding: 0; }
</style>
