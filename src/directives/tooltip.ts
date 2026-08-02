import type { Directive } from "vue";

function setTooltip(element: HTMLElement, value: unknown): void {
  element.setAttribute("title", String(value ?? ""));
}

export const tooltipDirective: Directive<HTMLElement, unknown> = {
  mounted: (element, binding) => setTooltip(element, binding.value),
  updated: (element, binding) => setTooltip(element, binding.value),
};
