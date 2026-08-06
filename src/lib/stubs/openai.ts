// ============================================
// OpenAI Stub — Deterministic, seedable responses
// for topic suggestions, scenario generation,
// critique analysis, and evaluation judge.
// ============================================

import { seededRandom } from "../utils";
import type {
  TurnAnalysis,
  TopicSuggestion,
  ScenarioTurn,
  ScenarioSpeaker,
  ScenarioBudget,
  DiscussionCategory,
  CrossTalkLevel,
} from "../types";

const TOPIC_POOL: TopicSuggestion[] = [
  { topic: "Redesign the patient check-in experience for a hospital app", domain: "healthcare", description: "Critique a proposed mobile check-in flow that replaces paper forms with a digital kiosk-to-phone handoff." },
  { topic: "Rethink the grocery delivery last-mile logistics dashboard", domain: "logistics", description: "Evaluate a real-time driver dispatch and route optimization interface for reducing late deliveries." },
  { topic: "Improve the new-hire onboarding portal for remote-first teams", domain: "hr-tech", description: "Critique a self-service onboarding platform that combines paperwork, training, and team introductions." },
  { topic: "Redesign the public transit trip planner for accessibility", domain: "civic-tech", description: "Evaluate a multi-modal transit app that prioritizes wheelchair-accessible routes and audio navigation." },
  { topic: "Reimagine the classroom participation tool for hybrid learning", domain: "edtech", description: "Critique a tool that lets remote and in-person students contribute equally during discussions." },
  { topic: "Streamline the small-business tax filing interview", domain: "fintech", description: "Evaluate a conversational UI that guides sole proprietors through quarterly tax estimates." },
  { topic: "Improve the incident response dashboard for SRE teams", domain: "devops", description: "Critique a real-time alert triage and runbook interface for on-call engineers." },
  { topic: "Rethink the food waste tracking app for restaurants", domain: "sustainability", description: "Evaluate an inventory-to-waste logging tool that suggests menu adjustments based on patterns." },
  { topic: "Redesign the library resource discovery kiosk", domain: "public-service", description: "Critique a touch-screen catalog browser that helps patrons find physical and digital resources." },
  { topic: "Improve the climate-data explorer for local government planners", domain: "govtech", description: "Evaluate an interactive map that overlays flood risk, heat islands, and tree canopy to inform zoning decisions." },
];

const CATEGORIES: DiscussionCategory[] = ["evidence", "questions", "positions", "decisions", "actions", "themes"];

const VOICE_POOL: Array<{ voiceId: string; timbreClass: string; accent: string }> = [
  { voiceId: "alloy", timbreClass: "neutral_warm", accent: "american" },
  { voiceId: "echo", timbreClass: "warm_deep", accent: "american" },
  { voiceId: "fable", timbreClass: "bright_airy", accent: "british" },
  { voiceId: "onyx", timbreClass: "deep_authoritative", accent: "american" },
  { voiceId: "nova", timbreClass: "warm_friendly", accent: "american" },
  { voiceId: "shimmer", timbreClass: "clear_bright", accent: "american" },
];

const NAMES = ["Alex", "Blake", "Casey", "Drew", "Ellis", "Frankie"];

/**
 * Get deterministic topic suggestions.
 */
