// lib/marketRates.ts — City commodity ticker data (demo / offline-friendly)

export type MarketRateItem = {
  id: string;
  label: string;
  value: string;
  changePct: number;
};

export type MarketTickerSnapshot = {
  city: string;
  updatedLabel: string;
  items: MarketRateItem[];
};

/** Demo rates — replace with live API when available */
export function getMarketTickerSnapshot(city?: string): MarketTickerSnapshot {
  const label = city?.trim() || 'Your city';
  return {
    city: label,
    updatedLabel: 'Today',
    items: [
      { id: 'gold24', label: 'Gold 24K / 10g', value: '₹72,450', changePct: 0.42 },
      { id: 'gold22', label: 'Gold 22K / 10g', value: '₹66,380', changePct: 0.38 },
      { id: 'silverKg', label: 'Silver / 1kg', value: '₹92,100', changePct: -0.15 },
      { id: 'silver10', label: 'Silver / 10g', value: '₹921', changePct: -0.12 },
      { id: 'petrol', label: 'Petrol / L', value: '₹96.72', changePct: 0.0 },
      { id: 'diesel', label: 'Diesel / L', value: '₹89.45', changePct: -0.08 },
      { id: 'wheat', label: 'Wheat Mandi / qtl', value: '₹2,180', changePct: 1.2 },
    ],
  };
}
