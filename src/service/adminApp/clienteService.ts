import axios from "axios";

export default {
    setup(){
        const cum = axios.get("http://google.com");
        console.log("cum has gotten:", cum);
    }
}

export function nigga() {
    console.log("nigga")
}