export function stubTopicSuggestions(seed: number = 0, exclude: string[] = [], count: number = 5): TopicSuggestion[] {
  const rng = seededRandom(seed);
  const available = TOPIC_POOL.filter(t => !exclude.includes(t.topic));

  // Shuffle deterministically
  const shuffled = [...available].sort(() => rng() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Generate a deterministic scenario with turns and speaker casting.
 */
export function stubGenerateScenario(params: {
  seed?: number;
  topic: string;
  durationMinutes: number;
  speakerCount: number;
  difficulty: string;
  crossTalkLevel: CrossTalkLevel;
}): {
  title: string;
  description: string;
  objective: string;
  criteria: string[];
  speakers: ScenarioSpeaker[];
  turns: ScenarioTurn[];
  budget: ScenarioBudget;
} {
  const { seed = 42, topic, durationMinutes, speakerCount, crossTalkLevel } = params;
  const rng = seededRandom(seed);

  const title = `${topic.split(" for ")[0] || topic} — Critique`;
  const description = `A simulated ${durationMinutes}-minute Design Thinking critique of ${topic.toLowerCase()}. ${speakerCount} participants with ${crossTalkLevel} cross-talk.`;

  // Build objective and criteria
  const objective = `Evaluate the proposed design for ${topic.toLowerCase()}, surfacing evidence-based strengths, weaknesses, questions, and actionable next steps.`;

  const criteria = [
    "Design addresses the stated user need with evidence from research or testing",
    "Technical feasibility is supported by at least one concrete example or constraint",
    "At least one divergent perspective or minority view is voiced and documented",
    "Every major claim is backed by a specific observation, metric, or quote",
    "The discussion produces at least two actionable next steps",
  ];

  // Cast speakers
  const shuffledVoices = [...VOICE_POOL].sort(() => rng() - 0.5);
  const speakers: ScenarioSpeaker[] = [];
  for (let i = 0; i < speakerCount && i < NAMES.length; i++) {
    const voice = shuffledVoices[i % shuffledVoices.length];
    speakers.push({
      index: i,
      name: NAMES[i],
      voiceId: voice.voiceId,
      accent: voice.accent,
      timbreClass: voice.timbreClass,
    });
  }

  // Generate turns — roughly 10-15 turns per minute for a natural discussion pace
  const turnsPerMinute = 8 + Math.floor(rng() * 4); // 8-11
  const totalTurns = Math.max(
    speakerCount * 3, // at least 3 turns per speaker
    Math.floor(durationMinutes * turnsPerMinute * (0.9 + rng() * 0.2))
  );

  const avgTurnDurationMs = Math.floor((durationMinutes * 60 * 1000) / totalTurns * 0.7); // 70% speaking, 30% pause

  const turns: ScenarioTurn[] = [];
  let currentMs = 2000; // Start after 2s silence

  // Overlap parameters
  const overlapChance = crossTalkLevel === "frequent" ? 0.25 : crossTalkLevel === "occasional" ? 0.1 : 0;
  const maxOverlapMs = 1500;

  for (let i = 0; i < totalTurns; i++) {
    const speakerIndex = i % speakerCount;
    const speaker = speakers[speakerIndex];
    const turnDuration = Math.floor(avgTurnDurationMs * (0.6 + rng() * 0.8));

    const text = generateTurnText(topic, speaker.name, i, totalTurns, rng);

    const turn: ScenarioTurn = {
      index: i,
      speakerIndex,
      text,
      expectedCategory: CATEGORIES[Math.floor(rng() * CATEGORIES.length)],
      startMs: currentMs,
      endMs: currentMs + turnDuration,
    };

    // Handle overlaps
    if (overlapChance > 0 && i > 0 && rng() < overlapChance) {
      const prevTurn = turns[i - 1];
      // Only overlap if no calibration turn and not already overlapping
      const overlapAmount = Math.floor(rng() * maxOverlapMs);
      turn.startMs = Math.max(currentMs - overlapAmount, prevTurn.startMs + 500);
      turn.overlapWith = [i - 1];
      prevTurn.overlapWith = [...(prevTurn.overlapWith || []), i];
    }

    turns.push(turn);

    // Add pause between turns (no overlap at end)
    const pauseMs = Math.floor(500 + rng() * 1500);
    currentMs = turn.endMs + pauseMs;
  }

  // Budget estimation
  const totalCharacters = turns.reduce((sum, t) => sum + t.text.length, 0);
  const budget: ScenarioBudget = {
    estimatedTurns: totalTurns,
    estimatedCharacters: totalCharacters,
    estimatedCostUsd: Math.round((totalTurns * 0.002 + totalCharacters * 0.00001) * 100) / 100,
    characterBudget: totalCharacters + 5000,
    turnBudget: totalTurns + 5,
  };

  return { title, description, objective, criteria, speakers, turns, budget };
}

/**
 * Stub turn analysis.
 */
export function stubAnalyzeTurn(
  turnText: string,
  sessionObjective: string,
  recentContext: Array<{ id: string; category: string; text: string }>,
  seed: number = 0
): TurnAnalysis {
  const rng = seededRandom(seed ^ turnText.length);
  const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
  const text = turnText.toLowerCase();

  // Deterministic category assignment based on keywords
  let detectedCategory: DiscussionCategory = category;
  if (text.includes("evidence") || text.includes("data") || text.includes("test") || text.includes("shows")) {
    detectedCategory = "evidence";
  } else if (text.includes("?") || text.includes("how") || text.includes("what if") || text.includes("wonder")) {
    detectedCategory = "questions";
  } else if (text.includes("i think") || text.includes("i believe") || text.includes("position") || text.includes("argue")) {
    detectedCategory = "positions";
  } else if (text.includes("decide") || text.includes("agreed") || text.includes("conclusion") || text.includes("decided")) {
    detectedCategory = "decisions";
  } else if (text.includes("next") || text.includes("action") || text.includes("will do") || text.includes("todo")) {
    detectedCategory = "actions";
  }

  return {
    category: detectedCategory,
    confidence: 0.75 + rng() * 0.2,
    evidence: text.length > 50 ? text.slice(0, 100) + "…" : text,
    rationale: `Categorized as "${detectedCategory}" based on linguistic markers in the turn text.`,
    intent: `Speaker appears to be contributing to the discussion about ${sessionObjective.slice(0, 50)}`,
    stance: rng() > 0.5 ? "supportive" : "constructive",
    theme: `Theme related to ${sessionObjective.slice(0, 40)}`,
  };
}

/**
 * Stub scenario cost estimation.
 */
export function stubEstimateScenario(durationMinutes: number, speakerCount: number, crossTalkLevel: CrossTalkLevel): ScenarioBudget {
  const turnsPerMinute = 8 + Math.floor(Math.random() * 3);
  const totalTurns = Math.floor(durationMinutes * turnsPerMinute);
  const avgCharsPerTurn = 80 + Math.floor(Math.random() * 60);
  const totalCharacters = totalTurns * avgCharsPerTurn;

  return {
    estimatedTurns: totalTurns,
    estimatedCharacters: totalCharacters,
    estimatedCostUsd: Math.round((totalTurns * 0.002) * 100) / 100,
    characterBudget: totalCharacters + 5000,
    turnBudget: totalTurns + 5,
  };
}

function generateTurnText(topic: string, speakerName: string, turnIndex: number, totalTurns: number, rng: () => number): string {
  const phases = [
    // Opening — framing
    [
      `I'd like to start by framing our discussion around ${topic}. What specific user needs are we addressing?`,
      `Looking at the current design, my first observation is that the user flow seems disconnected from the core problem statement.`,
      `Before we dive into details, let's establish our criteria. What does success look like for this solution?`,
    ],
    // Middle — evidence and critique
    [
      `That's an interesting point. The usability data from last quarter showed a ${Math.floor(30 + rng() * 50)}% improvement when we simplified similar flows.`,
      `I want to challenge that assumption. Our user interviews revealed that people actually prefer having more control, not less.`,
      `From a technical perspective, this approach would require significant changes to the backend architecture. Can we prototype a lighter version first?`,
      `The research paper by Nielsen on heuristic evaluation suggests we should test this against all ten principles before committing.`,
      `One thing I noticed is that the design assumes users will always have stable internet. What about offline scenarios?`,
      `Actually, I have a different take. The real problem isn't the interface — it's that the underlying data model doesn't match how users think about their tasks.`,
      `That's a valid concern. Could we address it by adding a progressive disclosure pattern? Show the basics first, then reveal advanced options.`,
      `Let me add some context from the competitive analysis. Three of our top competitors already solved this with a card-based layout, and their engagement went up ${Math.floor(10 + rng() * 30)}%.`,
    ],
    // Closing — decisions and actions
    [
      `So to summarize, we've identified three key issues: the data model mismatch, the connectivity assumption, and the over-complexity of the initial view.`,
      `I think we're converging. Let's agree on the top two priorities and assign owners before we wrap up.`,
      `My action item would be to run a quick A/B test on the simplified version by next sprint. Who can I partner with on that?`,
      `Before we end, I want to flag that we haven't discussed accessibility. This needs to work with screen readers from day one.`,
      `Good discussion. I'll document our decisions and share the notes. Let's reconvene next week with prototypes for the two approaches we settled on.`,
    ],
  ];

  const phaseIndex = turnIndex < totalTurns * 0.2 ? 0 : turnIndex < totalTurns * 0.7 ? 1 : 2;
  const pool = phases[phaseIndex];
  return pool[Math.floor(rng() * pool.length)];
}

export { VOICE_POOL, NAMES, CATEGORIES };
