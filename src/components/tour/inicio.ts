import { driver } from "driver.js"
import "driver.js/dist/driver.css";

const driverObjInicio = driver({
    showProgress: true,
    steps:[
        {
            popover:{title:'Bienvenido a ContaApp!', description:`<img src="https://i.pinimg.com/originals/90/ee/8c/90ee8c7d852e53327dbde9fc252cf023.gif">
                En este tour interactivo se te mostrará como usar la aplicacion y sus varias partes.
                <br><strong>Puedes cancelar el tour dando clic en la X o presionando afuera</strong>`, side:"over", align:"center"}
        },
        {
            element: '#chart-section',
            popover: { title: 'Inicio', description: 'Aqui es donde se visualiza el resumen de ganancias del negocio', side: 'top', align: 'start' }
        },
        {
            element: '#periodo',
            popover: { title: 'Selector de periodo', description: `Aqui puedes seleccionar el periodo de tiempo que deseas visualizar en el gráfico, 
                <strong>Puedes observar los ingresos por hoy, mes actual, año actual, o todos los años</strong>`, side: 'top', align: 'start' }
        },
        { element: '#resumen-ganancias',
            popover: { title: 'Resumen de ganancias', description: 'Aqui puedes ver un resumen detallado de las ganancias del negocio en cada periodo', side: 'top', align: 'start' }
        },
        { element: '#mini-kanban',
            popover: { title: 'Tareas pendientes', description: 'Aqui puedes ver las tareas pendientes para tu usuario', side: 'top', align: 'start' }
        },
    ],
    onDestroyed: () => {
        // This callback runs when the tour ends
        localStorage.setItem('tourInicioDone', 'true');
        localStorage.setItem('tourTareasDone', 'true');
        localStorage.setItem('tourClientesDone', 'true');
        localStorage.setItem('tourPagosDone', 'true');
    }
});

export {driverObjInicio};