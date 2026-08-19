import { defineAsyncComponent, type App, type Component } from "vue";
import KanbanBoard from "@/components/kanbanComponents/KanbanBoard/KanbanBoard.vue";
import KanbanCard from "@/components/kanbanComponents/KanbanCard/KanbanCard.vue";
import KanbanColumn from "@/components/kanbanComponents/KanbanColumn/KanbanColumn.vue";

interface ComponentModule {
  default: Component;
}


interface GlobalComponentAlias {
  alias: string;
  component: string;
}

const REQUIRED_GLOBAL_COMPONENTS: Readonly<Record<string, Component>> = {
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
};

const componentLoaders: Record<string, () => Promise<ComponentModule>> = {
  ...import.meta.glob<ComponentModule>([
    "../components/**/*.vue",
    "!../components/kanbanComponents/KanbanBoard/KanbanBoard.vue",
    "!../components/kanbanComponents/KanbanCard/KanbanCard.vue",
    "!../components/kanbanComponents/KanbanColumn/KanbanColumn.vue",
  ]),
  ...import.meta.glob<ComponentModule>("../components/**/*.tsx"),
  ...import.meta.glob<ComponentModule>("../layouts/**/*.vue"),
};

const GLOBAL_COMPONENT_ALIASES: GlobalComponentAlias[] = [
  { alias: "Avatar", component: "AppAvatar" },
  { alias: "Button", component: "AppButton" },
  { alias: "Calendar", component: "AppDateInput" },
  { alias: "Column", component: "AppColumn" },
  { alias: "DataTable", component: "AppDataTable" },
  { alias: "Divider", component: "AppDivider" },
  { alias: "InputText", component: "AppInput" },
];

function componentNameFromPath(pathname: string): string {
  const segments = pathname.split("/");
  const file = segments[segments.length - 1];
  if (!file) throw new Error(`No se pudo obtener el nombre global de ${pathname}`);
  return file.replace(/\.(?:vue|tsx)$/, "");
}


export function registerGlobalComponents(app: App): void {
  const componentsByName = new Map<string, Component>();

  for (const [componentName, component] of Object.entries(REQUIRED_GLOBAL_COMPONENTS)) {
    componentsByName.set(componentName, component);
    app.component(componentName, component);
  }

  for (const [pathname, loader] of Object.entries(componentLoaders)) {
    const componentName = componentNameFromPath(pathname);
    if (componentsByName.has(componentName)) {
      throw new Error(`Nombre de componente global duplicado: ${componentName}`);
    }
    const component = REQUIRED_GLOBAL_COMPONENTS[componentName]
      ?? defineAsyncComponent(() => loader().then((module) => module.default));
    componentsByName.set(componentName, component);
    app.component(componentName, component);
  }

  for (const { alias, component } of GLOBAL_COMPONENT_ALIASES) {
    const globalComponent = componentsByName.get(component);
    if (!globalComponent) {
      throw new Error(`El alias global ${alias} apunta a un componente inexistente: ${component}`);
    }
    app.component(alias, globalComponent);
  }
}
