
export interface PriceSource {
  title: string;
  uri: string;
}

export interface ProductResult {
  productName: string;
  brand: string;
  estimatedWeight: string;
  baseWeightValue: number;
  baseWeightUnit: string;
  basePriceValue: number;
  detectedPriceInPhoto?: string;
  currentMarketPrice: string;
  officialPrice?: string;
  summary: string;
  aiAdvice: string;
  timingRecommendation: 'BUY_NOW' | 'WAIT';
  sources: PriceSource[];
}

export interface IngredientResult {
  productName: string;
  brand: string;
  ingredients: string[];
  composition: { item: string; amount: string }[];
  healthAdvice: string;
  shouldConsume: string;
  frequencyAdvice: string;
  nutritionalHighlights: string;
}

export type AppView = 'PRICE_SCOUT' | 'HEALTH_SCOUT';

export interface AppState {
  view: AppView;
  image: string | null;
  loading: boolean;
  priceResult: ProductResult | null;
  healthResult: IngredientResult | null;
  error: string | null;
}
