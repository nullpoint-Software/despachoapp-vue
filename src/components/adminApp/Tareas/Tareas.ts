import { nextTick, onMounted, ref } from 'vue'

const taskTutorialOpen = ref(false)
const taskTutorialSteps = [
  {
    target: '.tasks-hero',
    eyebrow: 'Tareas / inicio',
    title: 'Organiza el trabajo',
    body: 'El tablero reúne pendientes, responsables y fechas límite del despacho.'
  },
  {
    target: '.kanban-search',
    eyebrow: 'Tareas / búsqueda',
    title: 'Localiza una tarea',
    body: 'Busca por título, descripción, responsable o estado sin cambiar de página.'
  },
  {
    target: '.kanban-date',
    eyebrow: 'Tareas / reportes',
    title: 'Elige la fecha del reporte',
    body: 'El reporte mostrará únicamente las tareas que se terminaron durante el día seleccionado.'
  },
  {
    target: '.kanban-board',
    eyebrow: 'Tareas / tablero',
    title: 'Mueve el trabajo',
    body: 'Las columnas muestran tareas disponibles, pendientes y terminadas. Abre una tarjeta para consultar o editar su detalle.'
  },
  {
    target: '.kanban-button--primary',
    eyebrow: 'Tareas / captura',
    title: 'Crea una tarea',
    body: 'Captura título, instrucciones y fecha límite. Los signos de pregunta explican cada campo.'
  }
]
onMounted(async () => {
  await nextTick()
  if (!localStorage.getItem('tourTareasDone')) taskTutorialOpen.value = true
})
