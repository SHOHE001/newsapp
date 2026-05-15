import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // API key not configured — skip to next provider
    if (msg.includes("is not set")) return true;
    // 429 Too Many Requests / quota exhausted
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) {
      return true;
    }
    // 5xx server errors
    if (
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("internal server error") ||
      msg.includes("service unavailable")
    ) {
      return true;
    }
  }
  // Check numeric status property (some SDKs expose it)
  const err = error as { status?: number; statusCode?: number };
  const status = err.status ?? err.statusCode;
  if (typeof status === "number") {
    if (status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
  }
  return false;
}

async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

async function generateWithGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty response");
  return content;
}

async function generateWithCloudflare(prompt: string): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not set");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });

  if (!response.ok) {
    const status = response.status;
    const err = new Error(`Cloudflare Workers AI error: ${status}`) as Error & { status: number };
    err.status = status;
    throw err;
  }

  const data = (await response.json()) as { result?: { response?: string } };
  const text = data?.result?.response;
  if (!text) throw new Error("Cloudflare Workers AI returned empty response");
  return text;
}

type ProviderFn = (prompt: string) => Promise<string>;

const providers: Array<{ name: string; fn: ProviderFn }> = [
  { name: "Gemini", fn: generateWithGemini },
  { name: "Groq", fn: generateWithGroq },
  { name: "Cloudflare Workers AI", fn: generateWithCloudflare },
];

export async function generateText(prompt: string): Promise<string> {
  const errors: Array<{ provider: string; error: unknown }> = [];

  for (const { name, fn } of providers) {
    try {
      const result = await fn(prompt);
      return result;
    } catch (error) {
      if (isRetryableError(error)) {
        errors.push({ provider: name, error });
        // Fall through to next provider
        continue;
      }
      // Non-retryable error (e.g. bad API key format, invalid request) — rethrow
      throw error;
    }
  }

  const summary = errors
    .map(({ provider, error }) => `${provider}: ${error instanceof Error ? error.message : String(error)}`)
    .join(" | ");
  throw new Error(`All AI providers failed. ${summary}`);
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. Do not include markdown code fences or any explanation outside the JSON.`;
  const text = await generateText(jsonPrompt);

  // Strip optional markdown code fences (```json ... ```)
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  return JSON.parse(cleaned) as T;
}
