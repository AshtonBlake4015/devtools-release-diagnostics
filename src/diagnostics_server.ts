import { createServer } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { DevtoolsIndex } from "./devtools_index.js";
import { DiagnosticWorkflow } from "./diagnostic_workflow.js";
import { InfraiAi } from "./infrai_ai.js";

const recordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["build_event", "release_operation"]),
  title: z.string().min(1),
  body: z.string().min(1),
});
const indexSchema = z.object({ records: z.array(recordSchema).min(1) });
const diagnoseSchema = z.object({ question: z.string().min(3) });

const ai = new InfraiAi();
const index = new DevtoolsIndex(ai);
const workflow = new DiagnosticWorkflow(index, ai);

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/records") {
      const body = indexSchema.parse(await readJson(request));
      return send(response, 200, { indexed: await index.replace(body.records) });
    }
    if (request.method === "POST" && request.url === "/diagnostics") {
      const body = diagnoseSchema.parse(await readJson(request));
      const result = await workflow.run(body.question);
      return send(response, result.status === "diagnosed" ? 200 : 422, result);
    }
    return send(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return send(response, 400, { error: "invalid_request", issues: error.issues });
    }
    const status = error instanceof OpenAI.APIError && error.status && error.status < 500
      ? error.status
      : 502;
    return send(response, status, { error: "upstream_request_failed" });
  }
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

server.listen(Number(process.env.PORT ?? 8787), "127.0.0.1", () => {
  console.log("diagnostics service listening on http://127.0.0.1:8787");
});
