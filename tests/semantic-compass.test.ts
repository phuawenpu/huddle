import { describe, expect, it } from "vitest";
import {
  selectCompassNodes,
  selectCompassRelations,
} from "@/app/facilitator/[sessionId]/semantic-compass";
import type {
  MeetingNodeKind,
  MeetingStateNode,
  MeetingStateRelation,
} from "@/lib/types";

describe("semantic compass selection", () => {
  it("keeps stable slots and limits the live map to one grounded node per slot", () => {
    const nodes = [
      node("weak-issue", "issue", 0.99),
      node("grounded-issue", "issue", 0.7, ["turn-1"]),
      node("evidence", "evidence", 0.8),
      node("question", "question", 0.8),
      node("proposal", "proposal", 0.8),
      node("decision", "decision", 0.8),
      node("action", "action", 0.95),
    ];

    const selected = selectCompassNodes(nodes);

    expect([...selected.keys()]).toEqual([
      "issue",
      "evidence",
      "question",
      "proposal",
      "decision",
    ]);
    expect(selected.get("issue")?.id).toBe("grounded-issue");
    expect(selected.size).toBe(5);
  });

  it("shows only the five strongest relationships between visible nodes", () => {
    const visible = new Set(["a", "b", "c"]);
    const relations = [
      relation("outside", "a", "x", 20),
      ...Array.from({ length: 7 }, (_, index) =>
        relation(`r-${index}`, "a", index % 2 ? "b" : "c", index),
      ),
    ];

    expect(
      selectCompassRelations(relations, visible).map(({ id }) => id),
    ).toEqual(["r-6", "r-5", "r-4", "r-3", "r-2"]);
  });
});

function node(
  id: string,
  kind: MeetingNodeKind,
  confidence: number,
  sourceTurnIds: string[] = [],
): MeetingStateNode {
  return {
    id,
    kind,
    title: id,
    summary: id,
    status: "open",
    origin: "transcript",
    confidence,
    supportingTurnIds: sourceTurnIds,
    sourceQuotes: sourceTurnIds.map((turnId) => ({
      turnId,
      quote: "Grounded quote",
    })),
  };
}

function relation(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  strength: number,
): MeetingStateRelation {
  return {
    id,
    fromNodeId,
    toNodeId,
    type: "supports",
    supportingTurnIds: Array.from(
      { length: strength },
      (_, index) => `turn-${index}`,
    ),
    sourceQuotes: [],
  };
}
