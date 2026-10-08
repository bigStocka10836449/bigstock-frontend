<template>
  <main class="page">
    <h1>分類與產業</h1>
    <p>依照 BigStock 後端 tagsMapping 所提供的分類顯示，不預設所有 tag 都是交易所產業別。</p>
    <label>搜尋分類 <input v-model.trim="keyword" placeholder="分類名稱或代碼" /></label>
    <p v-if="loading">載入中…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <ul>
      <li v-for="item in filtered" :key="item.tag">
        <RouterLink :to="{ name: 'industry-detail', params: { tag: item.tag } }"
          >{{ item.title }} ({{ item.tag }})</RouterLink
        >
      </li>
    </ul>
  </main>
</template>
<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { getIndustryMappings } from '@/api/industryApi'
  const items = ref<{ tag: string; title: string }[]>([])
  const keyword = ref('')
  const loading = ref(false)
  const error = ref('')
  const filtered = computed(() =>
    items.value.filter((x) =>
      (x.tag + x.title).toLowerCase().includes(keyword.value.toLowerCase()),
    ),
  )
  onMounted(async () => {
    loading.value = true
    try {
      items.value = Object.entries(await getIndustryMappings())
        .map(([tag, title]) => ({ tag, title }))
        .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
    } catch (e) {
      console.error(e)
      error.value = '分類載入失敗'
    } finally {
      loading.value = false
    }
  })
</script>
<style scoped>
  .page {
    padding: 24px;
    min-height: 100vh;
    background: #151515;
    color: #eee;
  }
  input {
    padding: 8px;
  }
  ul {
    padding-left: 24px;
  }
  li {
    padding: 7px 0;
  }
  a {
    color: #90ccff;
  }
</style>
