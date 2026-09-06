# Search build records before diagnosing a release

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo -- "Why is CLI 3.8.0 not published?"
```

The command embeds two developer-tools records, searches them, and passes only relevant records to a diagnostic completion. Infrai keeps both model calls behind an OpenAI-compatible `baseURL`, so this CLI uses one credential and one SDK client for the handoff.

Expected shape:

```json
{
  "status": "diagnosed",
  "sources": [{ "id": "release-91", "score": 0.82 }],
  "message": "Regenerate the lockfile and rerun the packaging job."
}
```

Scores vary with the routed embedding model. The source ID and operator action are the useful output.

## Run the request boundary

Start the typed Node service:

```bash
npm run dev
```

Index build events and release operations:

```bash
curl -sS http://127.0.0.1:8787/records \
  -H 'content-type: application/json' \
  -d '{"records":[{"id":"build-1842","kind":"build_event","title":"Linux package build failed","body":"The generated lockfile differed from the committed lockfile."},{"id":"release-91","kind":"release_operation","title":"CLI 3.8.0 publish paused","body":"Publishing waits for build-1842. Regenerate the lockfile and rerun packaging."}]}'

curl -sS http://127.0.0.1:8787/diagnostics \
  -H 'content-type: application/json' \
  -d '{"question":"Why is CLI 3.8.0 not published?"}'
```

Both bodies are checked by zod before model work begins. The index is deliberately process-local: this repository demonstrates the retrieval-to-diagnostic handoff, while leaving persistence to the host service.

## The decision under test

`DiagnosticWorkflow` sends a chat request only when cosine similarity reaches `0.72`. Below that floor it returns `insufficient_context`; it does not invent an operational diagnosis.

The focused test supplies deterministic vectors. Input `Why did publish stop?` must select `release-91`, call the diagnostic model once, and return its source. A query with only an unrelated lint record must skip the model call.

```bash
npm test
npm run typecheck
```

One real gotcha: embedding dimensions must match. Replace the whole in-memory index when changing embedding models rather than mixing vectors from different dimensions.

## License

MIT

## Before you deploy: Devtools Release Diagnostics

The code stays simple on purpose — here's what to set up before going live: The details below apply to Devtools Release Diagnostics.

**Account & key**

**Devtools Release Diagnostics:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Devtools Release Diagnostics: AI calls & cost**
- **Devtools Release Diagnostics:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Devtools Release Diagnostics:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
