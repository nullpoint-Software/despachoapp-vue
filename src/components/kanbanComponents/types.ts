import type { TareaDto } from "@/service/adminApp/tareasService";

export type KanbanStatus = "Disponible" | "Pendiente" | "Terminado";

export interface KanbanTask extends TareaDto {
  estado: KanbanStatus;
  highlight: boolean;
  image?: string | null;
}

export interface KanbanLane {
  status: KanbanStatus;
  label: string;
  caption: string;
  tasks: KanbanTask[];
}
