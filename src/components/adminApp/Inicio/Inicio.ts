import { computed, onMounted, ref, watch } from "vue";
import { Line } from "vue-chartjs";
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { cos, cs, es, fs, ts } from "@/service/adminApp/client";
import type { ComplianceSummary, ComplianceStatus } from "@/service/adminApp/cumplimientoService";
import { useColorPalette } from "@/composables/useColorPalette";
import { useBrutalMotion } from "@/composables/useBrutalMotion";

ChartJS.register(Title,Tooltip,Legend,LineElement,PointElement,CategoryScale,LinearScale,Filler,zoomPlugin);

type Period="dia"|"mes"|"anio"|"anios";
type Entry={nombre:string;ingresos:number;costos:number;ganancia:number};
type ClientRecord=Record<string,any>;
type TaskRecord=Record<string,any>;
type FiscalReport=Record<string,any>;
type ReportClientRow={key:string;name:string;directions:string[]};

const emptyData=()=>({dia:[],mes:[],anio:[],anios:[]} as Record<Period,Entry[]>);
const emptyCompliance=():ComplianceSummary=>({total:0,positiva:0,negativa:0,suspension_actividades:0,inscrito_sin_obligaciones:0,no_inscrito:0,cancelado:0,no_localizado:0,no_publica:0,otro:0,sin_consulta:0,error:0,especial:0,con_documento:0,con_error_reciente:0});
const datos=ref(emptyData());
const periodo=ref<Period>("anio");
const loading=ref(true);
const loadError=ref("");
const zoomEnabled=ref(false);
const chartKey=ref(0);
const pageRef=ref<HTMLElement|null>(null);
const operationalLoading=ref(true);
const operationalErrors=ref<string[]>([]);
const clients=ref<ClientRecord[]>([]);
const tasks=ref<TaskRecord[]>([]);
const reports=ref<FiscalReport[]>([]);
const complianceSummary=ref<ComplianceSummary>(emptyCompliance());
const isAdmin=localStorage.getItem("level")==="Administrador";
const {selectedPalette}=useColorPalette();
const homeTutorialOpen=ref(false);
const homeTutorialSteps=[
  {target:".page-hero",eyebrow:"Inicio / resumen",title:"Lee el estado del despacho",body:"El panel concentra clientes, tareas, cumplimiento y reportes para que puedas detectar pendientes desde una sola vista."},
  {target:".kpi-strip",eyebrow:"Inicio / indicadores",title:"Abre cada módulo",body:"Cada indicador también es un acceso directo. Selecciona uno para consultar el detalle correspondiente."},
  {target:".operations-grid",eyebrow:"Inicio / operación",title:"Revisa el trabajo pendiente",body:"Estos bloques muestran responsables, opiniones y reportes mensuales que requieren seguimiento."},
  {target:isAdmin?"#chart-section":".operations-panel",eyebrow:"Inicio / seguimiento",title:isAdmin?"Compara ingresos y costos":"Mantén los datos al día",body:isAdmin?"Cambia el periodo y activa el zoom cuando necesites revisar el comportamiento financiero.":"Los indicadores se actualizan con la información disponible para tu perfil."},
];

useBrutalMotion(pageRef,[".page-hero",".operations-panel",".revenue-panel"]);
watch([selectedPalette,zoomEnabled],()=>chartKey.value++);

