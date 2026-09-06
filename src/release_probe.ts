import { DevtoolsIndex, type DevtoolsRecord } from "./devtools_index.js";
import { DiagnosticWorkflow } from "./diagnostic_workflow.js";
import { InfraiAi } from "./infrai_ai.js";

const records: DevtoolsRecord[] = [
  {
    id: "build-1842",
    kind: "build_event",
    title: "Linux package build failed",
    body: "The packaging job stopped after the generated lockfile differed from the committed lockfile.",
  },
  {
    id: "release-91",
    kind: "release_operation",
    title: "CLI 3.8.0 publish paused",
    body: "Publishing is paused until build-1842 passes. Regenerate and commit the lockfile, then rerun the packaging job.",
  },
];

const ai = new InfraiAi();
const index = new DevtoolsIndex(ai);
await index.replace(records);
const result = await new DiagnosticWorkflow(index, ai).run(
  process.argv.slice(2).join(" ") || "Why is CLI 3.8.0 not published?",
);
console.log(JSON.stringify(result, null, 2));
