import { nextTick, onBeforeUnmount, onMounted, type Ref } from "vue";
import gsap from "gsap";

export function useBrutalMotion(root: Ref<HTMLElement | null>, selectors: string[]) {
  let context: gsap.Context | null = null;
  onMounted(async () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    await nextTick();
    if (!root.value) return;
    context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { duration: .48, ease: "power3.out", clearProps: "transform,opacity" } });
      selectors.forEach((selector, index) => timeline.from(selector, { y: index ? 14 : 22, opacity: 0 }, index * .07));
    }, root.value);
  });
  onBeforeUnmount(() => context?.revert());
}
