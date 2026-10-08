export interface FinancialCalendar {
  id: string
  month: string | null
  year: string | null
  // 實際 JSON 格式尚待 HTTP response 驗證，暫時兼容字串與 epoch millis
  eventDate: string | number | null
  title: string | null
  dataType: string | null
  dataTypeName: string | null
  articleId: number | null
  hyperLink: string | null
  sorucePlatfont: string | null
}
