---
title: LLM API Mastery - Anthropic, OpenAI, Amazon Bedrock, Azure OpenAI
sidebar_label: LLM API Mastery
sidebar_position: 1
---

**Prerequisites**

- Assumed: REST/HTTP, JSON, async programming in C#/.NET, OAuth/managed identity basics, cloud IAM concepts (AWS IAM, Azure Entra ID), and a working idea of what a large language model (LLM) and a token are.
- Explained here: each provider's request/response shape, tool calling, streaming, prompt caching, structured outputs, auth models, quotas, and how to build a provider-agnostic layer.

**Learning Objectives**

- Map the four main APIs (Anthropic Messages, OpenAI Chat Completions/Responses, Bedrock Converse, Azure OpenAI v1) onto one mental model.
- Implement a tool-calling loop correctly on each provider and explain where they differ.
- Design a multi-provider gateway with failover, cost control, observability, and data-residency compliance.
- Choose between native SDKs, an abstraction (for example `Microsoft.Extensions.AI`), or a gateway, with clear criteria.
- Answer architect-level interview questions on LLM integration trade-offs.

---

## 1. Quick Revision

- **One mental model:** every provider is "stateless function over a list of role-tagged content blocks → assistant content blocks + stop reason + token usage." Differences are in shape, auth, and extras.
- **Anthropic Messages** (`/v1/messages`): top-level `system`, required `max_tokens`, content blocks (`text`, `image`, `tool_use`, `tool_result`, `thinking`), explicit `cache_control` breakpoints.
- **OpenAI**: Chat Completions is still supported, but Responses is the recommended API for new work; the Assistants API is being retired. Responses uses typed _items_ and optional server-side state.
- **Bedrock Converse**: one AWS-native, model-agnostic shape (`messages`, `system`, `inferenceConfig`, `toolConfig`, `guardrailConfig`), IAM SigV4 auth, region- and model-specific quotas.
- **Azure OpenAI**: OpenAI models behind your Azure resource; you call a _deployment name_, not a model name; Entra ID auth; content filtering on by default; the v1 API lets you use the plain OpenAI client.
- **Use a provider layer** when you need failover, data residency, or cost arbitrage; **don't** when one provider meets all needs and you'd lose provider-specific features.
- **Key trade-off:** portability vs. access to provider-specific features (caching semantics, extended thinking, built-in tools, guardrails).
- **Common interview question:** "How would you make an LLM feature resilient to a provider outage without breaking tool calling or blowing up cost?"

---

## 2. Plain-Language Overview

**Analogy:** think of four international airports. Every airport gets you from A to B (send prompt, get completion), but each has its own check-in desk layout (request shape), ID rules (auth), baggage limits (token limits), security screening (content filters/guardrails), and frequent-flyer perks (prompt caching, batch discounts). A seasoned traveler doesn't relearn flying at each airport; they know the universal process and the local quirks.

**Intuition:** LLM APIs converged on a "chat of messages" shape, but the details matter enormously in production: where the system prompt goes, how tool calls are returned, how you send tool results back, how streaming events are framed, how caching is billed, and how throttling is signaled. Multi-provider fluency means you can:

- Move a workload between providers without subtle bugs.
- Pick the right provider per use case (cost, latency, model quality, compliance).
- Build a resilient abstraction that doesn't flatten away the features that make each provider worth using.

**Why it matters:** in regulated industries (banking, insurance), the provider choice is often dictated by the existing cloud contract and data-residency rules (AWS shop → Bedrock; Microsoft shop → Azure OpenAI/Foundry), while the best model for a task may come from another vendor. Engineers who can bridge that gap are in demand.

---

## 3. Definition and Key Terms

**LLM API:** an HTTP interface that accepts a prompt (structured as messages/items and content blocks) plus generation parameters and returns model output, usage metrics, and a stop reason.

