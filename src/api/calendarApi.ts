import apiClient from '@/router/bstockAxios'
import type { FinancialCalendar } from '@/types/calendar'

// 取得全部財經行事曆事件
export async function getFinancialCalendar(): Promise<FinancialCalendar[]> {
  const response = await apiClient.get<FinancialCalendar[]>('/biz/financialCalendar')
  return response.data
}
