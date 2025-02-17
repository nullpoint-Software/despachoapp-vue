import axios from "axios";
const serverip = import.meta.env.VITE_API_SERVER_IP;

export async function getClientes(): Promise<any> {
    try {
        const response = await axios.get(`${serverip}:5000/clientes`);
        console.log("Response received:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching clientes:", error);
        throw error;
    }
}


