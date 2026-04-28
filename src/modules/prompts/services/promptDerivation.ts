import { TranscriptItem } from "@/modules/transcript/types";
import { PromptSuggestion } from "@/modules/prompts/types";

interface Rule {
  match: RegExp;
  title: string;
  prompt: (text: string) => string;
}

const RULES: Rule[] = [
  {
    match: /\bwhy\b|because|reason|cause/i,
    title: "Probe the reasoning",
    prompt: (t) => `They gave a reason — ask them to elaborate: "${truncate(t)}"`,
  },
  {
    match: /unclear|confus|not sure|don'?t know|maybe|perhaps/i,
    title: "Clarify uncertainty",
    prompt: (t) => `They expressed uncertainty — invite them to explore: "${truncate(t)}"`,
  },
  {
    match: /next step|follow.?up|action|plan|going to|will do/i,
    title: "Capture the action",
    prompt: (t) => `They mentioned a next step — confirm and document: "${truncate(t)}"`,
  },
  {
    match: /problem|issue|risk|blocked|challenge|difficult|struggle/i,
    title: "Surface the blocker",
    prompt: (t) => `They flagged a problem — dig deeper: "${truncate(t)}"`,
  },
  {
    match: /feel|felt|emotion|frustrat|excit|disappoint|happy|annoyed/i,
    title: "Explore the emotion",
    prompt: (t) => `They showed emotion — ask what's underneath: "${truncate(t)}"`,
  },
  {
    match: /always|never|every time|constantly|usually/i,
    title: "Challenge the absolute",
    prompt: (t) => `They used an absolute — probe the pattern: "${truncate(t)}"`,
  },
  {
    match: /\bwe\b|\bteam\b|\beveryone\b|\bthey\b/i,
    title: "Unpack the 'we'",
    prompt: (t) => `They spoke collectively — ask who specifically: "${truncate(t)}"`,
  },
  {
    match: /important|critical|key|main|primary|biggest/i,
    title: "Prioritise this",
    prompt: (t) => `They flagged something as important — ask why: "${truncate(t)}"`,
  },
];


const FALLBACK_TITLES = [
  "Ask for an example",
  "Ask how often this happens",
  "Ask what would change things",
  "Ask what they tried before",
  "Ask who else is affected",
];

function truncate(text: string, max = 70): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export function derivePromptSuggestions(
  items: TranscriptItem[],
): PromptSuggestion[] {
  if (items.length === 0) return [];

  const recent = items.slice(-10);
  const matched: PromptSuggestion[] = [];

  for (const item of [...recent].reverse()) {
    const rule = RULES.find((r) => r.match.test(item.text));
    if (rule) {
      const id = `${item.id}-${rule.title}`;
      if (!matched.some((s) => s.id === id)) {
        matched.push({
          id,
          title: rule.title,
          body: rule.prompt(item.text),
          transcriptId: item.id,
          transcriptIds: [item.id],
          timestamp: item.timestamp,
          transcriptTimeLabel: item.formattedTime,
          suggestionOrigin: "local",
        });
      }
    }
    if (matched.length >= 4) break;
  }

  if (matched.length < 2) {
    const tail = items.slice(-Math.min(6, items.length));
    const usedTitles = new Set(matched.map((s) => s.title));
    let slot = 0;
    for (const title of FALLBACK_TITLES) {
      if (matched.length >= 3) break;
      if (usedTitles.has(title)) continue;
      const item = tail.length
        ? tail[tail.length - 1 - (slot % tail.length)]
        : items[items.length - 1];
      slot += 1;
      matched.push({
        id: `${item.id}-fallback-${title}`,
        title,
        body: truncate(item.text),
        transcriptId: item.id,
        transcriptIds: [item.id],
        timestamp: item.timestamp,
        transcriptTimeLabel: item.formattedTime,
        suggestionOrigin: "local",
      });
    }
  }

  return matched.slice(0, 4);
}
