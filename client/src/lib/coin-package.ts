/** Shape returned by /api/coins/packages after the API's camel-case transform. */
export interface CoinPackage {
  id: number;
  name: string;
  coins: number;
  bonusCoins: number | null;
  bonusLabel?: string | null;
  priceEgp: string | number;
  isActive: boolean;
}