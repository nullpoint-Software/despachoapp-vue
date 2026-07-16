import type { InjectionKey, Slots } from "vue";
export interface AppColumnConfig { id:symbol; field?:string; sortable?:boolean; slots:Slots }
export interface AppTableContext { register(column:AppColumnConfig):void; update(id:symbol,column:Partial<AppColumnConfig>):void; unregister(id:symbol):void }
export const appTableKey:InjectionKey<AppTableContext>=Symbol("app-table");
