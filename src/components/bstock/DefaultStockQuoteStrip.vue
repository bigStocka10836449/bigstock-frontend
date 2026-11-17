<template>
  <section class="quote-section" aria-label="個股報價">
    <div class="quote-row">
      <div class="quote-strip">
        <RouterLink
          v-for="{ name: code, label, price } in displayQuotes"
          :key="code"
          :to="{ name: 'candlestick', query: { stockCode: code } }"
          class="quote-pill"
        >
          <span class="quote-code">{{ code }}</span>
          <span class="quote-details">
            <span class="quote-name">{{ label }}</span>
            <span class="quote-price">{{ formatPrice(price) }}</span>
          </span>
        </RouterLink>
      </div>
      <button
        ref="subscriptionToggle"
        type="button"
        class="quote-subscription-toggle"
        :aria-expanded="subscriptionsOpen"
        aria-controls="quote-subscriptions"
        @click="subscriptionsOpen = !subscriptionsOpen"
      >
        報價訂閱
      </button>
    </div>
    <QuoteSubscriptionPanel :open="subscriptionsOpen" @subscribed="closeSubscriptions" />
  </section>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { RouterLink } from 'vue-router'
  import QuoteSubscriptionPanel from './QuoteSubscriptionPanel.vue'
  import { useMarketStore } from '@/stores/marketStore'
  import { DEFAULT_STOCKS } from '@/types/defaultStockQuotes'

  const marketStore = useMarketStore()
  const subscriptionsOpen = ref(false)
  const subscriptionToggle = ref<HTMLButtonElement | null>(null)
  const displayQuotes = computed(() => marketStore.webStockQuotes ?? DEFAULT_STOCKS.map(({ code, label }) => ({
    name: code,
    label,
    price: marketStore.defaultStockQuotes?.prices[code],
  })))
  const formatter = new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  function closeSubscriptions() {
    if (!subscriptionsOpen.value) return
    subscriptionsOpen.value = false
    subscriptionToggle.value?.focus()
  }

  function formatPrice(price: number | null | undefined): string {
    return price == null ? '—' : formatter.format(price)
  }
</script>

<style scoped>
  .quote-section {
    max-width: 1200px;
    margin: 0 auto;
  }

  .quote-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .quote-strip {
    display: flex;
    flex: 1;
    min-width: 0;
    gap: 12px;
    padding: 2px 2px 6px;
    overflow-x: auto;
  }

  .quote-subscription-toggle {
    flex: none;
    padding: 8px 12px;
    border: 1px solid #4a5d69;
    border-radius: 7px;
    background: #1b2229;
    color: #f1f5f9;
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  .quote-subscription-toggle:hover,
  .quote-subscription-toggle:focus-visible,
  .quote-subscription-toggle[aria-expanded='true'] {
    border-color: #65c995;
  }

  .quote-pill {
    display: flex;
    box-sizing: border-box;
    flex: 0 0 176px;
    align-items: center;
    gap: 10px;
    height: 62px;
    padding: 8px 12px;
    border: 1px solid #303942;
    border-radius: 999px;
    background: #1b2229;
    color: #f1f5f9;
    text-decoration: none;
  }

  .quote-pill:hover,
  .quote-pill:focus-visible {
    border-color: #65c995;
    background: #212b33;
  }

  .quote-code {
    display: grid;
    place-items: center;
    width: 43px;
    height: 34px;
    flex: none;
    border-radius: 999px;
    background: #24313b;
    color: #91bfff;
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .quote-details {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    flex: 1;
    min-width: 0;
    gap: 2px;
    white-space: nowrap;
  }

  .quote-name,
  .quote-price {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quote-name {
    color: #c5cbd3;
    font-size: 12px;
  }

  .quote-price {
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
