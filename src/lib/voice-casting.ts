import type { ScenarioSpeaker } from "./types";

export const VOICE_CASTING_POOL = [
  { voiceId: "cedar", timbreClass: "low", accent: "neutral North American", speakingRate: 0.96 },
  { voiceId: "marin", timbreClass: "mid_high", accent: "southern British", speakingRate: 1.04 },
  { voiceId: "sage", timbreClass: "mid", accent: "Indian English", speakingRate: 0.92 },
  { voiceId: "shimmer", timbreClass: "high", accent: "Singaporean English", speakingRate: 1.08 },
  { voiceId: "onyx", timbreClass: "mid_low", accent: "Nigerian English", speakingRate: 1.0 },
  { voiceId: "nova", timbreClass: "mid_high", accent: "German-accented English", speakingRate: 0.9 },
] as const;

const SPEAKER_PROFILES = [
  {
    role: "research lead",
    viewpoint: "keeps the discussion anchored in observed user behaviour",
    discourseStyle: "questioning",
    habitualMove: "asks what evidence supports a claim",
    styleDirection: "curious and probing; questions sound genuinely open rather than scripted",
  },
  {
    role: "product designer",
    viewpoint: "protects clarity and the coherence of the end-to-end experience",
    discourseStyle: "associative",
    habitualMove: "builds on another speaker's idea with a concrete alternative",
    styleDirection: "engaged and conversational, with occasional self-correction",
  },
  {
    role: "delivery lead",
    viewpoint: "tests proposals against operational and technical constraints",
    discourseStyle: "direct",
    habitualMove: "names a constraint and offers a smaller experiment",
    styleDirection: "brisk but collegial, declarative without sounding like an announcer",
  },
  {
    role: "facilitator",
    viewpoint: "makes disagreement legible without forcing premature agreement",
    discourseStyle: "synthesizing",
    habitualMove: "reflects the tension between two positions and checks the group",
    styleDirection: "warm, economical, and responsive to the previous speaker",
  },
  {
    role: "service owner",
    viewpoint: "focuses on consequences for staff, policy, and edge cases",
    discourseStyle: "measured",
    habitualMove: "stays quiet, then introduces a consequential exception",
    styleDirection: "unhurried and thoughtful, slightly lower energy but fully present",
  },
  {
    role: "prototype lead",
    viewpoint: "pushes the group toward something testable without erasing uncertainty",
    discourseStyle: "pragmatic",
    habitualMove: "turns an unresolved question into a specific next test",
    styleDirection: "lively and practical, with natural emphasis on concrete actions",
  },
] as const;

const NAMES = ["Alex", "Blake", "Casey", "Drew", "Ellis", "Frankie"];

export function composeVoiceInstructions(speaker: ScenarioSpeaker): string {
  const profile = SPEAKER_PROFILES[speaker.index % SPEAKER_PROFILES.length];
  return [
    `Speak as ${speaker.role || profile.role}, a participant in a design critique meeting.`,
    `Accent: ${speaker.accent}.`,
    `Delivery: ${speaker.discourseStyle || profile.discourseStyle} — ${profile.styleDirection}.`,
    "React as though another person has just spoken. Use a conversational meeting register, not narration or presentation voice.",
    "Preserve hesitations, dashes, and short interjections naturally. Do not add, remove, or paraphrase words.",
  ].join(" ");
}
export function createDefaultCasting(
  speakerCount: number,
  generated: Array<Partial<ScenarioSpeaker>> = []
): ScenarioSpeaker[] {
  return Array.from({ length: speakerCount }, (_, index) => {
    const cast = VOICE_CASTING_POOL[index];
    const profile = SPEAKER_PROFILES[index];
    const source = generated[index] || {};
    const speaker: ScenarioSpeaker = {
      index,
      name: source.name?.trim() || NAMES[index],
      voiceId: cast.voiceId,
      timbreClass: cast.timbreClass,
      accent: source.accent?.trim() || cast.accent,
      speakingRate: cast.speakingRate,
      targetTalkShare: source.targetTalkShare,
      role: source.role?.trim() || profile.role,
      viewpoint: source.viewpoint?.trim() || profile.viewpoint,
      discourseStyle: source.discourseStyle?.trim() || profile.discourseStyle,
      habitualMove: source.habitualMove?.trim() || profile.habitualMove,
    };
    speaker.instructions = composeVoiceInstructions(speaker);
    return speaker;
  });
}
