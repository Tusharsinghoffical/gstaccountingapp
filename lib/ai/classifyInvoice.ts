import { z } from "zod";
import {
  PURCHASE_INVOICE_CATEGORIES,
  purchaseCategorySchema,
} from "../validation/invoice.ts";
import type { PurchaseInvoiceCategory } from "../validation/invoice.ts";
import { logger } from "@/lib/logger";

export interface ClassifyInvoiceInput {
  vendor_name?: string | null;
  line_items?: Array<{
    description?: string | null;
    hsn_code?: string | null;
    amount?: number | null;
  }>;
}

export interface CategoryClassificationResult {
  success: boolean;
  category: PurchaseInvoiceCategory;
  confidence: number;
  explanation: string;
  modelUsed: string;
  source: "groq_llm" | "heuristic_fallback";
}

const GroqClassificationResponseSchema = z.object({
  category: purchaseCategorySchema,
  confidence: z.number().min(0).max(1).optional().default(0.85),
  explanation: z.string().optional().default("Classified based on vendor and line-item descriptions."),
});

/**
 * Heuristic fallback classifier when Groq API key is missing or network is unreachable.
 * Provides deterministic classification using high-confidence keyword matching.
 */
export function heuristicClassifyPurchaseInvoice(
  input: ClassifyInvoiceInput
): { category: PurchaseInvoiceCategory; confidence: number; explanation: string } {
  const vendor = (input.vendor_name || "").toLowerCase();
  const itemsText = (input.line_items || [])
    .map((it) => (it.description || "").toLowerCase())
    .join(" ");
  const combined = `${vendor} ${itemsText}`.trim();

  // 1. Travel
  const travelKeywords = [
    "travel", "flight", "airfare", "airline", "indigo", "air india", "vistara",
    "hotel", "lodging", "stay", "uber", "ola", "cab", "taxi", "train", "irctc",
    "ticket", "fuel", "petrol", "diesel", "boarding", "fare", "makemytrip", "yatra"
  ];
  if (travelKeywords.some((kw) => combined.includes(kw))) {
    return {
      category: "Travel",
      confidence: 0.9,
      explanation: "Matched travel, airline, transport, or lodging keywords.",
    };
  }

  // 2. Utilities
  const utilityKeywords = [
    "electricity", "power", "energy", "bescom", "tneb", "discom", "water bill",
    "gas bill", "broadband", "internet", "airtel", "jio", "telecom", "utility",
    "utilities", "sewage", "server hosting", "datacenter", "cloud compute"
  ];
  if (utilityKeywords.some((kw) => combined.includes(kw))) {
    return {
      category: "Utilities",
      confidence: 0.9,
      explanation: "Matched electricity, telecommunication, internet, or utility keywords.",
    };
  }

  // 3. Professional Services
  const professionalKeywords = [
    "software", "consult", "advisory", "legal", "lawyer", "advocate", "audit",
    "chartered accountant", "accounting", "developer", "design", "marketing",
    "retainer", "management consulting", "it services", "professional fees"
  ];
  if (professionalKeywords.some((kw) => combined.includes(kw))) {
    return {
      category: "Professional Services",
      confidence: 0.92,
      explanation: "Matched software, consulting, legal, or advisory service indicators.",
    };
  }

  // 4. Office Supplies
  const officeKeywords = [
    "stationery", "paper", "pen", "printer", "toner", "cartridge", "desk",
    "chair", "stapler", "folder", "envelope", "pantry", "tea", "coffee",
    "cleaning supplies", "office supplies", "marker", "notebook"
  ];
  if (officeKeywords.some((kw) => combined.includes(kw))) {
    return {
      category: "Office Supplies",
      confidence: 0.88,
      explanation: "Matched office stationery, furniture, or administrative supplies.",
    };
  }

  // 5. Raw Materials
  const rawKeywords = [
    "raw material", "steel", "iron", "copper", "aluminum", "sheet metal",
    "pipe", "wire", "chemical", "plastic", "polymer", "resin", "cement",
    "fabric", "cotton", "yarn", "component", "bearing", "industrial part",
    "plywood", "timber"
  ];
  if (rawKeywords.some((kw) => combined.includes(kw))) {
    return {
      category: "Raw Materials",
      confidence: 0.9,
      explanation: "Matched manufacturing inputs, metal, chemical, or raw material indicators.",
    };
  }

  return {
    category: "Other",
    confidence: 0.5,
    explanation: "General purchase that does not explicitly match standard expense categories.",
  };
}

/**
 * Classifies a purchase invoice into one of the 6 standard categories using Groq LLM JSON Mode.
 * Returns suggested category, confidence score, and rationale.
 * Never auto-applies — caller must present this as an explicit user suggestion chip.
 */
export async function classifyPurchaseInvoice(
  input: ClassifyInvoiceInput
): Promise<CategoryClassificationResult> {
  const vendorName = (input.vendor_name || "").trim();
  const descriptions = (input.line_items || [])
    .map((item) => item.description?.trim())
    .filter(Boolean);

  const groqApiKey = process.env.GROQ_API_KEY;

  if (groqApiKey && !groqApiKey.includes("your-groq-api-key")) {
    try {
      const model = "llama-3.3-70b-versatile";
      const payload = {
        vendor_name: vendorName || "Unknown Vendor",
        line_items: descriptions.length > 0 ? descriptions : ["Unspecified Item"],
      };

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        signal: AbortSignal.timeout(10000), // 10s timeout safeguard against hung requests
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `You are an expert Indian GST accounting classifier.
Classify the purchase invoice into EXACTLY ONE of the following 6 standard categories:
1. "Office Supplies" (stationery, desks, paper, pens, printer ink, office pantry, packaging)
2. "Raw Materials" (manufacturing inputs, steel, chemicals, cloth, wood, industrial parts)
3. "Utilities" (electricity, water, broadband, gas, telecommunications, cloud hosting)
4. "Professional Services" (legal, accounting, IT/software consultancy, design, marketing, auditing)
5. "Travel" (airfare, hotels, cab, train tickets, fuel, lodging, vehicle rental)
6. "Other" (anything that does not clearly fit the above 5 categories)

Return ONLY a JSON object with this exact structure:
{
  "category": "Office Supplies" | "Raw Materials" | "Utilities" | "Professional Services" | "Travel" | "Other",
  "confidence": number (between 0.0 and 1.0),
  "explanation": string (short 1-sentence rationale)
}`,
            },
            {
              role: "user",
              content: `Classify this purchase invoice:\n${JSON.stringify(payload, null, 2)}`,
            },
          ],
        }),
      });

      if (res.ok) {
        const groqJson = await res.json();
        const content = groqJson.choices?.[0]?.message?.content;
        if (content) {
          const parsedContent = JSON.parse(content);
          const validated = GroqClassificationResponseSchema.safeParse(parsedContent);
          if (validated.success) {
            return {
              success: true,
              category: validated.data.category,
              confidence: validated.data.confidence,
              explanation: validated.data.explanation,
              modelUsed: model,
              source: "groq_llm",
            };
          }
        }
      }
    } catch (groqErr) {
      logger.warn("Groq invoice classification call failed, falling back to heuristic", groqErr);
    }
  }

  // Fallback heuristic classifier
  const heuristic = heuristicClassifyPurchaseInvoice(input);
  return {
    success: true,
    category: heuristic.category,
    confidence: heuristic.confidence,
    explanation: heuristic.explanation,
    modelUsed: "heuristic-classifier",
    source: "heuristic_fallback",
  };
}
