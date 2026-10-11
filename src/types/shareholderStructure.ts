/** 後端 ShareholderStructure：數值欄位目前均為 String，原樣保存避免誤判單位。 */
export interface ShareholderStructure {
  id: string
  stockCode: string
  stockName: string | null
  weekOfYear: string | null
  countDate: string | null
  openingPrice: string | null
  closingPrice: string | null
  priceChange: string | null
  priceChangePercent: string | null
  tdccStock: string | null
  stockTotal: string | null
  totalPeople: string | null
  lessThanOneBoardLot: string | null
  betweenOneAndFiveBoardLot: string | null
  betweenFiveAndTenBoardLot: string | null
  betweenTenAndFifteenBoardLot: string | null
  betweenFifteenAndTwentyBoardLot: string | null
  betweenTwentyAndThirtyBoardLot: string | null
  betweenThirtyAndFortyBoardLot: string | null
  betweenFortyAndFiftyBoardLot: string | null
  betweenFiftyAndOneHundredBoardLot: string | null
  betweenOneHundredAndTwoHundredBoardLot: string | null
  betweenTwoHundredAndFourHundredBoardLot: string | null
  betweenFourHundredAndSixHundredBoardLot: string | null
  betweenSixHundredAndEightHundredBoardLot: string | null
  betweenEightHundredAndOneThousandBoardLot: string | null
  overOneThousandBoardLot: string | null
  lessThanOneBoardLotPeople: string | null
  betweenOneAndFiveBoardLotPeople: string | null
  betweenFiveAndTenBoardLotPeople: string | null
  betweenTenAndFifteenBoardLotPeople: string | null
  betweenFifteenAndTwentyBoardLotPeople: string | null
  betweenTwentyAndThirtyBoardLotPeople: string | null
  betweenThirtyAndFortyBoardLotPeople: string | null
  betweenFortyAndFiftyBoardLotPeople: string | null
  betweenFiftyAndOneHundredBoardLotPeople: string | null
  betweenOneHundredAndTwoHundredBoardLotPeople: string | null
  betweenTwoHundredAndFourHundredBoardLotPeople: string | null
  betweenFourHundredAndSixHundredBoardLotPeople: string | null
  betweenSixHundredAndEightHundredBoardLotPeople: string | null
  betweenEightHundredAndOneThousandBoardLotPeople: string | null
  overOneThousandBoardLotPeople: string | null
}