| Term                             | Meaning                                                                                                                                                                                          | Commonly confused with                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **Token**                        | Sub-word unit used for limits and billing; tokenizers differ by model family                                                                                                                     | Characters or words                                                   |
| **Context window**               | Max input + output tokens per request                                                                                                                                                            | `max_tokens` (output cap only)                                        |
| **System prompt / instructions** | Developer-level guidance. Anthropic: top-level `system`. OpenAI Chat: `system`/`developer` role message. Responses: `instructions`. Bedrock: `system` field                                      | A user message                                                        |
| **Content block**                | Typed piece of a message (text, image, document, tool call, tool result, reasoning)                                                                                                              | A whole message                                                       |
| **Tool / function calling**      | Model emits a structured request to call your function; _you_ execute it and return the result                                                                                                   | The model executing code itself (that is a server-side/built-in tool) |
| **Stop/finish reason**           | Why generation ended: `end_turn`/`stop`, `max_tokens`/`length`, `tool_use`/`tool_calls`, `content_filter`, etc.                                                                                  | An error                                                              |
| **Prompt caching**               | Reuse of processed prompt prefixes for lower cost/latency. Anthropic: explicit `cache_control`. OpenAI/Azure: automatic prefix caching. Bedrock: supported for some models via cache checkpoints | Response caching (returning a stored answer)                          |
| **Structured outputs**           | Output constrained to a JSON Schema                                                                                                                                                              | "JSON mode" (valid JSON, not necessarily your schema)                 |
| **Deployment (Azure)**           | A named instance of a model in your Azure resource with its own quota                                                                                                                            | The model name                                                        |
| **Inference profile (Bedrock)**  | A model ID that routes across regions (for example a `us.` or `global.` prefix)                                                                                                                  | A plain base model ID                                                 |
| **PTU / Provisioned Throughput** | Reserved capacity billed per time unit, not per token                                                                                                                                            | Pay-as-you-go (on-demand)                                             |
| **Stateful vs stateless**        | Responses API can store conversation server-side (`previous_response_id`); Anthropic, Bedrock Converse, and Chat Completions are stateless — you resend history                                  | "Memory" features in chat apps                                        |

---

## 4. How It Works

### The universal request pipeline

```text
 Your app
   |
   | 1. Build request: system + history + new user turn + tools + params
   v
 [Provider adapter] --2. Auth (API key / Entra token / SigV4)--> [Provider endpoint]
   ^                                                              |
   |                                                              | 3. Tokenize, (cache lookup), run model
   |  6. Loop if stop_reason == tool_use                          v
   |                                                      Response: content blocks,
 [Tool executor] <--5. Extract tool calls---------------- stop_reason, usage
   |
   +--4. If text-only stop: return to caller (stream or whole)
```

### Side-by-side request shapes (simplified JSON)

**Anthropic Messages** — `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version`:

```json
{
  "model": "<claude-model-id>",
  "max_tokens": 1024,
  "system": "You are a claims assistant.",
  "tools": [
    {
      "name": "get_policy",
      "description": "...",
      "input_schema": {
        "type": "object",
        "properties": { "policyId": { "type": "string" } },
        "required": ["policyId"]
      }
    }
  ],
  "messages": [{ "role": "user", "content": "Is policy P-123 active?" }]
}
```

**OpenAI Responses** — `POST https://api.openai.com/v1/responses`, header `Authorization: Bearer`:

```json
{
  "model": "<gpt-model-id>",
  "instructions": "You are a claims assistant.",
  "tools": [
    {
      "type": "function",
      "name": "get_policy",
      "parameters": {
        "type": "object",
        "properties": { "policyId": { "type": "string" } },
        "required": ["policyId"]
      }
    }
  ],
  "input": "Is policy P-123 active?"
}
```

**OpenAI Chat Completions** — `POST /v1/chat/completions`: `messages` array with `system`/`developer`, `user`, `assistant`, `tool` roles; tools nested as `{ "type": "function", "function": { ... } }`.

**Bedrock Converse** — `bedrock-runtime` `Converse` operation, SigV4 auth:

```json
{
  "modelId": "<model-id-or-inference-profile>",
  "system": [{ "text": "You are a claims assistant." }],
  "messages": [
    { "role": "user", "content": [{ "text": "Is policy P-123 active?" }] }
  ],
  "inferenceConfig": { "maxTokens": 1024, "temperature": 0.2 },
  "toolConfig": {
    "tools": [
      {
        "toolSpec": {
          "name": "get_policy",
          "inputSchema": { "json": { "type": "object" } }
        }
      }
    ]
  }
}
```

**Azure OpenAI (v1)** — same body as OpenAI, but `base_url = https://<resource>.openai.azure.com/openai/v1/` and `model` = your **deployment name**; auth via API key or Entra ID token.

### The tool-calling round trip (where providers differ most)

| Step                        | Anthropic                                                             | OpenAI Chat                                                                                 | OpenAI Responses                                           | Bedrock Converse                                                           |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Model asks for tool         | `content[]` has `tool_use {id, name, input}`; `stop_reason: tool_use` | `message.tool_calls[] {id, function{name, arguments(string)}}`; `finish_reason: tool_calls` | `output[]` item `function_call {call_id, name, arguments}` | `content[]` has `toolUse {toolUseId, name, input}`; `stopReason: tool_use` |
| You send result             | New **user** message with `tool_result {tool_use_id, content}`        | Message with `role: tool`, `tool_call_id`                                                   | Input item `function_call_output {call_id, output}`        | New **user** message with `toolResult {toolUseId, content}`                |
| Must resend assistant turn? | Yes (full assistant content incl. `tool_use`)                         | Yes                                                                                         | Not if using `previous_response_id`; otherwise yes         | Yes                                                                        |

