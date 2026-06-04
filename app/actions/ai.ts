"use server";

import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const SYSTEM_PROMPT = `You are a professional writing assistant. You only return raw Markdown text — no greetings, no explanations, no conversational filler. Output only the requested text transformation, preserving the original language.`;

type AIAction = "summarize" | "improve" | "fix-grammar";

const ACTION_PROMPTS: Record<AIAction, string> = {
  summarize:
    "Summarize the following text concisely while preserving key points. Output only the summarized Markdown:",
  improve:
    "Improve the following text's clarity, tone, and flow. Make it more professional and polished. Output only the improved Markdown:",
  "fix-grammar":
    "Fix all grammar, spelling, and punctuation errors in the following text. Do not change the style or tone. Output only the corrected Markdown:",
};

export async function aiAction(text: string, action: AIAction): Promise<string> {
  if (!text.trim()) {
    return text;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${ACTION_PROMPTS[action]}\n\n${text}` },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const result = response.choices[0]?.message?.content;
    return result ?? text;
  } catch (error) {
    console.error("DeepSeek API error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to process text with AI"
    );
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