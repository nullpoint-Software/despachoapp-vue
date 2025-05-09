<!-- PdfReport.vue -->
<template>
  <!-- Este componente no renderiza nada visible, solo genera el PDF al montarse -->
  <Loader v-if="isLoading" />
</template>

<script setup>
import { computed, watchEffect, ref } from 'vue';
import { ts } from '../service/adminApp/client';
import { formatFechaHoraSQL } from '../service/adminApp/client'
import { onMounted, defineEmits } from "vue";
import Loader from './adminApp/Loader.vue'
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/img/logsymbolblack.png";

const emit = defineEmits(["done"]);
const props = defineProps({
  tasks: Array
})
const today = new Date().toISOString().split("T")[0];
const employeeName = localStorage.getItem("fullname")
const isLoading = ref(true);
const userId = localStorage.getItem("userid")

// Ejemplo de tareas con varias terminadas hoy
const tasks = ref()
console.log(tasks);

async function generateReport() {
  
  // Filtrar solo tareas terminadas hoy
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  try {

    const finished = tasks.value.filter(
      (t) =>
        t.estado === "Terminado" && t.id_usuario == userId && t.fecha_vencimiento.split("T")[0] == today
    );

    if (!finished.length) {
      alert("No hay tareas terminadas hoy.");
      emit("done");
      return;
    }

   
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Propiedades del logo
    const imgW = 60;
    const imgProps = doc.getImageProperties(logo);
    const imgH = imgProps.height * (imgW / imgProps.width);

    // Función para dibujar encabezado en cada página
    function drawHeader() {
      // Logo centrado
      doc.addImage(logo, "PNG", pw / 2 - imgW / 2, 30, imgW, imgH);

      // Título del despacho
      doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(33);
      doc.text("Despacho", pw / 2, 30 + imgH + 30, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(12);
      doc.text("CONTABLE Y FISCAL SANCHEZ", pw / 2, 30 + imgH + 50, {
        align: "center",
      });

      // Título del reporte en negro
      doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(0);
      doc.text("TAREAS TERMINADAS", pw / 2, 30 + imgH + 80, { align: "center" });

      // Cajas Nombre y Fecha centradas
      const boxW = 250;
      const grpW = boxW + 70;
      const startX = pw / 2 - grpW / 2;
      const yName = 30 + imgH + 110;
      const centerX = startX + 70 + boxW / 2;

      // Nombre
      doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(33);
      doc.text("Nombre:", startX, yName);
      doc.setFillColor(255).rect(startX + 70, yName - 12, boxW, 20, "F");
      doc.text(employeeName, centerX, yName - 12 + 10, {
        align: "center",
        baseline: "middle",
      });

      // Fecha
      const yDate = yName + 30;
      doc.text("Fecha:", startX, yDate);
      doc.setFillColor(255).rect(startX + 70, yDate - 12, boxW, 20, "F");
      doc.text(today, centerX, yDate - 12 + 10, {
        align: "center",
        baseline: "middle",
      });

      doc.setTextColor(0);
    }

    // Generar la tabla con autoTable
    autoTable(doc, {
      startY: 30 + imgH + 160,
      margin: { left: 60, right: 60 },
      head: [
        ["ID", "Titulo", "Descripción", "Fecha creación", "Fecha vencimiento"
          // , "Estado"
        ],
      ],
      body: finished.map((t) => [
        t.id_tarea,
        t.titulo,
        t.descripcion,
        formatFechaHoraSQL(t.fecha_creacion),
        formatFechaHoraSQL(t.fecha_vencimiento),
        // t.estado, no se ocupa si ya esta terminado
      ]),
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 6,
        textColor: 33,
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 33,
        fontStyle: "bold",
        lineColor: [180, 180, 180],
        lineWidth: 0.5,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      theme: "grid",
      didDrawPage: () => {
        drawHeader();
        // Pie de página centrado
        const page = doc.internal.getCurrentPageInfo().pageNumber;
        const total = doc.internal.getNumberOfPages();
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
        doc.text(`Página ${page} de ${total}`, pw / 2, ph - 30, {
          align: "center",
        });
      },
    });
    window.open(URL.createObjectURL(doc.output("blob")), "_blank");
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false;
    emit("done");
  }

}

// Ejecutar la primera generación al montar
onMounted(async ()=>{
  isLoading.value = true
  tasks.value = await ts.getTareas();
  await generateReport()
})

// Exponer generateReport si se quiere invocar por ref
defineExpose({ generateReport });
</script>
