<template>
  <span
    ref="rootEl"
    class="info-tooltip"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <button
      type="button"
      class="info-tooltip__trigger"
      :aria-label="`${title}說明`"
      :aria-expanded="visible"
      @click.stop="opened = !opened"
      @keydown.esc.prevent="dismiss"
      @focus="focused = true"
      @blur="focused = false"
    >
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 7.5h.01" stroke-width="2.5" />
      </svg>
    </button>
    <span
      v-if="visible"
      class="info-tooltip__popup"
      :class="{ 'info-tooltip__popup--right': align === 'right' }"
      role="tooltip"
    >
      <strong>{{ title }}</strong>
      <span>{{ description }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

  withDefaults(
    defineProps<{
      title: string
      description: string
      align?: 'left' | 'right'
    }>(),
    { align: 'left' },
  )

  const rootEl = ref<HTMLElement | null>(null)
  const hovered = ref(false)
  const focused = ref(false)
  const opened = ref(false)
  const visible = computed(() => hovered.value || focused.value || opened.value)

  function dismiss(): void {
    opened.value = false
    hovered.value = false
    focused.value = false
  }
  function handleOutside(event: PointerEvent): void {
    if (rootEl.value && !rootEl.value.contains(event.target as Node)) opened.value = false
  }
  function handleEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') dismiss()
  }
  onMounted(() => {
    document.addEventListener('pointerdown', handleOutside)
    document.addEventListener('keydown', handleEscape)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handleOutside)
    document.removeEventListener('keydown', handleEscape)
  })
</script>

<style scoped>
  .info-tooltip {
    position: relative;
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }
  .info-tooltip__trigger {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    background: transparent;
    color: #a3bbca;
    border-radius: 50%;
    cursor: help;
    padding: 0;
  }
  .info-tooltip__trigger:hover,
  .info-tooltip__trigger:focus-visible {
    background: #334957;
    color: #a5f0d3;
    outline: 1px solid #6bbfa4;
  }
  .info-tooltip__popup {
    position: absolute;
    z-index: 100;
    top: calc(100% + 7px);
    left: 0;
    width: min(270px, calc(100vw - 42px));
    max-width: 270px;
    box-sizing: border-box;
    border: 1px solid #536c7b;
    background: #263846;
    color: #e9f2f6;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
    padding: 11px 13px;
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.6;
    white-space: normal;
    text-align: left;
    pointer-events: none;
  }
  .info-tooltip__popup--right {
    left: auto;
    right: 0;
  }
  .info-tooltip__popup strong {
    display: block;
    color: #f2fafc;
    font-size: 13px;
    margin-bottom: 4px;
  }
  .info-tooltip__popup span {
    display: block;
    color: #c8d8df;
  }
</style>
