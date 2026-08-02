import { onMounted } from "vue";
import { driverObjTareasMain } from "../../tour/tareas";

onMounted(() => {
  if (!localStorage.getItem("tourTareasDone")) driverObjTareasMain.drive();
});