const chartPaletteColors:Record<string,[string,string]>={carbon:["#69b77b","#55c6d8"],cobalt:["#76a0ff","#58d1c9"],forest:["#a8d65b","#59bca4"],sand:["#e0b95b","#d98258"],oled:["#36d889","#79b0ff"]};
const paletteColors=computed<[string,string]>(()=>chartPaletteColors[selectedPalette.value]??chartPaletteColors.carbon);
const chartData=computed(()=>{const rows=datos.value[periodo.value]||[];const [income,cost]=paletteColors.value;return{labels:rows.map(x=>x.nombre),datasets:[{label:"Ingresos",data:rows.map(x=>Number(x.ingresos||0)),borderColor:income,backgroundColor:`${income}80`,fill:true,tension:.42,pointRadius:3,pointHoverRadius:6,borderWidth:2},{label:"Costos",data:rows.map(x=>Number(x.costos||0)),borderColor:cost,backgroundColor:`${cost}68`,fill:true,tension:.42,pointRadius:3,pointHoverRadius:6,borderWidth:2}]}});
const chartOptions=computed(()=>({responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:"index" as const},scales:{y:{beginAtZero:true,ticks:{color:"#8e8b84",callback:(value:any)=>money(value)},grid:{color:"rgba(120,116,108,.18)"}},x:{ticks:{color:"#8e8b84"},grid:{display:false}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:(context:any)=>`${context.dataset.label}: ${money(context.raw)}`}},zoom:{pan:{enabled:zoomEnabled.value,mode:"x" as const},zoom:{wheel:{enabled:zoomEnabled.value},pinch:{enabled:zoomEnabled.value},mode:"x" as const}}}}));
const resumen=computed(()=>Object.fromEntries((Object.keys(datos.value) as Period[]).map(key=>[key,datos.value[key].reduce((sum,item)=>sum+Number(item.ganancia||0),0)])) as Record<Period,number>);
const money=(value:any)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value||0));
const now=new Date();
const previousMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
const previousMonth=previousMonthDate.getMonth()+1;
const previousYear=previousMonthDate.getFullYear();
const currentDay=now.toLocaleDateString("es-MX",{day:"2-digit"});
const currentMonth=now.toLocaleDateString("es-MX",{month:"short",year:"numeric"}).toUpperCase();
const previousPeriodLabel=previousMonthDate.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
const previousPeriodShort=previousMonthDate.toLocaleDateString("es-MX",{month:"short"}).replace(".","");