Note that OpenAI Chat returns `arguments` as a JSON **string** you must parse; Anthropic and Bedrock return a parsed object.

### Streaming

All four use incremental events: Anthropic uses server-sent events (SSE) such as `message_start`, `content_block_delta`, `message_delta`, `message_stop`; OpenAI Chat streams `delta` chunks; Responses streams typed events (for example output-text deltas); Bedrock `ConverseStream` emits `messageStart`, `contentBlockDelta`, `messageStop`, `metadata`. Tool-call arguments stream as partial JSON fragments you must accumulate before parsing.

---

## 5. Internal Architecture

### Request normalization inside a provider adapter

A robust adapter keeps an internal canonical model and maps outward:

```text
Canonical:  Conversation { System, Messages[ Role, Parts[ Text | Image | ToolCall | ToolResult | Reasoning ] ], Tools[], Options }

Mapping rules (examples):
- System    -> Anthropic: top-level "system"   | OpenAI Chat: first message role=developer/system
               Responses: "instructions"       | Bedrock: "system": [{text}]
- ToolResult-> Anthropic/Bedrock: user-role block | OpenAI Chat: role=tool | Responses: function_call_output item
- Reasoning -> Anthropic "thinking" blocks must be passed back unmodified in tool loops;
               OpenAI reasoning items are carried via state/encrypted content; Bedrock passes reasoningContent
```

### Statelessness and history

- Bedrock's Converse does not keep conversation history, so every earlier message has to be included in each call; the same is true for Anthropic Messages and Chat Completions.
- A key feature of the Responses API is optional server-managed conversation state, which avoids resending the full transcript each turn. Trade-off: data retention and vendor coupling.

### Prompt caching mechanics

- Anthropic: the cache covers the whole prompt prefix — tools, then system, then messages — up through the block marked with `cache_control`. Changing tool definitions (names, descriptions, parameters) invalidates the entire cache, so tool order and wording must be deterministic. TTLs of 5 minutes and 1 hour are available; cache writes cost more than base input, reads cost much less.
- OpenAI and Azure OpenAI: caching is automatic for long, repeated prefixes; you influence it only by keeping the static prefix stable and first. OpenAI reports notably better cache utilization with Responses than with Chat Completions in internal tests.
- Implication for adapters: canonical-to-wire serialization must be **byte-stable** (same key order, same tool order) or you silently lose cache hits on every provider.

### Concurrency, throttling, and quotas

