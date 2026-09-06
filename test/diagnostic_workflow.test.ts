import assert from "node:assert/strict";
import test from "node:test";
import { DevtoolsIndex } from "../src/devtools_index.js";
import { DiagnosticWorkflow } from "../src/diagnostic_workflow.js";
import type { AiPort } from "../src/infrai_ai.js";

class FixedAi implements AiPort {
  diagnoseCalls = 0;

  async embed(input: string[]): Promise<number[][]> {
    return input.map((text) => text.includes("release") || text.includes("publish") ? [1, 0] : [0, 1]);
  }

  async diagnose(): Promise<string> {
    this.diagnoseCalls += 1;
    return "Regenerate the lockfile and rerun the packaging job.";
  }
}

test("diagnoses a blocked release and cites the matching operation", async () => {
  const ai = new FixedAi();
  const index = new DevtoolsIndex(ai);
  await index.replace([
    { id: "release-91", kind: "release_operation", title: "publish paused", body: "release waits for packaging" },
    { id: "build-12", kind: "build_event", title: "lint passed", body: "formatter completed" },
  ]);

  const result = await new DiagnosticWorkflow(index, ai).run("Why did publish stop?");

  assert.equal(result.status, "diagnosed");
  assert.deepEqual(result.sources, [{ id: "release-91", score: 1 }]);
  assert.equal(ai.diagnoseCalls, 1);
});

test("does not call chat when no record clears the relevance floor", async () => {
  const ai = new FixedAi();
  const index = new DevtoolsIndex(ai);
  await index.replace([
    { id: "build-12", kind: "build_event", title: "lint passed", body: "formatter completed" },
  ]);

  const result = await new DiagnosticWorkflow(index, ai).run("Why did publish stop?");

  assert.equal(result.status, "insufficient_context");
  assert.equal(ai.diagnoseCalls, 0);
});
