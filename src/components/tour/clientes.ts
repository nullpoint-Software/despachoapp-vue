import { driver } from "driver.js"
import "driver.js/dist/driver.css";

const driverObjClientes = driver({
    showProgress: true,
    steps:[
        {
            popover: { title: 'Clientes', description: 'En esta seccion se muestra la informacion de los clientes del despacho' }
        },
        {
            element: '#agregar-cliente-btn',
            popover: { title: 'Agregar clientes', description: 'Puedes agregar un cliente aquí' }
        },
        {
            element: '#search-bar',
            popover: { title: 'Buscar', description: 'Busca en todos los registros aquí', side:"bottom", align:"center" }
        },
        {
            element:'#inner-info',
            popover: { title: 'Clientes', description: 'Esta es la información de los clientes, la información sensible como contraseñas se oculta automaticamente. Para visualizar y copearla <strong>haz clic en la celda.</strong>', side:"over", align: "center" }
        }
    ],
    onDestroyed: () => {
        // This callback runs when the tour ends
        localStorage.setItem('tourClientesDone', 'true');
    }
});

export {driverObjClientes};