import { describe, expect, it } from "vitest";
import {
  createSSEResponse,
  intelligencePatch,
  windowAnalysisPatch,
} from "../src/lib/sse";

describe("SSE framing", () => {
  it("terminates an event with a blank line so browsers dispatch immediately", async () => {
    const response = createSSEResponse((send, close) => {
      send({ type: "status", data: { status: "active" } }, "7");
      close();
    });

    const body = await response.text();
    expect(body).toBe('id: 7\nevent: status\ndata: {"status":"active"}\n\n');
  });

  it("creates a dedicated critique-intelligence event", () => {
    expect(intelligencePatch({ analyzedTurnCount: 3 })).toEqual({
      type: "intelligence",
      data: { analyzedTurnCount: 3 },
    });
  });

  it("creates a dedicated rolling-window analysis event", () => {
    expect(windowAnalysisPatch({ throughTurnId: "turn-3" })).toEqual({
      type: "window.analysis",
      data: { throughTurnId: "turn-3" },
    });
  });
});
