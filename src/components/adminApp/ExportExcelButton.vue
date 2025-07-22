----------------------
<!-- ExportExcelButton.vue -->
<template>
  <button
    @click="exportExcel"
    class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded inline-flex items-center"
  >
    <i class="pi pi-file-excel text-xl mr-2"></i>
    Exportar Excel
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { ps, formatFechaHoraFullPagoSQL } from '@/service/adminApp/client'

interface Payment {
  id: string
  cliente: string
  asunto: string
  atendio: string
  cobramos: number
  pagamos: number
  fecha: string
  fecha_legible: string
}

const payments = ref<Payment[]>([])

async function fetchPayments() {
  const raw = await ps.getPagoConcepto()
  payments.value = raw.map((item: any) => ({
    id: item.id,
    cliente: item.cliente,
    asunto: item.asunto,
    atendio: item.atendio,
    cobramos: Number(item.cobramos) || 0,
    pagamos: Number(item.pagamos) || 0,
    fecha: item.fecha,
    fecha_legible: formatFechaHoraFullPagoSQL(item.fecha)
  }))
}

async function exportExcel() {
  await fetchPayments()

  // ordenar por fecha ascendente (el más antiguo primero)
  const sorted = [...payments.value].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  )
  // eliminar el límite de 10 elementos para exportar todos los registros
  const dataToExport = sorted

  // crear libro y hoja
  const wb = XLSX.utils.book_new()
  wb.Props = {
    Title: 'Reporte de Pagos',
    Subject: 'Pagos',
    Author: 'MiApp',
    CreatedDate: new Date()
  }

  const ws_data: any[][] = []
  // encabezados
  ws_data.push([
    'ID',
    'CLIENTE',
    'ASUNTO',
    'ATENDIO',
    'COBRAMOS',
    'PAGAMOS',
    'SALDO',
    'FECHA'
  ])

  // datos con saldo acumulado
  let cumulative = 0
  dataToExport.forEach(p => {
    cumulative += p.cobramos - p.pagamos
    ws_data.push([
      p.id,
      p.cliente,
      p.asunto,
      p.atendio,
      p.cobramos,
      p.pagamos,
      cumulative,
      p.fecha_legible
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(ws_data)

  // formato moneda en columnas E, F y G
  const range = XLSX.utils.decode_range(ws['!ref']!)
  for (let C = 4; C <= 6; ++C) {
    for (let R = 1; R <= range.e.r; ++R) {
      const addr = XLSX.utils.encode_cell({ c: C, r: R })
      const cell = ws[addr]
      if (cell && typeof cell.v === 'number') {
        cell.z = '$#,##0.00'
      }
    }
  }

  // freeze header y autofiltro
  ws['!freeze'] = { xSplit: '0', ySplit: '1' }
  ws['!autofilter'] = { ref: 'A1:H1' }

  // ancho de columnas
  ws['!cols'] = [
    { wch: 30 },
    { wch: 25 },
    { wch: 15 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 }
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Pagos')
  XLSX.writeFile(wb, 'reporte_pagos.xlsx')
}
</script>

<style scoped>
/* ningún estilo adicional */
</style>
----------------------
