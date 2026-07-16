<template>
  <details ref="menu" class="palette-selector">
    <summary title="Cambiar paleta" aria-label="Cambiar paleta"><i class="pi pi-palette"/><span>Paleta</span></summary>
    <div class="palette-menu">
      <header><b>Paleta visual</b><small>La preferencia se guarda en este dispositivo.</small></header>
      <button v-for="palette in palettes" :key="palette.id" type="button" :class="{active:selectedPalette===palette.id}" @click="select(palette.id)">
        <span class="swatches"><i v-for="color in palette.colors" :key="color" :style="{backgroundColor:color}"/></span><b>{{ palette.name }}</b><i v-if="selectedPalette===palette.id" class="pi pi-check"/>
      </button>
    </div>
  </details>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { useColorPalette, type PaletteId } from "@/composables/useColorPalette";
const {palettes,selectedPalette,applyPalette}=useColorPalette();const menu=ref<HTMLDetailsElement|null>(null);
function select(id:PaletteId){applyPalette(id);if(menu.value)menu.value.open=false}
</script>
<style scoped>
.palette-selector{position:relative}.palette-selector summary{display:flex;min-height:3rem;align-items:center;justify-content:center;gap:.5rem;border:1px solid var(--br-line-strong);padding:.65rem .8rem;background:var(--br-panel-2);color:var(--br-text);font:800 .72rem "Courier New",monospace;text-transform:uppercase;cursor:pointer;list-style:none}.palette-selector summary::-webkit-details-marker{display:none}.palette-menu{position:absolute;right:0;top:calc(100% + .5rem);z-index:1200;width:18rem;border:1px solid var(--br-line-strong);background:var(--br-panel);box-shadow:7px 7px 0 var(--br-accent)}.palette-menu header{padding:.9rem;border-bottom:1px solid var(--br-line);color:var(--br-text)}.palette-menu header b,.palette-menu header small{display:block}.palette-menu header b{text-transform:uppercase}.palette-menu header small{margin-top:.25rem;color:var(--br-muted);font:600 .68rem/1.35 "Courier New",monospace}.palette-menu button{display:grid;width:100%;grid-template-columns:4.1rem 1fr 1rem;align-items:center;gap:.65rem;border:0;border-bottom:1px solid var(--br-line);background:transparent;color:var(--br-text);padding:.8rem;text-align:left;font:800 .72rem "Courier New",monospace;cursor:pointer}.palette-menu button:hover,.palette-menu button.active{background:var(--br-accent);color:var(--br-accent-text)}.swatches{display:flex}.swatches i{width:1.35rem;height:1.35rem;border:1px solid rgba(255,255,255,.35)}@media(max-width:700px){.palette-selector{width:100%}.palette-selector summary{width:100%}.palette-menu{left:0;right:auto}}
</style>
