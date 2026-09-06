import type { AiPort } from "./infrai_ai.js";

export type DevtoolsRecord = {
  id: string;
  kind: "build_event" | "release_operation";
  title: string;
  body: string;
};

type IndexedRecord = DevtoolsRecord & { embedding: number[] };

export type SearchHit = DevtoolsRecord & { score: number };

function cosine(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

function searchable(record: DevtoolsRecord): string {
  return `${record.kind}\n${record.title}\n${record.body}`;
}

export class DevtoolsIndex {
  private records: IndexedRecord[] = [];
  private readonly ai: AiPort;

  constructor(ai: AiPort) {
    this.ai = ai;
  }

  async replace(records: DevtoolsRecord[]): Promise<number> {
    const embeddings = await this.ai.embed(records.map(searchable));
    if (embeddings.length !== records.length) {
      throw new Error("Embedding count does not match record count");
    }
    this.records = records.map((record, index) => ({
      ...record,
      embedding: embeddings[index] ?? [],
    }));
    return this.records.length;
  }

  async search(query: string, limit = 3): Promise<SearchHit[]> {
    if (this.records.length === 0) return [];
    const [queryEmbedding] = await this.ai.embed([query]);
    if (!queryEmbedding) throw new Error("Query embedding is missing");
    return this.records
      .map(({ embedding, ...record }) => ({ ...record, score: cosine(queryEmbedding, embedding) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}