function isActiveClient(client:ClientRecord){
  const value=client.activo??client.active;
  if(value===undefined||value===null)return true;
  return ![false,0,"0","false","inactivo","inactive","baja"].includes(typeof value==="string"?value.toLowerCase():value);
}
const activeClients=computed(()=>clients.value.filter(isActiveClient));
const activeClientsCount=computed(()=>activeClients.value.length);
const pendingTasks=computed(()=>tasks.value.filter(task=>!["terminado","completado","completed"].includes(String(task.estado||"").toLowerCase())));
const taskGroups=computed(()=>{const grouped=new Map<string,number>();for(const task of pendingTasks.value){const name=task.id_usuario?(task.nombre||task.nombre_usuario||task.usuario_nombre||task.username||`Empleado ${task.id_usuario}`):"Sin asignar";grouped.set(String(name),Number(grouped.get(String(name))||0)+1)}return [...grouped.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es"))});
const taskGroupMax=computed(()=>Math.max(1,...taskGroups.value.map(item=>item.count)));
const reviewedOpinions=computed(()=>Math.max(0,Number(complianceSummary.value.total)-Number(complianceSummary.value.sin_consulta)));
const opinionDefinitions:{key:ComplianceStatus;label:string}[]=[
  {key:"positiva",label:"Positivas"},{key:"negativa",label:"Con pendientes"},{key:"suspension_actividades",label:"Suspensi\u00f3n de actividades"},{key:"inscrito_sin_obligaciones",label:"Sin obligaciones"},{key:"no_inscrito",label:"No inscritos"},{key:"cancelado",label:"Cancelados"},{key:"no_localizado",label:"No localizados"},{key:"no_publica",label:"No p\u00fablicas"},{key:"otro",label:"Otro resultado"},{key:"sin_consulta",label:"Sin consultar"},{key:"error",label:"Error de consulta"}
];
const opinionBreakdown=computed(()=>opinionDefinitions.map(item=>({...item,count:Number(complianceSummary.value[item.key]||0)})).filter(item=>item.count>0));
const opinionMax=computed(()=>Math.max(1,...opinionBreakdown.value.map(item=>item.count)));

const normalizeName=(value:any)=>String(value||"").trim().toLocaleLowerCase("es-MX");
const clientKey=(client:ClientRecord)=>client.id_cliente!=null?`id:${client.id_cliente}`:`name:${normalizeName(client.nombre)}`;
const reportClientRows=computed<ReportClientRow[]>(()=>{
  const activeByKey=new Map<string,ClientRecord>();
  for(const client of activeClients.value){
    activeByKey.set(clientKey(client),client);
    if(client.nombre)activeByKey.set(`name:${normalizeName(client.nombre)}`,client);
  }
  const grouped=new Map<string,ReportClientRow>();
  for(const report of reports.value){
    if(report.tipo!=="mensual"||Number(report.ejercicio)!==previousYear||Number(report.mes)!==previousMonth)continue;
    const id=report.id_cliente??report.clienteId??report.cliente_id;
    const rawName=report.cliente??report.cliente_nombre??report.nombre_cliente;
    const key=id!=null?`id:${id}`:`name:${normalizeName(rawName)}`;
    if(key.endsWith("name:"))continue;
    const matched=activeByKey.get(key);
    const name=matched?.nombre||rawName||`Cliente ${id}`;
    const row=grouped.get(key)||{key,name:String(name),directions:[]};
    const direction=report.direccion==="emitida"?"Ingresos":report.direccion==="recibida"?"Egresos":"";
    if(direction&&!row.directions.includes(direction))row.directions.push(direction);
    grouped.set(key,row);
  }
  return [...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,"es"));
});
const missingReportClients=computed(()=>Math.max(0,activeClientsCount.value-reportClientRows.value.length));

async function fetchAllPages<T>(fetchPage:(page:{limit:number;offset:number})=>Promise<T[]>){
  const items:T[]=[];const limit=200;
  for(let offset=0,round=0;round<100;offset+=limit,round+=1){const batch=await fetchPage({limit,offset});if(!Array.isArray(batch))break;items.push(...batch);if(batch.length<limit)break}
  return items;
}
async function loadFinancialSummary(){try{const response=await es.getDatos();datos.value={...emptyData(),...(response||{})}}catch(error){console.error(error);loadError.value="No se pudo cargar el resumen financiero."}finally{loading.value=false}}
async function loadOperationalSummary(){
  operationalLoading.value=true;operationalErrors.value=[];
  const [clientResult,taskResult,availableResult,complianceResult,reportResult]=await Promise.allSettled([
    fetchAllPages<ClientRecord>(page=>cs.getClientes(page)),
    fetchAllPages<TaskRecord>(page=>ts.getTareas(page)),
    fetchAllPages<TaskRecord>(page=>ts.getTareasDisponibles(page)),
    cos.getOpiniones(),
    fs.getReports(),
  ]);
  if(clientResult.status==="fulfilled")clients.value=clientResult.value;else operationalErrors.value.push("clientes");
  const loadedTasks=[...(taskResult.status==="fulfilled"?taskResult.value:[]),...(availableResult.status==="fulfilled"?availableResult.value:[])];
  const uniqueTasks=new Map(loadedTasks.map(task=>[String(task.id_tarea??Math.random()),task]));tasks.value=[...uniqueTasks.values()];
  if(taskResult.status==="rejected"&&availableResult.status==="rejected")operationalErrors.value.push("tareas");
  if(complianceResult.status==="fulfilled")complianceSummary.value={...emptyCompliance(),...(complianceResult.value.summary||{})};else operationalErrors.value.push("opiniones");
  if(reportResult.status==="fulfilled")reports.value=Array.isArray(reportResult.value)?reportResult.value:[];else operationalErrors.value.push("reportes");
  operationalLoading.value=false;
}
const emptyDataPlugin={id:"emptyData",beforeDraw(chart:any){if(chart.data.datasets.every((dataset:any)=>!dataset.data?.some((value:number)=>value!==0))){const{ctx,width,height}=chart;ctx.save();ctx.textAlign="center";ctx.fillStyle="#8e8b84";ctx.font="700 14px Courier New";ctx.fillText("NO HAY INFORMACION PARA ESTE PERIODO",width/2,height/2);ctx.restore()}}};

onMounted(async()=>{
  await Promise.allSettled([loadFinancialSummary(),loadOperationalSummary()]);
  if(!localStorage.getItem("tourInicioDone"))homeTutorialOpen.value=true;
});
