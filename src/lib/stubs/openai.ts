// ============================================
// OpenAI Stub — Deterministic, seedable responses
// for topic suggestions, scenario generation,
// critique analysis, and evaluation judge.
// ============================================

import { seededRandom } from "../utils";
import { estimateBudget, expectedOverlapCount } from "../budget";
import { createDefaultCasting } from "../voice-casting";
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
  const objective = `Evaluate the proposed design for ${topic.toLowerCase()}, surfacing evidence-based strengths, weaknesses, questions, and actionable next steps.`;
  const criteria = [
    "The flow addresses a specific user need",
    "Important edge cases can recover without staff intervention",
    "The next test can distinguish between the leading alternatives",
  ];
  const speakers = createDefaultCasting(speakerCount);
  const budget = estimateBudget(durationMinutes, speakerCount, crossTalkLevel);
  const turns: ScenarioTurn[] = [];
  for (const speaker of speakers) {
    turns.push({
      id: `t${turns.length}`,
      index: turns.length,
      speakerIndex: speaker.index,
      text: `I'm ${speaker.name}, the ${speaker.role}. I'll ${firstPersonPhrase(speaker.viewpoint || "watch how the design affects people")}, and I usually ${firstPersonPhrase(speaker.habitualMove || "ask for a concrete example")}.`,
      isCalibration: true,
      pauseBeforeMs: 1200,
      expectedCategory: "themes",
      expected: {
        substantive: false,
        category: "themes",
        potentialSignal: "none",
      },
    });
  }
  const mainCount = budget.targetTurns || Math.round(durationMinutes * 9);
  const overlapTargets = new Set<number>();
  const overlapCount = expectedOverlapCount(durationMinutes, crossTalkLevel);
  for (let n = 0; n < overlapCount; n++) {
    overlapTargets.add(
      Math.min(
        mainCount - 2,
        4 + Math.round(((n + 1) / (overlapCount + 1)) * (mainCount - 7))
      )
    );
  }
  let lastSpeaker = -1;
  for (let mainIndex = 0; mainIndex < mainCount; mainIndex++) {
    const index = turns.length;
    const progress = mainIndex / Math.max(1, mainCount - 1);
    const speakerIndex = chooseStubSpeaker(speakerCount, mainIndex, lastSpeaker, rng);
    lastSpeaker = speakerIndex;
    const move = stubDialogueMove(mainIndex, progress, topic, rng);
    const overlap =
      overlapTargets.has(mainIndex) && mainIndex > 2
        ? {
            withTurnId: `t${index - 1}`,
            startBeforeEndMs: 350 + Math.round(rng() * 500),
            kind:
              move.text.split(/\s+/).length <= 3
                ? ("backchannel" as const)
                : rng() > 0.5
                  ? ("interruption" as const)
                  : ("eager_agreement" as const),
            resolution:
              move.text.split(/\s+/).length <= 3
                ? ("backchannel" as const)
                : rng() > 0.45
                  ? ("yield" as const)
                  : ("continue" as const),
          }
        : undefined;
    turns.push({
      id: `t${index}`,
      index,
      speakerIndex,
      text: move.text,
      isCalibration: false,
      pauseBeforeMs: overlap ? 0 : move.pauseBeforeMs,
      expectedCategory: move.category,
      expected: {
        substantive: move.text.split(/\s+/).length >= 4,
        category: move.category,
        potentialSignal: "none",
        reactsToTurnId:
          mainIndex === 0
            ? undefined
            : `t${Math.max(speakerCount, index - (rng() > 0.82 ? 2 : 1))}`,
      },
      overlap,
    });
  }
  return { title, description, objective, criteria, speakers, turns, budget };
}

function firstPersonPhrase(value: string): string {
  return value
    .replace(/^keeps\b/, "keep")
    .replace(/^protects\b/, "protect")
    .replace(/^tests\b/, "test")
    .replace(/^asks\b/, "ask")
    .replace(/^builds\b/, "build")
    .replace(/^names\b/, "name")
    .replace(/^stays\b/, "stay")
    .replace(/^turns\b/, "turn");
}

function chooseStubSpeaker(
  speakerCount: number,
  turnIndex: number,
  lastSpeaker: number,
  rng: () => number
): number {
  const responsePattern = [0, 1, 0, 2, 1, 3, 0, 2, 4, 1, 5, 3];
  let candidate = responsePattern[turnIndex % responsePattern.length] % speakerCount;
  if (candidate === lastSpeaker) {
    candidate =
      (candidate + 1 + Math.floor(rng() * Math.max(1, speakerCount - 1))) %
      speakerCount;
  }
  return candidate;
}

