import { driver } from "driver.js"
import "driver.js/dist/driver.css";

const driverObjInicio = driver({
    showProgress: true,
    steps:[
        {
            element: '#chart-section',
            popover: { title: 'Inicio', description: 'Aqui es donde se visualiza el resumen de ganancias del negocio', side: 'top', align: 'start' }
        },
        {
            element: '#periodo',
            popover: { title: 'Selector de periodo', description: 'Aqui puedes seleccionar el periodo de tiempo que deseas visualizar en el gráfico y resumen', side: 'top', align: 'start' }
        },
        {
            element: '#periodo',
            popover: { title: 'Selector de periodo', description: 'Puedes observar los ingresos por hoy, mes actual, año actual, o todos los años', side: 'top', align: 'start' }
        },
        { element: '#resumen-ganancias',
            popover: { title: 'Resumen de ganancias', description: 'Aqui puedes ver un resumen detallado de las ganancias del negocio en cada periodo', side: 'top', align: 'start' }
        },
        { element: '#mini-kanban',
            popover: { title: 'Tareas pendientes', description: 'Aqui puedes ver las tareas pendientes para tu usuario', side: 'top', align: 'start' }
        },
    ]
});

export {driverObjInicio};