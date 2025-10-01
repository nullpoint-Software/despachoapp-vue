import { driver } from "driver.js"
import "driver.js/dist/driver.css";
import dragTareaGif from "./assets/drag-tarea.gif"
const driverObjTareasMain = driver({
    showProgress: true,
    smoothScroll: false,
    steps: [
        {
            popover: {
                title: 'Tareas', description: `Aquí se muestran todas las tareas a realizar, organizadas en cuatro columnas: <strong>Disponible, 
                Pendiente, En Progreso y Terminado.</strong> Las tarjetas se arrastran de una columna a otra conforme avanza su progreso.`, side: "over", align: "center"
            }
        },
        {
            element: '#search-bar',
            popover: {
                title: 'Buscar', description: `En esta barra puedes buscar todo el <strong>historial de tareas</strong>.`, side: "bottom", align: "center"
            }
        },
        {
            element: '.disponible-column',
            popover: {
                title: 'Tareas disponibles', description: `Las tareas disponibles para realizar se ubican en esta columna, 
                cuando arrastres una tarjeta a la siguiente columna, se asignará automáticamente a tu . <img src='`+dragTareaGif+`'>`, side: 'right', align: 'center'
            }
        },
        {
            element: '.pendiente-column',
            popover: { title: 'Tareas disponibles', description: `Aquí se muestran las tareas que están pendientes de ser realizadas por los usuarios`, side: 'right', align: 'center' }
        },
        {
            element: '.progreso-column',
            popover: { 
                title: 'Tareas en progreso', 
                description: `En esta columna están las tareas en las que un usuario ya está trabajando actualmente. 
                Se mueven aquí cuando comienzan a ejecutarse.`, 
                side: 'right', 
                align: 'center' 
            }
        },
        {
            element: '.terminado-column',
            popover: { 
                title: 'Tareas finalizadas', 
                description: `Aquí se ubican todas las tareas que ya fueron completadas y cerradas. 
                Funciona como un historial visual de los avances.`, 
                side: 'right', 
                align: 'center' 
            }
        },
        
    ],
    onDestroyed: () => {
        // This callback runs when the tour ends
        localStorage.setItem('tourTareasDone', 'true');
    }

})

export { driverObjTareasMain };