function stubDialogueMove(
  index: number,
  progress: number,
  topic: string,
  rng: () => number
): { text: string; category: DiscussionCategory; pauseBeforeMs: number } {
  const artifact = topic.replace(/^(redesign|improve|rethink|reimagine)\s+/i, "");
  const opening = [
    [`Can we start with the moment someone actually reaches ${artifact}? What have they already tried?`, "questions"],
    ["The sketch assumes they arrive confident. In the last walkthrough, they were already looking for reassurance.", "evidence"],
    ["Right, but reassurance could mean a clearer next step—not another screen of explanation.", "positions"],
    ["I'm not sure those are alternatives. The next step can carry the reassurance if it confirms what just happened.", "positions"],
    ["Wait—the confirmation, or the instruction after it?", "questions"],
    ["The confirmation. If that vanishes, the next instruction feels untrustworthy.", "evidence"],
    ["Okay. Then our problem is continuity, not simply fewer taps.", "themes"],
  ] as const;
  const middle = [
    ["That helps, though I'm still worried about the person who stops halfway and comes back.", "positions"],
    ["Could we keep their place without making the screen look permanently occupied?", "questions"],
    ["Maybe, but automatic recovery creates a privacy problem in a shared setting.", "positions"],
    ["Yes—good catch.", "themes"],
    ["What if recovery starts with a neutral prompt and only reveals details after one verification step?", "questions"],
    ["That gives us something testable. We can compare recognition with a fresh start.", "actions"],
    ["Before we settle on that, what happens when staff are helping three people at once?", "questions"],
    ["Then the staff view needs to show where someone is stuck, not the content they entered.", "positions"],
    ["I was assuming staff would take over the whole flow. I think your version is safer.", "positions"],
    ["Safer, yes, but it also adds a handoff. We should watch whether people understand who acts next.", "evidence"],
    ["Could the interface say that plainly: “You stay here; a staff member has been notified”?", "positions"],
    ["That sentence is useful. It removes the little spinner we were relying on to communicate too much.", "decisions"],
    ["Mm-hm.", "themes"],
    ["There's another edge case: somebody may leave because they think the spinner means failure.", "positions"],
    ["So the message needs an immediate state and a delayed state, not one indefinite waiting state.", "themes"],
    ["I can prototype those two states without changing the rest of the flow.", "actions"],
  ] as const;
  const closing = [
    ["I'm hearing one test around recovery and another around the staff handoff. Which uncertainty matters first?", "questions"],
    ["Recovery first. If people cannot tell their progress is safe, the handoff copy will not rescue it.", "positions"],
    ["I disagree slightly—the handoff is where the operational risk sits, even if fewer people reach it.", "positions"],
    ["Could we keep that disagreement in the test instead of resolving it here?", "questions"],
    ["Yes. Use two failure points and observe whether recovery or handoff causes the longer stall.", "decisions"],
    ["I'll build the interrupted-flow prototype and instrument those two points.", "actions"],
    ["I'll recruit participants who are less familiar with this kind of service; our current sample is too comfortable.", "actions"],
    ["And I'll check the privacy wording with frontline staff. I don't want that concern to disappear from the readout.", "actions"],
    ["Good. We have a next test, but the staff-capacity question stays open.", "decisions"],
  ] as const;
  const pool = progress < 0.2 ? opening : progress < 0.78 ? middle : closing;
  const selected = pool[index % pool.length];
  let text =
    rng() > 0.86 && selected[0].split(/\s+/).length > 5
      ? selected[0].replace(/^That /, "No—wait, that ")
      : selected[0];
  const cycle = Math.floor(index / pool.length);
  if (cycle > 0 && text.split(/\s+/).length > 3) {
    const lenses = [
      "first-time use",
      "a rushed return visit",
      "shared-device privacy",
      "staff handoff",
      "an interrupted session",
      "low-confidence users",
      "recovery after an error",
      "the busiest operating hour",
      "assistive technology",
      "the next prototype test",
      "what the screen leaves implicit",
      "who has to act next",
    ];
    text = `${text} I'm thinking specifically about ${lenses[(index + cycle) % lenses.length]}.`;
  }
  return {
    text,
    category: selected[1] as DiscussionCategory,
    pauseBeforeMs:
      selected[0].includes("?") || selected[0].includes("disagree")
        ? 750
        : 280 + Math.round(rng() * 360),
  };
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

export { VOICE_POOL, NAMES, CATEGORIES };
