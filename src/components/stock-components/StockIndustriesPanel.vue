<template>
  <section class="tile">
    <h3>相關產業別</h3>
    <p v-if="loading" class="muted">正在載入相關產業…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!industries.length" class="muted">尚無可辨識的產業分類。</p>
    <div v-else class="tags">
      <button
        v-for="item in industries"
        :key="item.tag"
        type="button"
        @click="openIndustry(item.tag)"
      >
        {{ item.name }} ↗
      </button>
    </div>
    <p class="muted">點擊產業別可回到產業分類頁。</p>
  </section>
</template>
<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { getIndustryMappings, getStockTags } from '@/api/industryApi'
  const props = defineProps<{ stockCode: string }>()
  const router = useRouter(),
    loading = ref(false),
    error = ref(''),
    industries = ref<{ tag: string; name: string }[]>([])
  let revision = 0
  function parseTags(raw: unknown, mapping: Record<string, string>): string[] {
    const found = new Set<string>()
    const byName = new Map(Object.entries(mapping).map(([tag, name]) => [name, tag]))
    function visit(val: unknown, depth = 0): void {
      if (depth > 6) return
      if (typeof val === 'string') {
        const token = val.trim()
        if (Object.prototype.hasOwnProperty.call(mapping, token)) found.add(token)
        else if (byName.has(token)) found.add(byName.get(token)!)
        else if (/[,，;；]/.test(token)) token.split(/[,，;；]/).forEach((s) => visit(s, depth + 1))
      } else if (Array.isArray(val)) val.forEach((x) => visit(x, depth + 1))
      else if (val && typeof val === 'object')
        Object.entries(val).forEach(([k, v]) => {
          visit(k, depth + 1)
          visit(v, depth + 1)
        })
    }
    visit(raw)
    return [...found]
  }
  watch(
    () => props.stockCode,
    async (code) => {
      const seq = ++revision
      industries.value = []
      error.value = ''
      loading.value = Boolean(code)
      if (!code) return
      try {
        const [mapping, tags] = await Promise.all([getIndustryMappings(), getStockTags(code)])
        if (seq !== revision) return
        industries.value = parseTags(tags, mapping).map((tag) => ({
          tag,
          name: mapping[tag] ?? tag,
        }))
      } catch (e) {
        if (seq === revision) {
          console.error('[StockIndustries]', e)
          error.value = '相關產業查詢失敗。'
        }
      } finally {
        if (seq === revision) loading.value = false
      }
    },
    { immediate: true },
  )
  function openIndustry(tag: string) {
    void router.push({ name: 'industries', query: { tag } })
  }
</script>
<style scoped>
  .tile {
    background: #1d252d;
    border: 1px solid #33414c;
    border-radius: 12px;
    padding: 18px;
    min-width: 0;
  }
  h3 {
    margin: 0 0 15px;
    font-size: 17px;
  }
  .tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tags button {
    padding: 8px 10px;
    border: 1px solid #3f6d5a;
    color: #9fe3c1;
    background: #254337;
    border-radius: 8px;
    cursor: pointer;
  }
  .muted {
    color: #a0aebd;
    font-size: 13px;
  }
  .error {
    color: #f2aaaa;
  }
</style>
