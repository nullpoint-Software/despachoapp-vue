import { computed, onMounted, ref } from "vue";
import dayjs from "dayjs";
import connetor_plugin from "@abrazasoft/thermal_printer_vuejs";
import logoAsset from "@/assets/img/logsymbolblack.png";
import { useAppToast } from "@/composables/useAppToast";

interface CashMovement {
  cliente?: string;
  cobramos?: number | string;
  pagamos?: number | string;
}
interface CashCutTicketProps { movements: CashMovement[]; from: Date; to: Date }

const serverip=import.meta.env.VITE_API_SERVER_IP;
const logo=logoAsset;
const props=defineProps<CashCutTicketProps>();
const emit=defineEmits(["close"]);
const toast=useAppToast();
const printers=ref<string[]>([]),selectedPrinter=ref(""),showDownload=ref(false);
const apiKey="123456",width=48,line="-".repeat(width),doubleLine="=".repeat(width);
const center=(text: unknown): string =>{const value=String(text).slice(0,width);const left=Math.max(0,Math.floor((width-value.length)/2));return " ".repeat(left)+value};
const amount=(value: unknown): string =>Number(value||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
const valueRow=(label: unknown,value: unknown): string =>{const right=String(value).slice(0,width);const safeLabel=String(label).slice(0,Math.max(1,width-right.length-1));const available=Math.max(1,width-safeLabel.length);return safeLabel+" ".repeat(Math.max(1,available-right.length))+right};
const netTotal=computed(()=>props.movements.reduce((total,item)=>total+Number(item.cobramos||0)-Number(item.pagamos||0),0));
const barcodeValue=computed(()=>`CORTE-${dayjs(props.from).format("YYYYMMDDHHmm")}-${dayjs(props.to).format("YYYYMMDDHHmm")}`);
const formattedTicket=computed(()=>{
  const rows=[line,center("CORTE DE CAJA"),line,`INICIO: ${dayjs(props.from).format("DD/MM/YYYY HH:mm:ss")}`,`FIN:    ${dayjs(props.to).format("DD/MM/YYYY HH:mm:ss")}`,doubleLine];
  props.movements.forEach((item,index)=>{
    rows.push(`${String(index+1).padStart(2,"0")} ${String(item.cliente||"Sin cliente").slice(0,width-3)}`);
    if(Number(item.cobramos||0)!==0)rows.push(valueRow("  COBRO (+)",`+$${amount(item.cobramos)}`));
    if(Number(item.pagamos||0)!==0)rows.push(valueRow("  PAGO  (-)",`-$${amount(item.pagamos)}`));
    rows.push(line);
  });
  if(!props.movements.length)rows.push(center("SIN MOVIMIENTOS"),line);
  rows.push(valueRow("TOTAL NETO",`${netTotal.value<0?"-":"+"}$${amount(Math.abs(netTotal.value))}`),doubleLine,center(`IMPRESO ${dayjs().format("DD/MM/YYYY HH:mm")}`),"","");
  return rows.join("\n");
});
async function fetchPrinters(){try{const list=await connetor_plugin.obtenerImpresoras();printers.value=Array.isArray(list)?list:[];if(!printers.value.includes(selectedPrinter.value))selectedPrinter.value="";showDownload.value=false}catch(error){showDownload.value=true;toast.add({severity:"error",summary:"Impresión no disponible",detail:"No se pudo conectar con el plugin de impresión térmica.",life:4500})}}
function downloadPlugin(){const anchor=document.createElement("a");anchor.href=`${serverip}/Plugin_Impresora_termica.exe`;anchor.download="Plugin_Impresora_termica.exe";document.body.appendChild(anchor);anchor.click();anchor.remove()}
async function doPrint(){if(!selectedPrinter.value){toast.add({severity:"warn",summary:"Falta una impresora",detail:"Selecciona una impresora térmica.",life:3000});return}try{const connector=new connetor_plugin();connector.textaling("center");connector.img_url(`${serverip}/sm.png`);connector.feed("1");connector.fontsize("2");connector.text("CORTE DE CAJA");connector.feed("1");connector.fontsize("1");connector.textaling("left");formattedTicket.value.split("\n").forEach(row=>connector.text(row));connector.feed("1");connector.textaling("center");connector.barcode_128(barcodeValue.value);connector.text(barcodeValue.value);connector.feed("5");connector.cut("0");const response=await connector.imprimir(selectedPrinter.value,apiKey);if(response===true){toast.add({severity:"success",summary:"Ticket enviado",detail:"El corte se envió a la impresora.",life:3000});emit("close")}else toast.add({severity:"error",summary:"No se pudo imprimir",detail:String(response),life:4500})}catch(error){const detail=error instanceof Error?error.message:String(error);toast.add({severity:"error",summary:"No se pudo imprimir",detail,life:4500})}}
onMounted(fetchPrinters);
