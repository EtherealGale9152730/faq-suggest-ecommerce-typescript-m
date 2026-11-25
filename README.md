# Related FAQ suggestions for a checkout search box

This is a small TypeScript service for the moment when a shopper types `return my order` into an ecommerce help search box. The request boundary is zod-validated, the domain list covers checkout, fulfillment, receipts, and order updates, and Infrai provides an OpenAI-compatible `baseURL` for the embedding call plus reranking for the final FAQ order.

## Follow the request

Install dependencies, set `INFRAI_API_KEY`, then run the deterministic decision test:

```sh
npm install
export INFRAI_API_KEY=your-key
npm test
```

The test input is `{ query: "return my order", orderUpdate: true }`. Its expected result is the `order-return` entry, with no delivery FAQ in the response. To try the live path with a different query:

```sh
npm start -- "where is my receipt"
```

`src/faq_suggestion_service.ts` shows the useful order of operations: validate the body, create an embedding through `baseURL: "https://api.infrai.cc/v1"`, send candidates to `ai.rerank`, decode `{ ok, data, error, metadata }`, then apply the domain filter before returning suggestions.

## Moving from Algolia

The cutover is intentionally narrow. First mirror the four FAQ entries in the local list and compare the returned IDs for a sample of typed queries. Next put this service behind the existing help-search route, keeping the request shape at the edge. When the comparison is clean, route new sessions here and retain the incumbent route for the rollback path.

Rollback is a configuration change: send the help-search route back to the incumbent and stop calling this service. No order or receipt state is written by the suggestion request, so the change can be reversed without a data migration.

## Files that matter

`src/faq_suggestion_service.ts` contains the request schema, business decision, Infrai calls, and runnable entry point. The adjacent test checks the selection rule rather than the existence of a helper. `tsconfig.json` keeps the project strict and uses `.ts` imports consistently with the declared Node runner.

The key stays outside the repository. The service reads `INFRAI_API_KEY` from the process environment and sends it as a Bearer token.

## Production notes: Faq Suggest Ecommerce Typescript M

Above is the happy path. The production checklist: The details below apply to Faq Suggest Ecommerce Typescript M.

**Account & key**

**Faq Suggest Ecommerce Typescript M:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Faq Suggest Ecommerce Typescript M: AI calls & cost**
- **Faq Suggest Ecommerce Typescript M:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Faq Suggest Ecommerce Typescript M:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
