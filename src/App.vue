<template>
  <div id="app">
    <!-- Header 組件 -->
    <Header @update-view="updateCurrentView" />

    <!-- Content 組件 -->
    <Content :currentComponent="currentComponent" />
  </div>
</template>

<script>
import Header from './views/Header.vue';
import Content from './views/Content.vue';

export default {
  components: {
    Header,
    Content,
  },
  data() {
    return {
      currentComponent: 'Candlestick', // 初始顯示的組件
    };
  },
  methods: {
    updateCurrentView(view) {
      this.currentComponent = view; // 更新當前顯示的組件
    },
  },
};
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden; /* 防止滾動條 */
}

#app {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

header {
  flex-shrink: 0; /* 防止被壓縮 */
  height: 50px; /* 固定高度 */
  background-color: #333;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
}

main {
  flex-grow: 1; /* 填滿剩餘空間 */
  display: flex; /* 確保內容區域可以展開 */
  flex-direction: column;
  background-color: #222;
  color: white;
  overflow: hidden; /* 禁止滾動條 */
}
</style>