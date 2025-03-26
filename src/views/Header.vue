<template>
  <div class="header">
    <button @click="selectView('Candlestick')">candlestick</button>

    <!-- 已登入 -->
    <div v-if="props.user.isLoggedIn" class="user-info">
      <span>歡迎, {{ props.user.name }}</span>
    </div>

    <!-- 未登入 -->
    <div v-else @click="openLoginPopup"><span>登入</span></div>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'

  const props = defineProps<{
    user: {
      isLoggedIn: boolean
      name: string
    }
  }>();
  const emit = defineEmits<(event: 'update-view', view: string) => void>()
  const openLoginPopupEmit = defineEmits<(event: 'toggle-login-popup', isOpen: boolean) => void>()

  // 當前頁籤：login or register
  const currentTab = ref<'login' | 'register'>('login')

  function selectView(view: string) {
    emit('update-view', view)
  }

  function openLoginPopup() {
    openLoginPopupEmit('toggle-login-popup', true)
  }
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
