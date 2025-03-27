<template>
  <div id="app">
    <!-- Header 傳入事件給 App 控制登入跳窗 -->
    <Header
      @update-view="updateCurrentView"
      @toggle-login-popup="toggleLoginPopup"
      @logout="userLogOut"
      :user="user"
    />

    <!-- 主內容 -->
    <Content :currentComponent="currentComponent" />

    <!-- 登入/註冊彈窗 -->
    <div v-if="isLoginPopupVisible" class="popup">
      <div class="popup-content">
        <!-- 標題 -->
        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
        <h2>{{ currentTab === 'login' ? '登入' : '註冊帳號' }}</h2>

        <!-- 登入表單 -->
        <div v-if="currentTab === 'login'" class="form">
          <input placeholder="帳號" v-model="loginForm.account" />
          <input type="password" placeholder="密碼" v-model="loginForm.password" />
          <button class="primary-btn" @click="submitLogin">登入</button>
          <div class="switch-text">
            還沒有帳號嗎？
            <span class="link" @click="switchTab('register')">註冊帳號</span>
          </div>
        </div>

        <!-- 註冊表單 -->
        <div v-else class="form">
          <input placeholder="手機" v-model="registerForm.phone" />
          <input placeholder="電話" v-model="registerForm.tel" />
          <select v-model="registerForm.gender">
            <option disabled value="">性別</option>
            <option>男</option>
            <option>女</option>
            <option>其他</option>
          </select>
          <input type="date" v-model="registerForm.birthday" />
          <button class="primary-btn" @click="submitRegister">註冊</button>
          <div class="switch-text">
            已經有帳號了？
            <span class="link" @click="switchTab('login')">登入</span>
          </div>
        </div>

        <!-- 關閉 -->
        <div class="close-btn" @click="isLoginPopupVisible = false">關閉</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'
  import Header from './views/Header.vue'
  import Content from './views/Content.vue'
  import apiClient from './router/bstockAxios'
  import { useLocalStorageWithTTL as useLocalStorage } from './composables/UseLocalStorageWithTTL'
  import { number } from 'echarts'

  const {
    data: user,
    isExpired,
    save: saveUser,
    clear: clearUser,
  } = useLocalStorage<{ name: string; loginToken: string; isLogin: boolean }>('user', {
    name: '',
    loginToken: '',
    isLogin: false,
  })

  // 狀態
  const currentComponent = ref('Candlestick')
  const isLoginPopupVisible = ref(false)
  const currentTab = ref<'login' | 'register'>('login')
  const errorMessage = ref('')
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

  async function submitLogin() {
    try {
      const loginData = {
        userName: loginForm.value.account,
        password: loginForm.value.password,
      }
      const response = await apiClient.post('/auth/login', loginData)

      if (response.status === 200) {
        const userData = {
          name: loginForm.value.account,
          loginToken: response.data,
          isLogin: true,
        }
        saveUser(userData)
        useLocalStorage(loginForm.value.account, userData)
        errorMessage.value = '' // 清空錯誤訊息
        isLoginPopupVisible.value = false
      } else {
        errorMessage.value = '登入失敗，請確認帳號與密碼是否正確。'
      }
    } catch (e) {
      errorMessage.value = '登入失敗，請稍後再試。'
    }
  }

  function submitRegister() {
    console.log('註冊：', registerForm.value)
    isLoginPopupVisible.value = false
  }

  function switchTab(tab: 'login' | 'register') {
    currentTab.value = tab
    errorMessage.value = ''
  }

  function userLogOut(isLogOut: boolean) {
    if (isLogOut) {
      clearUser()
    }
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

  .popup {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 9999; /* 保證在最上層 */
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.6); /* 黑色半透明遮罩 */
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .popup-content {
    background: white;
    color: black;
    padding: 30px 25px;
    border-radius: 12px;
    width: 320px;
    text-align: center;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .popup-content h2 {
    margin-bottom: 20px;
    font-size: 22px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  input,
  select {
    padding: 8px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 6px;
  }

  .primary-btn {
    background-color: #333;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 6px;
    font-size: 15px;
    cursor: pointer;
  }

  .primary-btn:hover {
    background-color: #555;
  }

  .switch-text {
    margin-top: 10px;
    font-size: 13px;
  }

  .switch-text .link {
    color: #007bff;
    cursor: pointer;
    margin-left: 4px;
  }

  .link:hover {
    text-decoration: underline;
  }

  .close-btn {
    margin-top: 20px;
    color: red;
    cursor: pointer;
    font-size: 14px;
  }
  .error-message {
    color: red;
    font-size: 13px;
    margin-bottom: 10px;
  }
</style>
