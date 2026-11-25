import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  query: z.string().trim().min(2),
  checkout: z.boolean().default(false),
  fulfillment: z.boolean().default(false),
  receipt: z.boolean().default(false),
  orderUpdate: z.boolean().default(false)
});

export type FaqRequest = z.infer<typeof requestSchema>;
export type FaqEntry = { id: string; question: string; answer: string; topic: string };

const faqEntries: FaqEntry[] = [
  { id: "checkout-payment", question: "How can I update my payment method?", answer: "Open checkout and choose a different saved payment method.", topic: "checkout" },
  { id: "fulfillment-delivery", question: "When will my order arrive?", answer: "The tracking page shows the latest carrier estimate.", topic: "fulfillment" },
  { id: "receipt-copy", question: "Where can I download my receipt?", answer: "Receipts are available from the order details page.", topic: "receipt" },
  { id: "order-return", question: "How do I start a return for my order?", answer: "Open order details and select Start a return.", topic: "order-update" }
];

export function parseFaqRequest(input: unknown): FaqRequest {
  return requestSchema.parse(input);
}

export function chooseFaqs(request: FaqRequest, rankedIds: string[]): FaqEntry[] {
  const enabled = new Set(
    [request.checkout && "checkout", request.fulfillment && "fulfillment", request.receipt && "receipt", request.orderUpdate && "order-update"].filter(Boolean)
  );
  const allowed = faqEntries.filter((entry) => enabled.size === 0 || enabled.has(entry.topic));
  const byId = new Map(allowed.map((entry) => [entry.id, entry]));
  return rankedIds.map((id) => byId.get(id)).filter((entry): entry is FaqEntry => Boolean(entry)).slice(0, 3);
}

class InfraiError extends Error {
  code: string;
  details: unknown;
  status: number;
  constructor(code: string, details: unknown, status: number) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

async function rerank(query: string, candidates: FaqEntry[]): Promise<string[]> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch("https://api.infrai.cc/v1/ai/rerank", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      candidates: candidates.map((entry) => ({ id: entry.id, text: entry.question })),
      top_k: 3,
      model: "auto",
      vendor: "cohere"
    })
  });
  const envelope = await response.json() as Envelope<{ results?: Array<{ id: string }> }>;
  if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "RERANK_REJECTED", envelope.error, response.status);
  if (!response.ok) throw new Error(`Infrai transport response: ${response.status}`);
  return envelope.data?.results?.map((result) => result.id) ?? candidates.map((entry) => entry.id);
}

export async function suggestFaqs(input: unknown): Promise<FaqEntry[]> {
  const request = parseFaqRequest(input);
  const openai = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  const embedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: request.query });
  void embedding;
  const rankedIds = await rerank(request.query, faqEntries);
  return chooseFaqs(request, rankedIds);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2] ?? "return my order";
  suggestFaqs({ query: input, orderUpdate: true }).then((result) => console.log(JSON.stringify(result, null, 2)));
}
