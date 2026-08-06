import { describe, it, expect } from "vitest";
import { checkPromptGuard } from "@/lib/guard";
import type { ParticipantData } from "@/lib/types";

const participants: ParticipantData[] = [
  { id: "1", sessionId: "s1", displayName: "Alice", role: "reviewer", isHidden: false },
  { id: "2", sessionId: "s1", displayName: "Bob", role: "stakeholder", isHidden: false },
  { id: "3", sessionId: "s1", displayName: "Charlie", role: "researcher", isHidden: false },
];

const objective = "Evaluate the user onboarding flow for first-time users";

describe("checkPromptGuard", () => {
  it("allows neutral prompts", () => {
    const result = checkPromptGuard(
      "The discussion on user onboarding is reaching alignment. Consider evaluating the user flow with more evidence.",
      participants,
      objective
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks prompts containing participant names", () => {
    const result = checkPromptGuard(
      "Alice seems to be dominating the conversation.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Alice");
  });

  it("blocks prompts with blocklisted traits", () => {
    const result = checkPromptGuard(
      "One speaker appears to be aggressive in their tone.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocklisted");
  });

  it("blocks prompts with forbidden mental health terms", () => {
    const result = checkPromptGuard(
      "A participant seems to show signs of anxiety.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("forbidden");
  });

  it("blocks prompts using 'you always' patterns", () => {
    const result = checkPromptGuard(
      "You always dismiss other people's ideas.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
  });

  it("blocks prompts using 'you never' patterns", () => {
    const result = checkPromptGuard(
      "You never provide evidence for your claims.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
  });

  it("blocks 'dominant' trait", () => {
    const result = checkPromptGuard(
      "This speaker appears dominant in the discussion.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("dominant");
  });

  it("blocks 'biased' trait", () => {
    const result = checkPromptGuard(
      "The participant seems biased toward their own solution.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
  });

  it("checks prompt relates to objective", () => {
    const result = checkPromptGuard(
      "random words that have nothing to do with the session",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("objective");
  });

  it("allows prompt with multiple objective keywords", () => {
    const result = checkPromptGuard(
      "Consider evaluating the user flow and onboarding process more carefully.",
      participants,
      objective
    );
    expect(result.allowed).toBe(true);
  });

  it("is case-insensitive for names", () => {
    const result = checkPromptGuard(
      "bob should provide more context.",
      participants,
      objective
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Bob");
  });
});
