import { driver } from "driver.js"
import "driver.js/dist/driver.css";

const driverObjPagos = driver({
    showProgress: true,
    steps: [
        {
            popover: { title: 'Pagos', description: 'En esta pantalla se muestra el historial de los pagos en el despacho' }
        },
        {
            element: '#link-btn',
            popover: { title: 'Ir a pago', description: 'En la fila de un pago, haz clic aquí para ver más detalles sobre el pago' }
        },
    ],
    onDestroyed: () => {
        // This callback runs when the tour ends
        localStorage.setItem('tourPagosDone', 'true');
    }
});

export { driverObjPagos };