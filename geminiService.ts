
import { GoogleGenAI, Type } from "@google/genai";
import { ProductResult, IngredientResult } from "../types";

const API_KEY = process.env.API_KEY || '';

export const analyzeProductImage = async (base64Image: string): Promise<ProductResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Identify the Kirana (grocery) product in this image and provide pricing analysis.
    
    IMPORTANT: Write the SUMMARY and ADVICE in Hinglish.

    Tasks:
    1. Identify Brand and Product Name.
    2. Detect/Estimate Weight (e.g., 1kg, 500g). Extract numeric value and unit separately.
    3. Detect MRP/Price if visible in photo.
    4. Use Google Search to find current average market prices.
    5. Decide if the user should 'BUY_NOW' or 'WAIT'.

    Provide response in this exact format:
    PRODUCT_NAME: [Name]
    BRAND: [Brand Name]
    WEIGHT: [Full Weight String, e.g., 500g]
    NUMERIC_WEIGHT: [Just the number, e.g., 500]
    WEIGHT_UNIT: [Just the unit, g or kg]
    NUMERIC_PRICE: [The average market price as a number only, e.g., 20]
    PHOTO_PRICE: [Price string in photo]
    MARKET_PRICE: [Full Market price string, e.g., ₹20]
    OFFICIAL_PRICE: [Price on major retail apps]
    TIMING: [BUY_NOW or WAIT]
    SUMMARY: [A 2-sentence summary in Hinglish]
    ADVICE: [Specific advice in Hinglish]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: prompt }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    const extract = (key: string) => {
      const match = text.match(new RegExp(`${key}:\\s*(.*)`, 'i'));
      return match ? match[1].trim() : '';
    };

    const timingRaw = extract('TIMING');
    const timingRecommendation: 'BUY_NOW' | 'WAIT' = timingRaw.toUpperCase().includes('WAIT') ? 'WAIT' : 'BUY_NOW';

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri
      }));

    const baseWeightValue = parseFloat(extract('NUMERIC_WEIGHT')) || 1;
    const basePriceValue = parseFloat(extract('NUMERIC_PRICE')) || 0;

    return {
      productName: extract('PRODUCT_NAME'),
      brand: extract('BRAND'),
      estimatedWeight: extract('WEIGHT'),
      baseWeightValue,
      baseWeightUnit: extract('WEIGHT_UNIT') || 'g',
      basePriceValue,
      detectedPriceInPhoto: extract('PHOTO_PRICE'),
      currentMarketPrice: extract('MARKET_PRICE'),
      officialPrice: extract('OFFICIAL_PRICE'),
      summary: extract('SUMMARY'),
      aiAdvice: extract('ADVICE'),
      timingRecommendation,
      sources
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Product analyze nahi ho paya. Please ek saaf photo click karein.");
  }
};

export const analyzeIngredients = async (base64Image: string): Promise<IngredientResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Analyze the grocery product in this image specifically for its ingredients and health impact.
    
    IMPORTANT: Provide the HEALTH_ADVICE, SHOULD_CONSUME, and FREQUENCY_ADVICE in Hinglish.

    Tasks:
    1. Identify Product Name and Brand.
    2. List all visible or known ingredients.
    3. Breakdown the composition (e.g., Sugar: 20g, Fats: 10g).
    4. Provide AI advice on health impact.
    5. State clearly if it should be consumed (Yes/No/Moderate).
    6. Advise on how much/how often to eat it.

    Provide response in this exact JSON format:
    {
      "productName": "string",
      "brand": "string",
      "ingredients": ["string"],
      "composition": [{"item": "string", "amount": "string"}],
      "healthAdvice": "string (Hinglish)",
      "shouldConsume": "string (Hinglish)",
      "frequencyAdvice": "string (Hinglish)",
      "nutritionalHighlights": "string (Hinglish)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Ingredient Analysis Error:", error);
    throw new Error("Ingredients scan nahi ho paye. Please label ki saaf photo click karein.");
  }
};