- Limits are measured in requests per minute (RPM) and tokens per minute (TPM); some providers also count _input_ and _output_ tokens separately. Azure applies quotas per deployment; Bedrock per model per region (cross-region inference profiles spread load); Anthropic and OpenAI per organization tier.
- Throttle signals: HTTP 429 (all), Anthropic 529 "overloaded", Bedrock `ThrottlingException`. Honor `retry-after` (and Azure's `retry-after-ms`) headers; use exponential backoff with jitter; cap total retry time.
- In .NET, use a shared `HttpClient` via `IHttpClientFactory`, a per-provider concurrency limiter (`System.Threading.RateLimiting`), and resilience pipelines (Polly / `Microsoft.Extensions.Http.Resilience`) — but disable automatic retries on non-idempotent tool side effects.

### Auth internals

| Provider     | Mechanism                                                                       | Production recommendation                                                                       |
| ------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Anthropic    | `x-api-key` header                                                              | Key in a secrets manager; rotate; per-environment workspace keys                                |
| OpenAI       | Bearer API key; project-scoped keys                                             | Project keys per service; never ship to client apps                                             |
| Bedrock      | AWS SigV4 via IAM role; needs `bedrock:InvokeModel` (and the streaming variant) | IAM role for the workload (IRSA on EKS, task role on ECS); least privilege scoped to model ARNs |
| Azure OpenAI | API key or Entra ID bearer token                                                | Managed identity + `Cognitive Services OpenAI User` role; disable local (key) auth              |

The Azure v1 API lets the standard OpenAI client handle Entra token auth with automatic refresh, removing the need for a separate Azure-specific client.

---

## 6. Benefits / Pros

- **Resilience:** failover across providers or regions survives outages and capacity crunches — valuable when an LLM is on a customer-facing path.
- **Model fit per task:** route extraction to a cheap fast model, complex reasoning to a frontier model, regardless of vendor.
- **Compliance alignment:** keep data inside an existing cloud boundary (Bedrock in your AWS account; Azure OpenAI in your Azure tenant, with private endpoints and regional/data-zone deployments).
- **Commercial leverage:** use committed cloud spend (AWS/Azure credits, enterprise agreements) and avoid single-vendor lock-in.
- **Faster adoption of new models:** a clean adapter layer turns "try the new model" into a config change plus an eval run.
- **Unified observability:** one telemetry schema (tokens, latency, cost, stop reasons) across vendors enables real comparisons.

These benefits hold when the abstraction is thin, evals exist per provider, and teams accept that some features are provider-specific.

---

## 7. Trade-offs

- **Lowest-common-denominator risk:** a too-generic interface hides caching controls, extended reasoning, citations, built-in tools, and guardrails. Mitigate with an "escape hatch" for provider-specific options.
- **Behavioral non-portability:** the same prompt gives different quality, verbosity, refusal patterns, and tool-calling reliability across models. Failover without per-model prompts and evals can degrade silently.
- **Cost unpredictability:** different tokenizers mean the same text costs different token counts; caching discounts and batch pricing differ; failover to a pricier model can spike spend.
- **Security:** API keys leaking, prompt injection via tool results, data sent to an unintended region during failover, logging of PII in prompts.
- **Data governance:** retention and abuse-monitoring policies differ by provider and contract; server-side state (Responses `store`) creates a new data store you must govern.
- **Observability gaps:** streaming makes latency metrics subtle (time-to-first-token vs total); token usage arrives at the end of a stream.
- **Operational load:** quotas per region/deployment, model version retirements, API version changes (Azure's dated `api-version` historically; OpenAI Assistants retirement) all require lifecycle management.
- **Reliability failure modes:** throttling storms (all instances retry together), partial streams, tool loops that never terminate, truncated JSON at `max_tokens`.

For architecture, the decisive concerns are usually data residency/compliance, failure isolation, and cost governance — not raw API syntax.

---

## 8. When to Use It

Multi-provider fluency and a provider-abstraction layer fit when:

- The LLM sits on a critical path with an availability target (for example 99.9%) that one provider/region can't guarantee.
- Different business units are on different clouds (an AWS-hosted policy admin system and an Azure-hosted claims portal).
- You need the best model for several distinct tasks and those come from different vendors.
- Regulators or customers require data to stay in a specific cloud/region, but you still want to experiment elsewhere for non-sensitive workloads.
- You run a platform team providing "LLM as a service" to many internal app teams (central gateway, quotas, chargeback, audit).

---

## 9. When Not to Use It

- A single-team prototype or internal tool where one provider is fine — abstraction adds cost with no payoff.
- Workloads depending heavily on one provider's unique features (server-side state and built-in tools in Responses, Anthropic's explicit caching and extended thinking, Bedrock Agents/Knowledge Bases) — a generic layer gets in the way.
- When you lack evals: failover to an unvalidated model is worse than a graceful "temporarily unavailable."
- When contract or compliance only approves one provider — multi-provider code paths become dead, untested risk.
- Simpler alternative: one provider plus multi-region (Bedrock cross-region inference, Azure global/data-zone deployments) often gives most of the resilience benefit with none of the portability cost.

---

## 10. Alternatives and Comparison

### Integration approaches

| Approach                    | Example                                                                         | Pros                                                              | Cons                                                            | Choose when                                   |
| --------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| Native SDK per provider     | Anthropic SDK, OpenAI SDK, AWS SDK, OpenAI client against Azure v1              | Full features, first-day support                                  | N codepaths                                                     | One or two providers, feature-heavy use       |
| In-process abstraction      | `Microsoft.Extensions.AI` (`IChatClient`), Semantic Kernel, LangChain           | One interface, middleware (logging, caching, function invocation) | Some features need escape hatches                               | .NET services wanting portability + DI        |
| Cloud aggregator            | Bedrock (many vendors), Azure AI Foundry (many vendors)                         | One auth/billing/governance model                                 | Feature lag vs vendor-direct APIs; regional availability varies | Enterprise already standardized on that cloud |
| Central LLM gateway         | Self-built gateway, API Management AI policies, open-source/commercial gateways | Central quotas, keys, audit, routing, chargeback                  | Extra hop and a new critical service                            | Many teams, governance needs                  |
| OpenAI-compatible endpoints | Many vendors expose `/chat/completions` shape                                   | Swap via base URL                                                 | "Compatible" is partial; tools/streaming edge cases differ      | Quick experimentation                         |

### Provider comparison (at a glance)

| Dimension     | Anthropic API              | OpenAI API                             | Amazon Bedrock                                                   | Azure OpenAI                                       |
| ------------- | -------------------------- | -------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| Primary API   | Messages                   | Responses (Chat Completions supported) | Converse / ConverseStream (InvokeModel for native bodies)        | OpenAI v1-compatible (Responses, Chat Completions) |
| Models        | Claude                     | GPT / reasoning models                 | Many vendors (Anthropic, Amazon Nova, Meta, Mistral, and others) | OpenAI models, plus other Foundry models           |
| Auth          | API key                    | API key                                | IAM SigV4                                                        | API key or Entra ID                                |
| State         | Stateless                  | Optional server-side                   | Stateless                                                        | Optional (Responses)                               |
| Caching       | Explicit breakpoints       | Automatic                              | Model-dependent checkpoints                                      | Automatic                                          |
| Safety layer  | Model-level + usage policy | Moderation endpoint/model-level        | Bedrock Guardrails (`guardrailConfig`)                           | Content filters on by default                      |
| Capacity      | Tiered rate limits         | Tiered rate limits                     | On-demand, cross-region profiles, provisioned throughput         | Standard, global/data-zone, PTU                    |
| Data boundary | Vendor-hosted              | Vendor-hosted                          | Your AWS account/region                                          | Your Azure tenant/region                           |

---

## 11. Common Misconceptions and Gotchas

- **"Claude on Bedrock = Anthropic API."** Same model family, different API surface, auth, model IDs, feature availability, and quotas. Newer Anthropic features may land on the direct API first.
- **"Azure model name = deployment name."** You call the deployment; renaming or redeploying breaks configs. Keep a config map from logical model → deployment.
- **Forgetting `max_tokens` on Anthropic** — it's required; and on every provider, hitting the cap mid-JSON gives truncated, unparseable output. Check the stop reason before parsing.
- **Tool arguments as string vs object:** OpenAI returns a JSON string; Anthropic/Bedrock return objects. Validate against your schema anyway — models can emit invalid arguments.
- **Dropping the assistant `tool_use` turn** before sending `tool_result` → 400 errors on Anthropic/Bedrock. Every tool result must reference an ID present in the prior assistant turn.
- **Dropping thinking/reasoning blocks** in a tool loop with extended reasoning enabled → errors or degraded reasoning; pass them back unchanged.
- **Assuming JSON mode = schema compliance.** Use strict structured outputs where supported, or forced tool use with an input schema, and still validate.
- **Breaking caches unknowingly:** timestamps or request IDs at the top of the system prompt, non-deterministic tool ordering, or reordered JSON keys.
- **Retrying blindly:** retrying after a tool with side effects (payments, claim status updates) can duplicate actions. Make tools idempotent (idempotency keys).
- **Azure content filter surprises:** a `content_filter` finish reason or a 400 on the prompt is not a bug in your code; handle it as a business outcome. Medical/claims text can trigger filters — tune filter configuration where your agreement allows.
- **Token counts aren't portable:** budget per provider, using each provider's usage fields (or token-count endpoints) rather than one tokenizer.
- **Streaming usage:** final token usage often arrives only in the last event (OpenAI Chat needs an explicit option to include it).

---

## 12. Real-World Examples

### Insurance: claims first notice of loss (FNOL) triage

- **Problem:** adjusters spend time reading free-text loss descriptions, photos, and police reports to route claims and flag potential fraud.
- **Application:** an Azure-hosted claims platform uses Azure OpenAI (private endpoint, managed identity, data-zone deployment) for summarization and structured extraction (loss type, date, parties, injuries) via strict JSON schema output. A tool call fetches policy coverage from the policy admin system. Content-filter outcomes are routed to human review rather than failing. A secondary deployment in another region handles 429s; a different vendor model is only used for non-PII redacted test traffic until evals approve it.

### Banking: KYC and commercial loan document intake

- **Problem:** onboarding requires extracting entities from incorporation documents, financial statements, and IDs, at high volume with audit requirements.
- **Application:** an AWS-centric bank uses Bedrock Converse so everything stays inside its AWS account with IAM controls and CloudTrail audit. Bedrock Guardrails mask PII in outputs. A cheaper model handles classification; a stronger model handles complex financial-statement reasoning. Batch inference processes overnight backlogs at a discount. Swapping models is a config change because Converse keeps one request shape across vendors.

---

## 13. Practical Example

**Scenario:** a .NET claims service needs one `IChatClient` that targets Azure OpenAI by default and fails over to Claude via Bedrock, plus a raw Anthropic call to show the wire shape. _Illustrative only — package versions, method names, and model IDs change; review against current SDK docs before production use._

### 13.1 Composition with Microsoft.Extensions.AI

`IChatClient` is the .NET abstraction for chat-capable AI services, and `FunctionInvokingChatClient` wraps another client to invoke tools automatically.

```csharp
// Illustrative. Packages: Microsoft.Extensions.AI, Microsoft.Extensions.AI.OpenAI,
// OpenAI, Azure.Identity, AWSSDK.BedrockRuntime (plus an IChatClient adapter for Bedrock or the custom one below)
using System.ClientModel.Primitives;
using Azure.Identity;
using Microsoft.Extensions.AI;
using OpenAI;

var credential = new DefaultAzureCredential();

// Azure OpenAI v1: plain OpenAI client, base URL ends with /openai/v1/
var azureOpenAi = new OpenAIClient(
    new BearerTokenPolicy(credential, "https://cognitiveservices.azure.com/.default"),
    new OpenAIClientOptions { Endpoint = new Uri("https://my-resource.openai.azure.com/openai/v1/") });

IChatClient primary = azureOpenAi
    .GetChatClient("claims-gpt-deployment")   // deployment name, not model name
    .AsIChatClient();

IChatClient secondary = new BedrockConverseChatClient(   // custom adapter, see 13.2
    new Amazon.BedrockRuntime.AmazonBedrockRuntimeClient(Amazon.RegionEndpoint.USEast1),
    modelId: "us.anthropic.<claude-model-id>");          // cross-region inference profile

IChatClient client = new ChatClientBuilder(new FailoverChatClient(primary, secondary))
    .UseFunctionInvocation()      // runs the tool loop
    .UseOpenTelemetry()           // spans + token metrics
    .Build();

var tools = new ChatOptions
{
    MaxOutputTokens = 800,
    Tools = [AIFunctionFactory.Create(
        (string policyId) => PolicyLookup.GetStatus(policyId),
        "get_policy_status", "Returns coverage status for a policy id")]
};

var reply = await client.GetResponseAsync(
    [new(ChatRole.System, "You are a claims triage assistant. Never invent coverage."),
     new(ChatRole.User, "Customer says policy P-123 covers hail damage. Verify.")],
    tools);

Console.WriteLine(reply.Text);
```

### 13.2 Failover and a Bedrock Converse adapter (core mapping only)

```csharp
// Illustrative failover: only fail over on throttling/availability, never on 4xx validation errors.
public sealed class FailoverChatClient(IChatClient primary, IChatClient secondary) : DelegatingChatClient(primary)
{
    public override async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken ct = default)
    {
        try { return await base.GetResponseAsync(messages, options, ct); }
        catch (Exception ex) when (IsTransient(ex))
        {
            // Log provider, reason, and that failover occurred (for cost + quality dashboards)
            return await secondary.GetResponseAsync(messages, options, ct);
        }
    }

    private static bool IsTransient(Exception ex) =>
        ex is System.ClientModel.ClientResultException { Status: 429 or 500 or 502 or 503 or 529 }
        || ex is TaskCanceledException;
}

// Illustrative Converse mapping (text only; tool mapping omitted for brevity).
public sealed class BedrockConverseChatClient(
    Amazon.BedrockRuntime.IAmazonBedrockRuntime bedrock, string modelId) : IChatClient
{
    public async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken ct = default)
    {
        var req = new Amazon.BedrockRuntime.Model.ConverseRequest
        {
            ModelId = modelId,
            System = messages.Where(m => m.Role == ChatRole.System)
                .Select(m => new Amazon.BedrockRuntime.Model.SystemContentBlock { Text = m.Text }).ToList(),
            Messages = messages.Where(m => m.Role != ChatRole.System).Select(m =>
                new Amazon.BedrockRuntime.Model.Message
                {
                    Role = m.Role == ChatRole.Assistant
                        ? Amazon.BedrockRuntime.ConversationRole.Assistant
                        : Amazon.BedrockRuntime.ConversationRole.User,
                    Content = [new Amazon.BedrockRuntime.Model.ContentBlock { Text = m.Text }]
                }).ToList(),
            InferenceConfig = new Amazon.BedrockRuntime.Model.InferenceConfiguration
            { MaxTokens = options?.MaxOutputTokens ?? 1024 }
        };

        var res = await bedrock.ConverseAsync(req, ct);
        var text = string.Concat(res.Output.Message.Content.Select(c => c.Text));
        return new ChatResponse(new ChatMessage(ChatRole.Assistant, text))
        {
            Usage = new UsageDetails { InputTokenCount = res.Usage.InputTokens, OutputTokenCount = res.Usage.OutputTokens },
            FinishReason = res.StopReason == "max_tokens" ? ChatFinishReason.Length : ChatFinishReason.Stop
        };
    }

    public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken ct = default)
        => throw new NotImplementedException("Map ConverseStream events here");

    public object? GetService(Type serviceType, object? serviceKey = null) => null;
    public void Dispose() { }
}
```

### 13.3 Raw Anthropic call with prompt caching (wire shape)

```csharp
// Illustrative raw HTTP to show the Messages shape and an explicit cache breakpoint.
using var http = new HttpClient { BaseAddress = new Uri("https://api.anthropic.com/") };
http.DefaultRequestHeaders.Add("x-api-key", Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"));
http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

var body = new
{
    model = "<claude-model-id>",
    max_tokens = 800,
    system = new object[]
    {
        new { type = "text", text = LongClaimsPlaybook,             // large, static -> cache it
              cache_control = new { type = "ephemeral" } }
    },
    messages = new[] { new { role = "user", content = "Summarize claim C-889 for the adjuster." } }
};

var res = await http.PostAsJsonAsync("v1/messages", body);
res.EnsureSuccessStatusCode();
var json = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
// Check json.stop_reason and json.usage (cache_creation_input_tokens / cache_read_input_tokens)
```

---

## 14. Hands-on Exercise and Troubleshooting

**Exercise:** build a console app with one canonical `ToolLoop` that answers "What's the deductible on policy P-123?" using a fake `get_policy` tool, against at least two providers (for example OpenAI or Azure OpenAI, and Anthropic or Bedrock).

1. Implement the tool loop manually first (no `UseFunctionInvocation`) so you see each provider's tool-call and tool-result shape.
2. Log per call: provider, model/deployment, latency, time-to-first-token (streaming), input/output/cached tokens, stop reason.
3. Add a stable 2,000+ token system prompt and confirm caching: Anthropic via `cache_control` and `cache_read_input_tokens`; OpenAI/Azure via the cached-tokens usage field on the second call.
4. Force a 429 (tiny Azure quota or a load loop) and verify backoff and failover.

**Expected outcome:** identical final answers (within wording), a table comparing tokens/latency/cost per provider, cache hits on repeated calls, and failover recorded in logs.

**Failure symptom 1:** Anthropic or Bedrock returns 400 mentioning a tool result without a matching tool use.
_Diagnose:_ you didn't append the assistant message containing the `tool_use`/`toolUse` block before the user message with `tool_result`/`toolResult`, or the IDs don't match. Dump the exact messages array and check ordering and IDs.

**Failure symptom 2:** cache tokens are always zero.
_Diagnose:_ prompt below the minimum cacheable length; something dynamic (timestamp, GUID) precedes the breakpoint; tools serialized in a different order each call; or calls are more than the TTL apart. Hash the serialized prefix per request and compare.

---

## 15. Architect's Perspective

**Questions to ask first**

- What data classification goes into prompts (PII, PHI, claims, card data)? Which providers/regions are contractually approved?
- What are the availability and latency SLOs? Is degraded mode ("try again later" or rules-based fallback) acceptable?
- Which features are must-haves (tool calling, structured output, vision, long context, reasoning, caching, batch)?
- What's the cost envelope per transaction, and who pays (chargeback per team)?
- How will we evaluate quality per model before enabling it as a fallback?

**Non-functional requirements**

- **Security:** managed identity / IAM roles, no static keys where avoidable, private networking, prompt-injection defenses on tool outputs, output validation before side effects.
- **Compliance/audit:** log prompts and outputs with redaction, retention aligned to records policy, model/version recorded per decision.
- **Reliability:** per-provider circuit breakers, bulkheads, honoring retry-after, idempotent tools, max tool-loop iterations.
- **Observability:** OpenTelemetry GenAI semantic conventions; dashboards for TTFT, tokens, cache hit rate, cost, stop reasons, filter hits.
- **Cost:** model routing by task, caching, batch for offline work, token budgets per request, alerting on spend anomalies.
- **Lifecycle:** model retirement calendar, config-driven model IDs, eval suite gating every model change.

**Where it fits**

```text
 Apps/agents --> [LLM gateway or IChatClient pipeline]
                    | auth, quotas, redaction, routing, caching, telemetry, evals hooks
                    +--> Azure OpenAI (primary for Azure workloads)
                    +--> Bedrock (AWS workloads, multi-vendor models)
                    +--> Anthropic / OpenAI direct (new features, non-sensitive or approved data)
 Tools/data <--- MCP servers / internal APIs (idempotent, authorized per user)
```

---

## 16. Interview Answer — 2-Minute Version

"I treat every LLM provider as the same core contract: a stateless call over role-tagged content blocks that returns content blocks, a stop reason, and token usage. The differences are in shape and operations. Anthropic's Messages API puts the system prompt top-level, requires max_tokens, and uses explicit cache breakpoints. OpenAI now recommends the Responses API, which uses typed items and can hold conversation state server-side. Bedrock's Converse gives one AWS-native shape across many vendors with IAM auth and Guardrails, and Azure OpenAI exposes OpenAI models through deployments in our tenant with Entra ID, content filters, and now an OpenAI-compatible v1 endpoint.

In production I put a thin abstraction in front — in .NET that's usually `IChatClient` from Microsoft.Extensions.AI — with middleware for telemetry, function invocation, and failover, plus escape hatches for provider-specific features like caching or reasoning. Failover only triggers on throttling or availability errors, never on validation errors, and only to models that have passed our eval suite for that task. Tools are idempotent and validated, tool loops are bounded, and every call logs model, tokens, cache hits, latency, and cost.

Provider choice is driven by data residency and contract first, then model fit and cost. In a regulated insurer or bank, that often means Azure OpenAI or Bedrock inside our cloud boundary, with direct vendor APIs reserved for approved, lower-sensitivity workloads."

---

## 17. Interview Follow-ups

**Q: Why not just use an OpenAI-compatible endpoint everywhere?**
A: Compatibility is partial: tool-calling edge cases, streaming events, caching, reasoning content, and safety signals differ. It's good for experiments; for production you want native features or a well-tested adapter.

**Q: How do you prevent failover from causing quality regressions?**
A: Per-task eval suites (golden sets, rubric or model-graded checks), per-model prompt variants, and a routing table that only lists models that passed. Monitor post-failover quality signals and alert on failover rate.

**Q: How do you handle a tool with side effects if the model call retries?**
A: Retries happen at the HTTP layer before tools run; tool execution uses idempotency keys and checks state. Writes require explicit confirmation or a human-in-the-loop for high-risk actions.

**Q: How do you reduce cost by 50% without changing quality?**
A: Prompt caching for static prefixes, smaller models for classification/extraction with escalation, batch APIs for offline work, trimming history (summarize older turns), and output caps. Measure with per-request cost telemetry.

**Q: Stateful Responses API or stateless — which would you choose in a bank?**
A: Default to stateless (or `store` disabled) so conversation data stays in our governed stores, unless the retention terms and data residency of server-side state are approved. Stateless is also more portable.

**Q: How do you get reliable JSON?**
A: Strict structured outputs (JSON Schema) where supported, or forced tool use with an input schema; check the stop reason for truncation; validate with a schema validator; retry once with the validation error as feedback.

**Q: How do you secure against prompt injection through tool results or documents?**
A: Treat retrieved content as data: delimit it, never grant tools based on content instructions, scope tools to the end user's authorization, validate outputs before actions, and use guardrails/content filters as defense in depth.

---

## 18. Knowledge Check

1. Explain why an Anthropic tool loop fails with a 400 error after you send a `tool_result`, and how Bedrock and OpenAI Responses differ in the same step.
2. Your Azure OpenAI deployment in one region returns sustained 429s during month-end claims spikes. List three options in order of preference and the trade-off of each.
3. A team wants all prompts to go through a generic `Complete(string prompt)` method across all providers. What's wrong with that design, and what would you propose?

### Answers

1. The assistant turn containing the matching `tool_use` block (same ID) must precede the user message containing `tool_result`; if it's missing or IDs mismatch, the request is invalid. Bedrock uses the same pattern with `toolUse`/`toolResult` blocks. OpenAI Responses uses `function_call` and `function_call_output` items keyed by `call_id`, and with `previous_response_id` you don't need to resend the prior call yourself.
2. (a) Increase quota or move to a global/data-zone deployment or PTU — keeps the same model and behavior, but costs more or needs compliance sign-off for data zones. (b) Add a second deployment in an approved region with load balancing — same model, more ops. (c) Fail over to another provider/model — most resilient, but needs evals, data approval, and per-model prompts. Also smooth demand: queue non-interactive work and use batch.
3. A string-in/string-out interface drops system prompts, multi-turn history, tool calling, structured outputs, multimodal input, usage/cost data, and stop reasons, so callers can't detect truncation or filtering. Propose a canonical message/content-block model (or `IChatClient`) with options, usage, and finish reasons, plus middleware and per-provider escape hatches.

---

## 19. Summary

- All four APIs share one core model — messages of content blocks in, content blocks plus stop reason and usage out — and the production differences live in auth, tool-call shape, caching, state, safety, and quotas.
- Provider choice in regulated industries is driven by data boundary and contract first, then model fit, latency, and cost.
- A thin abstraction (such as `IChatClient`) with middleware and escape hatches beats both raw duplication and lowest-common-denominator wrappers.
- Failover is only safe with evals, idempotent tools, bounded loops, and failover only on transient errors.
- Byte-stable prompts, caching, model routing, and telemetry are the main levers for cost and reliability.

---

## 20. Sources

- Migrate to the Responses API — OpenAI: https://developers.openai.com/api/docs/guides/migrate-to-responses
- OpenAI API: Responses vs. Chat Completions — Simon Willison's Weblog: https://simonwillison.net/b/8558
- From OpenAI's Chat Completions and Assistants API to the Responses API: A Complete Migration Guide — Syntackle: https://syntackle.com/blog/openai-assistants-to-responses-api/
- Using the Converse API — Amazon Bedrock User Guide: https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html
- Use Converse — AWS SDK for Python guide: https://docs.aws.amazon.com/sdk-for-python/v1/guide/bedrock-converse.md
- Azure OpenAI API version lifecycle (v1 API) — Microsoft Learn: https://learn.microsoft.com/azure/ai-foundry/openai/api-version-lifecycle
- Prompt caching — Anthropic documentation: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Use the IChatClient interface — Microsoft Learn: https://learn.microsoft.com/dotnet/ai/ichatclient

---
