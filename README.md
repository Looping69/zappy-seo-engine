# Zappy Multi-Agent Content Engine

A true multi-agent system for generating high-quality medical SEO content.

## Architecture

```
                         ORCHESTRATOR
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  ┌───────────┐        ┌───────────┐        ┌───────────┐
  │    SEO    │        │  MEDICAL  │        │COMPETITOR │
  │ RESEARCH  │        │ RESEARCH  │        │ RESEARCH  │
  └───────────┘        └───────────┘        └───────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │  SYNTHESIZER  │
                      │ (merge intel) │
                      └───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  ┌───────────┐        ┌───────────┐        ┌───────────┐
  │  WRITER   │        │  WRITER   │        │  WRITER   │
  │ Clinical  │        │ Empathetic│        │ Practical │
  └───────────┘        └───────────┘        └───────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                        ┌───────────┐
                        │   JUDGE   │
                        │(picks best│
                        │+ combines)│
                        └───────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │      CRITIQUE LOOP       │
               │                          │
               │  ┌────────┐  ┌────────┐  │
               │  │MEDICAL │◄►│EDITORIAL│  │
               │  │REVIEWER│  │REVIEWER │  │
               │  └────────┘  └────────┘  │
               │        │          │      │
               │        ▼          ▼      │
               │     ┌────────────────┐   │
               │     │REVISION WRITER │◄──┤
               │     └────────────────┘   │
               │                          │
               │   Loop until approved    │
               │   (max 3 iterations)     │
               └──────────────────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │ SEO FINALIZER │
                      │(meta, links,  │
                      │ schema)       │
                      └───────────────┘
                              │
                              ▼
                         [ SANITY ]
```

## Why Multi-Agent?

| Sequential Pipeline | Multi-Agent System |
|---------------------|-------------------|
| One research pass | 3 parallel research agents (SEO + Medical + Competitor) |
| One draft | 3 drafts with different angles, judge picks best |
| One review | Critics debate, writer revises in loop |
| Fixed steps | Orchestrator adapts based on quality |
| ~5 min/article | ~8-10 min/article, higher quality |

## Agents

| Agent | Role | Runs In |
|-------|------|---------|
| **SEO Research** | Search intent, SERP features, keywords | Parallel |
| **Medical Research** | Facts, mechanisms, side effects, sources | Parallel |
| **Competitor Research** | Gaps, angles, differentiation | Parallel |
| **Synthesizer** | Merges research into content brief | Sequential |
| **Writer (Clinical)** | Authoritative, science-focused draft | Parallel |
| **Writer (Empathetic)** | Patient-centered, understanding draft | Parallel |
| **Writer (Practical)** | Action-oriented, how-to draft | Parallel |
| **Judge** | Picks best draft, can synthesize elements | Sequential |
| **Medical Reviewer** | Accuracy, safety, claims verification | Parallel |
| **Editorial Reviewer** | Clarity, voice, structure, engagement | Parallel |
| **Revision Writer** | Incorporates critique feedback | Loop |
| **SEO Finalizer** | Meta tags, internal links, schema | Sequential |

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
# Fill in your API keys
```

### 2. Airtable Schema

Same as before:
- **Keywords**: keyword, status, priority, etc.
- **Content**: title, body, quality_score, iterations, etc.
- **Clusters**: for topic organization

### 3. Run

```bash
# Test mode (no Airtable/Sanity, just see output)
npm run test

# Test with specific keyword
npm run test -- "semaglutide vs tirzepatide"

# Production: single keyword
npm run generate -- "ozempic side effects"

# Production: batch from Airtable
npm run generate
npm run batch  # 10 at a time
```

## Quality Thresholds

The critique loop continues until:
- **Medical Reviewer** approves (no dangerous claims)
- **Editorial Reviewer** scores >= 8/10
- OR max 3 revisions reached

Articles scoring < 7 go to manual review in Airtable.

## Cost Estimate

| Phase | Claude Calls | ~Tokens |
|-------|-------------|---------|
| Research (3 parallel) | 3 | ~6K in, ~3K out |
| Synthesis | 1 | ~4K in, ~2K out |
| Drafting (3 parallel) | 3 | ~3K in, ~12K out |
| Judge | 1-2 | ~8K in, ~2K out |
| Critique (2 parallel) | 2-6 | ~4K in, ~2K out |
| Revision | 0-3 | ~5K in, ~4K out |
| SEO | 1 | ~4K in, ~4K out |

**Total**: ~$1.50-3.00 per article (varies with revisions)

## Adding Leny

When Leny is ready, add as Agent 13:

```typescript
// In src/agents/leny.ts
export async function lenyValidationAgent(draft: ArticleDraft): Promise<LenyResult> {
  const response = await fetch(process.env.LENY_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.LENY_API_KEY}` },
    body: JSON.stringify({ content: draft.body })
  });
  return response.json();
}
```

Add to critique loop in orchestrator. Leny becomes the medical ground truth.

## Customization

### Voice
Edit `src/agents/writers.ts` - the `WRITER_BASE_SYSTEM` prompt.

### Quality Bar
Edit `src/orchestrator/index.ts`:
```typescript
maxRevisions: 3  // More iterations = higher quality, more cost
```

### Research Depth
Edit `src/agents/research.ts` prompts.
