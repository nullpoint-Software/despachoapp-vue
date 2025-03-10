import axios from "axios";
const serverip = import.meta.env.VITE_API_SERVER_IP;
import ClienteService from "./clienteService";
import TareasService from "./tareasService";

export const cs = new ClienteService(serverip, axios);
export const ts = new TareasService(serverip, axios);