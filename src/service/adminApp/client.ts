import axios from "axios";
const serverip = import.meta.env.VITE_API_SERVER_IP;
import ClienteService from "./clienteService";
import TareasService from "./tareasService";
import authService from "./authService";

export const cs = new ClienteService(serverip, axios);
export const ts = new TareasService(serverip, axios);
export const as = new authService(serverip, axios);

export const formatFechaSQL = (dateStr: string): string => {
    const date = new Date(dateStr);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

export const formatFechaHoraSQL = (dateStr: string): string => {
    const date = new Date(dateStr);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String((date.getHours() > 12 ? date.getHours()-12 : date.getHours())).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    const timeofday = (date.getHours() > 0 && date.getHours() <= 11 ? "AM" : "PM") 
    return `${year}-${month}-${day} a las ${hour}:${min}${timeofday}`;
};

export const formatFechaHoraFullSQL = (dateStr: string): string => {
    const date = new Date(dateStr);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${min}${sec}`;
};