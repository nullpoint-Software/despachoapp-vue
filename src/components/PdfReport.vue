<!-- PdfReport.vue -->
<template>
  <Loader v-if="isLoading" />
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ts } from "../service/adminApp/client";
import { formatFechaHoraSQL } from "../service/adminApp/client";
import Loader from "./adminApp/Loader.vue";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/img/logsymbolblack.png";

const props = defineProps({ tasks: Array });
const emit = defineEmits(["done"]);

const today = new Date().toLocaleString().split(",")[0];
//la cosa con obtener ISOString de una fecha vacia es que obtiene la fecha actual en el meridiano UTC
//y si estas en una zona horaria atrasada te da el dia siguiente y la comparacion falla
//ENTONCES es mejor obtener la fecha local en string y partirla
//luego, en finished convertir el ISOString que envia la bd a local string y partirla tambien
const employeeName = localStorage.getItem("fullname");
const userId = localStorage.getItem("userid");
const isLoading = ref(true);
const tasks = ref();

async function generateReport() {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  try {
    const finished = tasks.value.filter(
      (t) =>
        t.estado === "Terminado" &&
        t.id_usuario == userId &&
        new Date(t.fecha_vencimiento).toLocaleString().split(",")[0] == today
    );
    if (!finished.length) {
      alert("No hay tareas terminadas hoy.");
      emit("done");
      return;
    }

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // ---- calcular dimensiones de imagen/header para reservar espacio ----
    const imgW = 60;
    const imgProps = doc.getImageProperties(logo);
    const imgH = imgProps.height * (imgW / imgProps.width);
    // altura total ocupada por el header (ajusta el valor si cambias paddings)
    const headerTop = 30; // margen superior del logo
    const headerContentHeight = imgH + 110 + 40; // logo + textos + cajas
    const headerHeight = headerTop + headerContentHeight; // espacio que debe reservar la tabla
    // --------------------------------------------------------------------

    // función que dibuja el header en cada página
    function drawHeader(pageNumber) {
      // dibujar logo y textos centrados
      doc.addImage(logo, "PNG", pw / 2 - imgW / 2, headerTop, imgW, imgH);
      doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(33);
      doc.text("Despacho", pw / 2, headerTop + imgH + 30, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(12);
      doc.text("CONTABLE Y FISCAL SANCHEZ", pw / 2, headerTop + imgH + 50, {
        align: "center",
      });
      doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(0);
      doc.text("TAREAS TERMINADAS", pw / 2, headerTop + imgH + 80, {
        align: "center",
      });

      // cajas Nombre / Fecha
      const boxW = 250;
      const grpW = boxW + 70;
      const startX = pw / 2 - grpW / 2;
      const yName = headerTop + imgH + 110;
      const centerX = startX + 70 + boxW / 2;

      doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(33);
      doc.text("Nombre:", startX, yName);
      doc.setFillColor(255).rect(startX + 70, yName - 12, boxW, 20, "F");
      doc.text(employeeName || "-", centerX, yName - 12 + 10, {
        align: "center",
        baseline: "middle",
      });

      const yDate = yName + 30;
      doc.text("Fecha:", startX, yDate);
      doc.setFillColor(255).rect(startX + 70, yDate - 12, boxW, 20, "F");
      doc.text(today, centerX, yDate - 12 + 10, {
        align: "center",
        baseline: "middle",
      });

      // pie de página: número de página (se dibuja también aquí)
      const page = pageNumber ?? doc.internal.getCurrentPageInfo().pageNumber;
      const total = doc.internal.getNumberOfPages();
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
      doc.text(`Página ${page} de ${total}`, pw / 2, ph - 30, {
        align: "center",
      });
      doc.setTextColor(0);
    }

    // Prepara datos de la tabla
    const body = finished.map((t) => [
      t.id_tarea,
      t.titulo,
      t.descripcion,
      formatFechaHoraSQL(t.fecha_creacion),
      formatFechaHoraSQL(t.fecha_vencimiento),
    ]);

    // Llamada a autoTable:
    autoTable(doc, {
      startY: headerHeight + 10, // inicio en primera página (se respeta también margin.top)
      margin: { top: headerHeight + 10, left: 60, right: 60, bottom: 60 },
      head: [["ID", "Titulo", "Descripción", "Fecha creación", "Fecha vencimiento"]],
      body,
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 6,
        textColor: 33,
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
        halign: "center",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 33,
        fontStyle: "bold",
        halign: "center",
        lineColor: [180, 180, 180],
        lineWidth: 0.5,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      theme: "grid",

      // didDrawPage se ejecuta por cada página: dibuja header + pie respetando el espacio reservado
      didDrawPage: (data) => {
        const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
        // siempre dibujar header (sobre la página actual, antes o después de la tabla).
        // Dibujamos aquí para que aparezca en cada página.
        drawHeader(pageNumber);
        // no tocar data.cursor y no forzar startY para páginas > 1: margin.top lo controla
      },
    });

    // abrir PDF en nueva pestaña
    window.open(URL.createObjectURL(doc.output("blob")), "_blank");
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
    emit("done");
  }
}

onMounted(async () => {
  isLoading.value = true;
  tasks.value = await ts.getTareas();
  await generateReport();
});

defineExpose({ generateReport });
</script>
