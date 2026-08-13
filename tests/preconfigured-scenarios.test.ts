import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { validateScenarioParams } from "@/lib/budget";
import {
  PRECONFIGURED_CATALOG_REVISION,
  PRECONFIGURED_SCENARIO_LIMIT,
  PRECONFIGURED_SCENARIO_PREFIX,
  PRECONFIGURED_SCENARIOS,
  seedPreconfiguredScenarios,
} from "@/lib/preconfigured-scenarios";
import {
  analyzeTranscriptQuality,
  validateTranscriptForRevision,
} from "@/lib/scenario-transcript";

describe("preconfigured scenario catalogue", () => {
  it("contains exactly ten stable, valid, reusable cases", () => {
    expect(PRECONFIGURED_SCENARIOS).toHaveLength(10);
    expect(PRECONFIGURED_SCENARIOS.length).toBeLessThanOrEqual(
      PRECONFIGURED_SCENARIO_LIMIT,
    );
    expect(new Set(PRECONFIGURED_SCENARIOS.map(({ id }) => id)).size).toBe(10);
    expect(
      new Set(PRECONFIGURED_SCENARIOS.map(({ title }) => title)).size,
    ).toBe(10);
    expect(
      new Set(
        PRECONFIGURED_SCENARIOS.map(({ durationMinutes }) => durationMinutes),
      ),
    ).toEqual(new Set([3, 4, 5]));

    for (const scenario of PRECONFIGURED_SCENARIOS) {
      expect(scenario.id.startsWith(PRECONFIGURED_SCENARIO_PREFIX)).toBe(true);
      expect(
        validateScenarioParams({
          durationMinutes: scenario.durationMinutes,
          speakerCount: scenario.speakerCount,
          crossTalkLevel: scenario.crossTalkLevel,
        }),
      ).toEqual({ valid: true, errors: [] });
      expect(scenario.speakers).toHaveLength(scenario.speakerCount);
      expect(scenario.turns.filter((turn) => turn.isCalibration)).toHaveLength(
        scenario.speakerCount,
      );
      expect(
        scenario.turns.filter((turn) => !turn.isCalibration).length,
      ).toBeGreaterThanOrEqual(14);

      const report = validateTranscriptForRevision(
        scenario.turns,
        scenario.speakers,
        {
          targetDurationMinutes: scenario.durationMinutes,
          crossTalkLevel: scenario.crossTalkLevel,
          requireTargetDurationFit: true,
        },
      );
      expect(report.errors, scenario.title).toEqual([]);
      expect(report.reactionCoverage, scenario.title).toBe(1);
      expect(
        report.plannedWordsPerMinute,
        scenario.title,
      ).toBeGreaterThanOrEqual(105);
      expect(report.plannedWordsPerMinute, scenario.title).toBeLessThanOrEqual(
        185,
      );
      expect(report.score, scenario.title).toBe(100);
    }
  });

  it("varies meeting form, domain, cast, difficulty, cross-talk, and AI signals", () => {
    expect(
      new Set(PRECONFIGURED_SCENARIOS.map(({ workshopType }) => workshopType))
        .size,
    ).toBeGreaterThanOrEqual(8);
    expect(
      new Set(PRECONFIGURED_SCENARIOS.map(({ domain }) => domain)).size,
    ).toBe(10);
    expect(
      new Set(PRECONFIGURED_SCENARIOS.map(({ speakerCount }) => speakerCount)),
    ).toEqual(new Set([4, 5]));
    expect(
      new Set(
        PRECONFIGURED_SCENARIOS.map(({ crossTalkLevel }) => crossTalkLevel),
      ),
    ).toEqual(new Set(["none", "occasional", "frequent"]));
    expect(
      new Set(PRECONFIGURED_SCENARIOS.map(({ difficulty }) => difficulty)),
    ).toEqual(new Set(["realistic", "challenging"]));

    const categories = new Set(
      PRECONFIGURED_SCENARIOS.flatMap(({ turns }) =>
        turns
          .filter((turn) => !turn.isCalibration)
          .map((turn) => turn.expectedCategory),
      ),
    );
    expect(categories).toEqual(
      new Set([
        "evidence",
        "questions",
        "positions",
        "decisions",
        "actions",
        "themes",
      ]),
    );

    const overlapKinds = new Set(
      PRECONFIGURED_SCENARIOS.flatMap(({ turns }) =>
        turns.flatMap((turn) => (turn.overlap ? [turn.overlap.kind] : [])),
      ),
    );
    expect(overlapKinds).toEqual(
      new Set(["interruption", "eager_agreement", "backchannel"]),
    );
  });

  it("seeds idempotently without repeatedly resetting transcript state", async () => {
    const stored = new Map<string, { expectedWindowOutcomeJson: string }>();
    const findUnique = vi.fn(
      async ({ where }: any) => stored.get(where.id) || null,
    );
    const create = vi.fn(async ({ data }: any) => {
      stored.set(data.id, {
        expectedWindowOutcomeJson: data.expectedWindowOutcomeJson,
      });
      return data;
    });
    const update = vi.fn().mockResolvedValue({});
    const client = {
      scenario: { findUnique, create, update },
    } as unknown as PrismaClient;

    await seedPreconfiguredScenarios(client);
    await seedPreconfiguredScenarios(client);

    expect(create).toHaveBeenCalledTimes(10);
    expect(update).toHaveBeenCalledTimes(10);
    for (const call of create.mock.calls) {
      expect(call[0].data.status).toBe("draft");
      expect(
        JSON.parse(call[0].data.expectedWindowOutcomeJson)._catalogRevision,
      ).toBe(PRECONFIGURED_CATALOG_REVISION);
    }
    for (const call of update.mock.calls) {
      expect(call[0].data.turnsJson).toBeUndefined();
    }
  });

  it("applies a newer catalog transcript once and resets stale preparation", async () => {
    const update = vi.fn().mockResolvedValue({});
    const client = {
      scenario: {
        findUnique: vi.fn().mockResolvedValue({
          expectedWindowOutcomeJson: JSON.stringify({ _catalogRevision: 1 }),
        }),
        create: vi.fn(),
        update,
      },
    } as unknown as PrismaClient;

    await seedPreconfiguredScenarios(client);

    expect(update).toHaveBeenCalledTimes(10);
    for (const call of update.mock.calls) {
      expect(call[0].data.turnsJson).toBeTruthy();
      expect(call[0].data.status).toBe("draft");
      expect(call[0].data.realizedDurationMs).toBeNull();
      expect(call[0].data.preflightJson).toBeNull();
    }
  });

  it("keeps transcript diagnostics available for every case", () => {
    const reports = PRECONFIGURED_SCENARIOS.map((scenario) =>
      analyzeTranscriptQuality(scenario.turns, scenario.speakers, {
        targetDurationMinutes: scenario.durationMinutes,
        crossTalkLevel: scenario.crossTalkLevel,
      }),
    );
    expect(reports.every(({ errors }) => errors.length === 0)).toBe(true);
    expect(
      reports.every(({ plannedWordsPerMinute }) => plannedWordsPerMinute),
    ).toBe(true);
  });
});
