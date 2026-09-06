import type { AiPort } from "./infrai_ai.js";
import { DevtoolsIndex, type SearchHit } from "./devtools_index.js";

export type DiagnosticResult =
  | { status: "insufficient_context"; sources: []; message: string }
  | { status: "diagnosed"; sources: Array<{ id: string; score: number }>; message: string };

export class DiagnosticWorkflow {
  private readonly index: DevtoolsIndex;
  private readonly ai: AiPort;
  private readonly relevanceFloor: number;

  constructor(index: DevtoolsIndex, ai: AiPort, relevanceFloor = 0.72) {
    this.index = index;
    this.ai = ai;
    this.relevanceFloor = relevanceFloor;
  }

  async run(question: string): Promise<DiagnosticResult> {
    const hits = await this.index.search(question);
    const relevant = hits.filter((hit) => hit.score >= this.relevanceFloor);
    if (relevant.length === 0) {
      return {
        status: "insufficient_context",
        sources: [],
        message: "No indexed build or release record is relevant enough to diagnose this request.",
      };
    }

    const message = await this.ai.diagnose(question, formatContext(relevant));
    return {
      status: "diagnosed",
      sources: relevant.map(({ id, score }) => ({ id, score })),
      message,
    };
  }
}

function formatContext(hits: SearchHit[]): string {
  return hits
    .map((hit) => `[${hit.id}] ${hit.kind}: ${hit.title}\n${hit.body}`)
    .join("\n\n");
}
