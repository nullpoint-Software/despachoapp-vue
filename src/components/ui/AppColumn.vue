<script lang="ts">
import { defineComponent,inject,onBeforeUnmount,watch,useSlots } from "vue";
import { appTableKey } from "./tableContext";
export default defineComponent({name:"AppColumn",props:{field:String,sortable:{type:Boolean,default:false}},setup(props){const table=inject(appTableKey);if(!table)throw new Error("AppColumn debe usarse dentro de AppDataTable");const id=Symbol("column");const slots=useSlots();table.register({id,field:props.field,sortable:props.sortable,slots});watch(()=>[props.field,props.sortable],()=>table.update(id,{field:props.field,sortable:props.sortable}));onBeforeUnmount(()=>table.unregister(id));return()=>null}});
</script>
