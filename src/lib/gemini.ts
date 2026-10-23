import "server-only";

export interface ExplainInput {
  skuId: string;
  name: string;
  action: string;
  suggestedQty: number;
  ruleReason: string;
}

export interface Explanation {
  summary: string;
  reasons: Record<string, string>;
  model: string;
}

// Gemini only writes plain-English explanations. It never sets quantities or flags.
export async function explainRecommendations(
  items: ExplainInput[],
  context: { asOf: string; festivalMonth: boolean },
): Promise<Explanation> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const prompt = `You are helping Raghav, the senior demand planner at Freshroots (an FMCG distributor in Maharashtra & Goa), review this week's reorder recommendations.
The numbers and decisions below were computed by fixed business rules. Do NOT change, recompute or invent any number, quantity or decision. Only explain them.

Data as of ${context.asOf}. ${context.festivalMonth ? "This is a festival month (+25% demand uplift applied)." : ""}

Recommendations (JSON):
${JSON.stringify(items)}

Return JSON with:
- "summary": 2-3 short sentences for Raghav: what needs action first and why, naming SKUs.
- "reasons": an object mapping each skuId to ONE plain-English sentence (max 30 words) explaining the recommendation and what Raghav should double-check.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Gemini HTTP ${res.status}`);
  const text: string | undefined = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  const parsed = JSON.parse(text) as { summary?: string; reasons?: Record<string, string> };
  return {
    summary: String(parsed.summary ?? "").slice(0, 800),
    reasons: Object.fromEntries(
      Object.entries(parsed.reasons ?? {}).map(([k, v]) => [k, String(v).slice(0, 400)]),
    ),
    model: json.modelVersion ?? model,
  };
}
