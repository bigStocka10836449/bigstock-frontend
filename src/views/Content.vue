<template>
  <div class="content">
    <!-- 動態渲染組件 -->
    <component :is="currentComponent" />
  </div>
</template>

<script>

import Candlestick from './BstockCandlestick.vue';

export default {
  props: {
    currentComponent: {
      type: String,
      required: true,
    },
  },
  components: {
    Candlestick,
  },
};
</script>

<style>
.content {
  flex-grow: 1; /* 填滿剩餘空間 */
  flex-direction: column;
  overflow: auto; /* 內容過多時允許滾動 */
}
</style>