<template>
  <div id="app">
    <!-- Header 傳入事件給 App 控制登入跳窗 -->
    <Header @update-view="updateCurrentView" @toggle-login-popup="toggleLoginPopup" :user="user" />

    <!-- 主內容 -->
    <Content :currentComponent="currentComponent" />

    <!-- 登入跳窗控制由 App.vue 負責 -->
    <div v-if="isLoginPopupVisible" class="popup">
      <div class="popup-content">
        <div class="tabs">
          <div :class="{ active: currentTab === 'login' }" @click="currentTab = 'login'">登入</div>
          <div :class="{ active: currentTab === 'register' }" @click="currentTab = 'register'">
            註冊
          </div>
        </div>

        <div v-if="currentTab === 'login'">
          <input placeholder="帳號" v-model="loginForm.account" />
          <input type="password" placeholder="密碼" v-model="loginForm.password" />
          <button @click="submitLogin">登入</button>
        </div>

        <div v-else>
          <input placeholder="手機" v-model="registerForm.phone" />
          <input placeholder="電話" v-model="registerForm.tel" />
          <select v-model="registerForm.gender">
            <option disabled value="">性別</option>
            <option>男</option>
            <option>女</option>
            <option>其他</option>
          </select>
          <input type="date" v-model="registerForm.birthday" />
          <button @click="submitRegister">註冊</button>
        </div>

        <div class="close" @click="isLoginPopupVisible = false">關閉</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'
  import Header from './views/Header.vue'
  import Content from './views/Content.vue'
  import apiClient from './router/bstockAxios'

  const user = ref<{ isLoggedIn: boolean; name: string }>(
    JSON.parse(localStorage.getItem('user') || 'null') || {
      isLoggedIn: false,
      name: '',
    },
  )

  // 狀態
  const currentComponent = ref('Candlestick')
  const isLoginPopupVisible = ref(false)
  const currentTab = ref<'login' | 'register'>('login')

  // 表單
  const loginForm = ref({ account: '', password: '' })
  const registerForm = ref({ phone: '', tel: '', gender: '', birthday: '' })

  function updateCurrentView(view: string) {
    currentComponent.value = view
  }

  function toggleLoginPopup(isOpen: boolean) {
    isLoginPopupVisible.value = isOpen
    currentTab.value = 'login'
  }

  function submitLogin() {
    console.log('登入：', loginForm.value)
    isLoginPopupVisible.value = false
  }

  function submitRegister() {
    console.log('註冊：', registerForm.value)
    isLoginPopupVisible.value = false
  }
</script>

<style>
  html,
  body {
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
