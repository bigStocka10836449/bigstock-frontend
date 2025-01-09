<template>
  <div class="header">
    <!-- Header 中的選項按鈕 -->

    <button @click="selectView('Candlestick')">candlestick</button>
  </div>
</template>

<script>
export default {
  emits: ['update-view'], // 定義事件
  methods: {
    selectView(view) {
      this.$emit('update-view', view); // 將選擇的視圖通知父組件
    },
  },
};
</script>

<style>
.header {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: #333;
  padding: 10px;
  color: white;
  height: 50px; /* 固定高度 */
}

button {
  background: none;
  color: white;
  border: 1px solid white;
  padding: 5px 10px;
  cursor: pointer;
}

button:hover {
  background-color: white;
  color: black;
}
</style>