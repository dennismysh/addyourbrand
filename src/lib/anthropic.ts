import Anthropic from "@anthropic-ai/sdk";

// On Netlify with AI Gateway enabled, ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL
// are auto-injected. Locally, set ANTHROPIC_API_KEY in .env.local — the SDK
// default base URL hits api.anthropic.com directly.
export const anthropic = new Anthropic();

export const MODEL = "claude-opus-4-7" as const;
