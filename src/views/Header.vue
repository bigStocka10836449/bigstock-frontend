<template>
  <div class="header">
    <button @click="selectView('Candlestick')" class="login-btn">candlestick</button>

    <!-- 已登入 -->
    <div v-if="props.user.isLogin" class="user-info">
      <span>歡迎, {{ props.user.name }}</span>
      <div @click="userLogOut" class="login-btn"><span>登出</span></div>
    </div>

    <!-- 未登入 -->
    <div v-else @click="openLoginPopup" class="login-btn"><span>登入</span></div>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'

  const props = defineProps<{
    user: {
      loginToken: string
      name: string
      isLogin: boolean
    }
  }>()
  const emit = defineEmits<{
    (event: 'update-view', view: string): void
    (event: 'toggle-login-popup', isOpen: boolean): void
    (event: 'logout', isLogout: boolean): void
  }>()

  // 當前頁籤：login or register
  const currentTab = ref<'login' | 'register'>('login')

  function selectView(view: string) {
    emit('update-view', view)
  }

  function openLoginPopup() {
    emit('toggle-login-popup', true)
  }

  function userLogOut() {
    emit('logout', true)
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

  .login-btn {
    cursor: pointer;
    padding: 5px 10px;
    border: 1px solid white;
    border-radius: 4px;
    transition:
      background-color 0.3s,
      color 0.3s;
  }

  .login-btn:hover,
  .login-btn:focus {
    background-color: white;
    color: black;
    outline: none;
  }
</style>
