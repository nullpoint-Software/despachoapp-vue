import { computed, onMounted, onUnmounted, ref } from "vue";
import { useNotesStore, type Note } from "@/composables/useNotesStore";
import { useBrutalMotion } from "@/composables/useBrutalMotion";
import { useAppDialog } from "@/composables/useAppDialog";
const {notes,storageNotes,isLoading,error,fetchNotes,addNote,updateNote,deleteNote}=useNotesStore();
const {prompt:promptDialog,confirm:confirmDialog}=useAppDialog();
const pageRef=ref<HTMLElement|null>(null);useBrutalMotion(pageRef,[".directory-header",".tree-panel",".directory-content"]);
const FOLDERS_KEY="notesDirectoryFolders";
const folders=ref<string[]>(loadFolders());
const currentPath=ref("General"),query=ref(""),editorOpen=ref(false),editing=ref<Note|null>(null),saving=ref(false);
const rootExpanded=ref(true);
const expandedFolders=ref<Set<string>>(new Set());
const draggedNoteId=ref<number|null>(null);
const dropTarget=ref("");
const moveMessage=ref("");
let moveMessageTimer:number|undefined;
const draft=ref({titulo:"",descripcion:"",folderPath:"General"});
function normalizePath(path:string){const clean=String(path||"").split("/").map(part=>part.trim().replace(/[\\/]+/g,"-")).filter(Boolean);if(!clean.length)return"General";if(clean[0].toLocaleLowerCase("es")!=="general")clean.unshift("General");return clean.join("/")}
function folderAncestors(path:string){const normalized=normalizePath(path);const parts=normalized.split("/");return parts.slice(1).map((_,index)=>parts.slice(0,index+2).join("/"))}
function loadFolders(){try{return JSON.parse(localStorage.getItem(FOLDERS_KEY)||"[]").map(normalizePath).filter((path:string)=>path!=="General")}catch{return []}}
function saveFolders(){folders.value=[...new Set(folders.value.map(normalizePath).filter(path=>path&&path!=="General"))].sort((a,b)=>a.localeCompare(b,"es"));localStorage.setItem(FOLDERS_KEY,JSON.stringify(folders.value))}
const allDirectoryFolders=computed(()=>{const fromNotes=notes.value.flatMap(note=>note.folderPath&&note.folderPath!=="General"?folderAncestors(note.folderPath):[]);return[...new Set([...folders.value,...fromNotes].map(normalizePath).filter(path=>path!=="General"))].sort((a,b)=>a.localeCompare(b,"es"))});
const directoryFolders=computed(()=>rootExpanded.value?allDirectoryFolders.value.filter(folder=>folderAncestors(folder).slice(0,-1).every(parent=>expandedFolders.value.has(parent))):[]);
const folderOptions=computed(()=>["General",...allDirectoryFolders.value]);
function hasChildren(folder:string){const target=normalizePath(folder);return allDirectoryFolders.value.some(candidate=>candidate.startsWith(`${target}/`))}
function isExpanded(folder:string){return expandedFolders.value.has(normalizePath(folder))}
function toggleFolder(folder:string){const target=normalizePath(folder);const next=new Set(expandedFolders.value);if(next.has(target))next.delete(target);else next.add(target);expandedFolders.value=next}
function expandPath(path:string){rootExpanded.value=true;const next=new Set(expandedFolders.value);folderAncestors(path).slice(0,-1).forEach(parent=>next.add(parent));expandedFolders.value=next}
function selectRoot(){currentPath.value="General";rootExpanded.value=!rootExpanded.value}
function selectFolder(folder:string){currentPath.value=normalizePath(folder);if(hasChildren(folder))toggleFolder(folder)}
const breadcrumbs=computed(()=>currentPath.value.startsWith("__")?[currentPath.value==="__storage"?"Archivadas":"General"]:normalizePath(currentPath.value).split("/"));
const currentLabel=computed(()=>breadcrumbs.value.join(" / "));
const visibleNotes=computed(()=>{const q=query.value.trim().toLocaleLowerCase("es");return notes.value.filter(note=>{const notePath=normalizePath(note.folderPath||"General");const activePath=currentPath.value.startsWith("__")?currentPath.value:normalizePath(currentPath.value);const inPath=activePath==="__storage"?note.status==="storage":note.status!=="storage"&&notePath===activePath;const matches=!q||`${note.titulo} ${note.descripcion} ${notePath}`.toLocaleLowerCase("es").includes(q);return inPath&&matches})});
function countFolder(folder:string){const target=normalizePath(folder);return notes.value.filter(note=>{const path=normalizePath(note.folderPath||"General");return note.status!=="storage"&&(path===target||path.startsWith(`${target}/`))}).length}
function plain(value:string){return String(value||"").replace(/[#*_>`\[\]]/g,"").slice(0,95)||"Documento sin contenido"}
function folderName(folder:string){const parts=normalizePath(folder).split("/");return parts[parts.length-1]}
function folderDepth(folder:string){return Math.max(1,normalizePath(folder).split("/").length-1)}
function treeIndent(folder:string){return {"--depth":String(folderDepth(folder))}}
function branchMark(folder:string){return hasChildren(folder)?(isExpanded(folder)?"−":"+"):"·"}
function showMoveMessage(message:string){moveMessage.value=message;if(moveMessageTimer)window.clearTimeout(moveMessageTimer);moveMessageTimer=window.setTimeout(()=>{moveMessage.value=""},3200)}
function setDropTarget(folder:string){if(draggedNoteId.value!==null)dropTarget.value=normalizePath(folder)}
function clearDropTarget(folder:string){if(dropTarget.value===normalizePath(folder))dropTarget.value=""}
function startNoteDrag(event:DragEvent,note:Note){draggedNoteId.value=note.id;event.dataTransfer?.setData("text/plain",String(note.id));if(event.dataTransfer)event.dataTransfer.effectAllowed="move"}
function finishNoteDrag(){draggedNoteId.value=null;dropTarget.value=""}
async function moveDraggedNote(folder:string){const note=notes.value.find(item=>item.id===draggedNoteId.value);const target=normalizePath(folder);if(!note){finishNoteDrag();return}const current=normalizePath(note.folderPath||"General");if(current!==target){await updateNote(note.id,note.status==="storage"?{folderPath:target,archivedFromPath:target}:{folderPath:target});if(target!=="General"){folders.value.push(...folderAncestors(target));saveFolders()}expandPath(target);showMoveMessage(`“${note.titulo||"Sin título"}” se movió a ${target}.`)}finishNoteDrag()}

async function createFolder(){const name=await promptDialog({title:"Nueva subcarpeta",message:"Escribe el nombre de la carpeta que deseas crear.",inputLabel:"Nombre",placeholder:"Ej. Declaraciones",confirmLabel:"Crear carpeta"});if(!name?.trim())return;const base=currentPath.value.startsWith("__")?"General":normalizePath(currentPath.value);const path=normalizePath(`${base}/${name}`);folders.value.push(...folderAncestors(path));saveFolders();expandPath(path);currentPath.value=path}
function createNote(){const target=currentPath.value.startsWith("__")?"General":normalizePath(currentPath.value);editing.value=null;draft.value={titulo:"",descripcion:"",folderPath:target};editorOpen.value=true}
function openNote(note:Note){editing.value=note;draft.value={titulo:note.titulo,descripcion:note.descripcion,folderPath:normalizePath(note.folderPath||"General")};editorOpen.value=true}
function closeEditor(){if(!saving.value)editorOpen.value=false}
async function saveEditor(){if(!draft.value.titulo.trim())return;saving.value=true;const path=normalizePath(draft.value.folderPath);if(path!=="General"){folders.value.push(...folderAncestors(path));saveFolders()}try{if(editing.value)await updateNote(editing.value.id,{...draft.value,folderPath:path});else await addNote({...draft.value,folderPath:path,pinned:false,color:"white",status:"canvas"});expandPath(path);currentPath.value=path;editorOpen.value=false}finally{saving.value=false}}
async function deleteFolder(folder:string){const target=normalizePath(folder);const affected=notes.value.filter(note=>{const path=normalizePath(note.folderPath||"General");return path===target||path.startsWith(`${target}/`)});const message=affected.length?`${affected.length} nota(s) pasarán a General al eliminar “${folderName(target)}”.`:`Se eliminará la carpeta “${folderName(target)}”.`;if(!await confirmDialog({title:"Eliminar carpeta",message,tone:"danger",confirmLabel:"Eliminar carpeta"}))return;folders.value=folders.value.filter(path=>{const normalized=normalizePath(path);return normalized!==target&&!normalized.startsWith(`${target}/`)});saveFolders();for(const note of affected)await updateNote(note.id,{folderPath:"General"});if(currentPath.value===target||normalizePath(currentPath.value).startsWith(`${target}/`))currentPath.value="General"}
function togglePin(note:Note){updateNote(note.id,{pinned:!Boolean(note.pinned)})}
async function toggleArchive(note:Note){
  if(note.status==="storage"){
    const restorePath=normalizePath(note.archivedFromPath||note.folderPath||"General");
    if(restorePath!=="General"){folders.value.push(...folderAncestors(restorePath));saveFolders()}
    await updateNote(note.id,{status:"canvas",folderPath:restorePath,archivedFromPath:restorePath});
    expandPath(restorePath);
    currentPath.value=restorePath;
    showMoveMessage(`“${note.titulo||"Sin título"}” regresó a ${restorePath}.`);
    return;
  }
  const originPath=normalizePath(note.folderPath||"General");
  await updateNote(note.id,{status:"storage",folderPath:originPath,archivedFromPath:originPath});
  showMoveMessage(`“${note.titulo||"Sin título"}” se archivó desde ${originPath}.`);
}
async function removeNote(note:Note){if(await confirmDialog({title:"Eliminar nota",message:`Se eliminará “${note.titulo}”.`,tone:"danger",confirmLabel:"Eliminar nota"}))await deleteNote(note.id)}
onMounted(fetchNotes);
onUnmounted(()=>{if(moveMessageTimer)window.clearTimeout(moveMessageTimer)});
