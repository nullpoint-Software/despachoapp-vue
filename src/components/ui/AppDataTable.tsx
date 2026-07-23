import { computed,defineComponent,h,provide,ref,shallowReactive,watch,type PropType } from "vue";
import { appTableKey,type AppColumnConfig } from "./tableContext";
export default defineComponent({
  name:"AppDataTable",inheritAttrs:false,
  props:{value:{type:Array as PropType<Record<string,any>[]>,default:()=>[]},filters:{type:Object as PropType<Record<string,any>>,default:()=>({})},globalFilterFields:{type:Array as PropType<string[]>,default:()=>[]},paginator:Boolean,rows:{type:Number,default:10},rowsPerPageOptions:{type:Array as PropType<number[]>,default:()=>[5,10,20,50]},rowClass:Function as PropType<(data:any,index:number)=>string>,removableSort:Boolean},
  setup(props,{slots,attrs}){
    const columns=shallowReactive<AppColumnConfig[]>([]);
    provide(appTableKey,{register(column){if(!columns.some(item=>item.id===column.id))columns.push(column)},update(id,column){const index=columns.findIndex(item=>item.id===id);if(index>=0)Object.assign(columns[index],column)},unregister(id){const index=columns.findIndex(item=>item.id===id);if(index>=0)columns.splice(index,1)}});
    const page=ref(0),perPage=ref(props.rows),sortField=ref(""),sortDirection=ref<1|-1>(1);
    const query=computed(()=>String(props.filters?.global?.value??"").trim().toLocaleLowerCase("es"));
    const filtered=computed(()=>{const rows=!query.value?[...props.value]:props.value.filter(row=>props.globalFilterFields.some(field=>String(row?.[field]??"").toLocaleLowerCase("es").includes(query.value)));if(!sortField.value)return rows;return rows.sort((a,b)=>String(a?.[sortField.value]??"").localeCompare(String(b?.[sortField.value]??""),"es",{numeric:true})*sortDirection.value)});
    const pageCount=computed(()=>Math.max(1,Math.ceil(filtered.value.length/perPage.value)));
    const visibleRows=computed(()=>props.paginator?filtered.value.slice(page.value*perPage.value,(page.value+1)*perPage.value):filtered.value);
    const showPager=computed(()=>props.paginator&&filtered.value.length>perPage.value);
    watch([query,perPage],()=>page.value=0);watch(pageCount,count=>{if(page.value>=count)page.value=count-1});
    const toggleSort=(column:AppColumnConfig)=>{if(!column.sortable||!column.field)return;if(sortField.value===column.field){if(sortDirection.value===1)sortDirection.value=-1;else if(props.removableSort){sortField.value="";sortDirection.value=1}else sortDirection.value=1}else{sortField.value=column.field;sortDirection.value=1}};
    const pagerButton=(icon:string,label:string,disabled:boolean,action:()=>void)=>h("button",{type:"button",class:"app-pager__button",disabled,"aria-label":label,title:label,onClick:action},h("i",{class:icon}));
    return()=>h("section",{...attrs,class:["app-data-table",attrs.class]},[
      h("div",{style:"display:none"},slots.default?.()),
      slots.header?h("header",{class:"app-data-table__header"},slots.header()):null,
      h("div",{class:"app-data-table__scroll"},h("table",{class:"app-data-table__table"},[
        h("thead",{},h("tr",{},columns.map(column=>h("th",{key:String(column.id),class:{"is-sortable":column.sortable},"aria-sort":column.field===sortField.value?(sortDirection.value===1?"ascending":"descending"):"none",onClick:()=>toggleSort(column)},[column.slots.header?.(),column.field===sortField.value?h("i",{class:sortDirection.value===1?"pi pi-sort-up":"pi pi-sort-down"}):null])))),
        h("tbody",{},visibleRows.value.length?visibleRows.value.map((row,index)=>h("tr",{key:row.id??row.id_cliente??index,class:props.rowClass?.(row,index)},columns.map(column=>h("td",{key:String(column.id)},column.slots.body?.({data:row})??String(row?.[column.field||""]??""))))):h("tr",{},h("td",{colspan:Math.max(1,columns.length),class:"app-data-table__empty"},"No hay registros para mostrar")))
      ])),
      showPager.value?h("footer",{class:"app-pager"},[h("span",{},`${filtered.value.length} registros`),h("div",{class:"app-pager__controls"},[pagerButton("pi pi-angle-left","Página anterior",page.value===0,()=>page.value--),h("samp",{},`${page.value+1} / ${pageCount.value}`),pagerButton("pi pi-angle-right","Página siguiente",page.value>=pageCount.value-1,()=>page.value++),h("select",{value:perPage.value,"aria-label":"Registros por página",onChange:(event:Event)=>perPage.value=Number((event.target as HTMLSelectElement).value)},props.rowsPerPageOptions.map(option=>h("option",{value:option},`${option} por página`)))])]):null
    ])
  }
});
