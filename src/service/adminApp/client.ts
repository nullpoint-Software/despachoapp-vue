import axios from "axios";
const serverip = import.meta.env.VITE_API_SERVER_IP;
import ClienteService from "./clienteService";
import TareasService from "./tareasService";
import authService from "./authService";
import PagosService from "./pagosService";
import NotasService from "./notasService";
import EstadisticaService from "./estadisticaService";
import UsuarioService from "./usuariosService";
import LogsService from "./logsService";

const instance = axios.create();
instance.interceptors.request.use((config) => {
  const userId = localStorage.getItem("userid");
  if (userId && typeof config.data == "object") {
    config.data.userId = userId;
  }else if (config.method === "delete") {
    config.data = { userId };
  }
  return config;
});
export const cs = new ClienteService(serverip, instance);
export const ts = new TareasService(serverip, instance);
export const as = new authService(serverip, instance);
export const ps = new PagosService(serverip, instance);
export const ns = new NotasService(serverip, instance);
export const es = new EstadisticaService(serverip, instance);
export const us = new UsuarioService(serverip, instance);
export const ls = new LogsService(serverip, instance);
export const formatFechaSQL = (dateStr: string): string => {
  const date = new Date(dateStr);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const formatFechaMesAnoSQL = (dateStr: string): string => {
  const date = new Date(dateStr);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(date.getDate()).padStart(2, "0");

  return `${month}/${year}`;
};

export const formatFechaHoraSQL = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
  
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
  
    const hour = String(date.getHours() % 12 || 12).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const timeofday = date.getHours() < 12 ? "AM" : "PM";
  
    if (isToday) {
      return `Hoy a las ${hour}:${min}${timeofday}`;
    }
  
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
  
    return `${day}-${month}-${year} a las ${hour}:${min}${timeofday}`;
  };
  

export const formatFechaHoraFullSQL = (dateStr: string): string => {
  const date = new Date(dateStr);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
};

export const formatFechaHoraFullPagoSQL = (dateStr: string): string => {
  const date = new Date(dateStr);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${month}/${day}/${year} ${hour}:${min}:${sec}`;
};
