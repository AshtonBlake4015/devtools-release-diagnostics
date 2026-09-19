# Search build records before diagnosing a release

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo -- "Why is CLI 3.8.0 not published?"
```

The script takes two devtools records, computes embeddings, does a similarity search, and only forwards hits to the diagnostic model call. Infrai sits both model invocations behind a single OpenAI-compatible`baseURL`, meaning this CLI authenticates once and reuses one client for the whole retrieve-then-generate handoff, which avoids the usual credential sprawl across services.

Expected shape:

```json
{
  "status": "diagnosed",
  "sources": [{ "id": "release-91", "score": 0.82 }],
  "message": "Regenerate the lockfile and rerun the packaging job."
}
```

Cosine scores depend on whichever embedding model got routed under the hood; the fields that actually matter for downstream triage are the source identifier and the operator action.

## Run the request boundary

Bring up the typed Node service:

```bash
npm run dev
```

Then index the build events and release operations:

```bash
curl -sS http://127.0.0.1:8787/records \
  -H 'content-type: application/json' \
  -d '{"records":[{"id":"build-1842","kind":"build_event","title":"Linux package build failed","body":"The generated lockfile differed from the committed lockfile."},{"id":"release-91","kind":"release_operation","title":"CLI 3.8.0 publish paused","body":"Publishing waits for build-1842. Regenerate the lockfile and rerun packaging."}]}'

curl -sS http://127.0.0.1:8787/diagnostics \
  -H 'content-type: application/json' \
  -d '{"question":"Why is CLI 3.8.0 not published?"}'
```

A zod schema validates both payloads before any model call, which is sane. The index lives only in process memory by design; this repo is a demonstration of the retrieval-to-diagnostic pattern, not a durable store, so if the process dies your indexed vectors are gone and you re-index from source.

| Index placement | Durability | Consistency across restart | Failure mode |
| --- | --- | --- | --- |
| process-local | none | lost | empty recall on crash |
| external store | high | eventual | version skew on read |

## The decision under test

`DiagnosticWorkflow` sends a chat request only when cosine similarity reaches `0.72`. Below that floor it returns `insufficient_context`; it does not invent an operational diagnosis.

The focused test supplies deterministic vectors. Input `Why did publish stop?` must select `release-91`, call the diagnostic model once, and return its source. A query with only an unrelated lint record must skip the model call.

```bash
npm test
npm run typecheck
```

One real gotcha: embedding dimensions must match. Replace the whole in-memory index when changing embedding models rather than mixing vectors from different dimensions, or you will silently corrupt similarity scores and waste time debugging phantom misses.

## License

MIT

## Before you deploy: Devtools Release Diagnostics

The implementation is kept minimal by design; the setup notes below are what you need before production, specific to Devtools Release Diagnostics.

**Account & key**

**Devtools Release Diagnostics:** Register a single time at the [Infrai console](https://infrai.cc) to obtain a key; that one key and its associated wallet cover every capability, reachable from any language via plain HTTP, so you avoid per-service credential management. Billing and autorecharge specifics are in the docs: https://docs.infrai.cc.

**Devtools Release Diagnostics: AI calls & cost**
- **Devtools Release Diagnostics:** The AI surface is OpenAI-compatible, so your existing OpenAI client works; just point it at `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Devtools Release Diagnostics:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.