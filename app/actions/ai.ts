"use server";

import OpenAI, { APIError } from "openai";

export type AIAction =
  | "summarize"
  | "improve"
  | "fix-grammar"
  | "structure-notes"
  | "prose-to-diagram"
  | "to-slides"
  | "extract-table"
  | "prompt-to-svg"
  | "translate";

const AI_UNAVAILABLE_MESSAGE =
  "The AI service is temporarily unavailable. Please try again.";

function getClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("DEEPSEEK_API_KEY is not configured");
    throw new Error("AI service is not configured");
  }
  return new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    apiKey,
  });
}

const SYSTEM_PROMPT =
  "You are Slate AI, a deterministic-grade document & conversion assistant. Return ONLY the transformed output without conversational filler or greeting.";

const ACTION_PROMPTS: Record<AIAction, string> = {
  summarize:
    "Summarize the following text concisely in clean Markdown with key bullet takeaways:",
  improve:
    "Improve the clarity, tone, and professional flow of the following text. Output only the improved Markdown:",
  "fix-grammar":
    "Fix all grammar, spelling, and punctuation errors in the following text without changing its meaning. Output only the corrected Markdown:",
  "structure-notes":
    "Convert the following unstructured notes or messy text into a well-organized Markdown document with clear #/## headings, bullet points, action items (- [ ]), and a summary table if appropriate:",
  "prose-to-diagram":
    "Analyze the following text and convert the process, architecture, or relationships into a clean Markdown breakdown containing an ASCII/Unicode visual flowchart and a step-by-step table:",
  "to-slides":
    "Convert the following content into a multi-slide presentation in Markdown. Separate each slide with a horizontal rule (---) on its own line, give each slide a clear # or ## heading, concise bullet points, and optional 'Note: ...' speaker notes at the bottom of each slide:",
  "extract-table":
    "Extract all structured facts, metrics, entities, or comparisons from the following text into a clean GitHub-Flavored Markdown (GFM) table. Output ONLY the Markdown table:",
  "prompt-to-svg":
    "Generate clean, scalable, modern, self-contained <svg> vector code for the following description. Use proper viewBox, clean paths/shapes, and appealing colors. Output ONLY the raw <svg>...</svg> markup with no markdown fences:",
  translate:
    "Translate the following Markdown text while strictly preserving all Markdown syntax, links, code blocks, and tables untouched:",
};

export async function aiAction(
  text: string,
  action: AIAction,
  targetLanguage = "Spanish"
): Promise<string> {
  try {
    if (typeof text !== "string" || !text.trim()) {
      return typeof text === "string" ? text : "";
    }

    const client = getClient();
    const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
    const promptPrefix =
      action === "translate"
        ? "Translate the following Markdown document into " +
          targetLanguage +
          " while strictly preserving all Markdown formatting, code blocks, and URLs untouched:"
        : ACTION_PROMPTS[action];

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: promptPrefix + "\n\n" + text },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const result = response.choices[0]?.message?.content?.trim();
    return result || text;
  } catch (error) {
    // Keep diagnostics server-side; never send provider or configuration
    // details across the server-action boundary.
    console.error("AI action failed", {
      action,
      name: error instanceof Error ? error.name : "UnknownError",
      ...(error instanceof APIError
        ? { status: error.status, requestId: error.requestID }
        : {}),
    });
    throw new Error(AI_UNAVAILABLE_MESSAGE);
  }
}

export async function summarizeText(text: string): Promise<string> {
  return aiAction(text, "summarize");
}

export async function improveWriting(text: string): Promise<string> {
  return aiAction(text, "improve");
}

export async function fixGrammar(text: string): Promise<string> {
  return aiAction(text, "fix-grammar");
}
