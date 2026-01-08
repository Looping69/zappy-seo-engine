# Zappy Autonomous Content Factory (v2)

A powerful, multi-agent autonomous system for generating medical-grade SEO content, built on **Encore.dev** with a distributed neural architecture.

## 🧠 Sequential Agent Architecture

The system operates using a sophisticated multi-stage pipeline where specialized AI agents work **sequentially within each phase**, storing results to shared memory before batch-passing to the next phase.

```mermaid
graph LR
    A[Keyword] --> R1[SEO Research]
    R1 --> R2[Medical Research]
    R2 --> R3[Competitor Research]
    R3 --> RM[Research Memory]
    RM --> S[Synthesizer]
    S --> W1[Clinical Writer]
    W1 --> W2[Empathetic Writer]
    W2 --> W3[Practical Writer]
    W3 --> W4[Innovative Writer]
    W4 --> DM[Drafts Memory]
    DM --> J[Judge]
    J --> C1[Medical Critic]
    C1 --> C2[Editorial Critic]
    C2 --> RW[Revision Writer]
    RW --> SEO[SEO Finalizer]
    SEO --> DB[(PostgreSQL)]
```

### Phase Breakdown
| Phase | Agents | Execution |
|-------|--------|-----------|
| 1. Research | SEO, Medical, Competitor | Sequential |
| 2. Synthesis | Synthesizer | Single |
| 3. Drafting | Clinical, Empathetic, Practical, Innovative | Sequential |
| 4. Judging | Judge | Single |
| 5. Critique | Medical Critic, Editorial Critic, Revision Writer | Sequential Loop (3x) |
| 6. Finalization | SEO Finalizer | Single |

## ✨ New in v2.1
- **Sequential Execution**: Agents run one at a time within phases for stability
- **Gemini-Only Mode**: Easy toggle to use Gemini 2.5 Flash exclusively
- **Robust JSON Parsing**: Schema-enforced responses with 32K token limits
- **Retry Button**: Failed keywords show a red "Retry" button in the dashboard
- **Markdown Rendering**: Articles display with proper headings, bullets, formatting
- **Neural Circuit Visualization**: Real-time "Swarm" visualizer showing phase-based agent activation

## 🛠️ Tech Stack
- **Backend**: [Encore.dev](https://encore.dev) (TypeScript)
- **Database**: PostgreSQL (Managed by Encore)
- **AI Models**: Gemini 2.5 Flash (primary), Claude 3.7 Sonnet (standby)
- **Frontend**: Vanilla JS + Tailwind CSS + Marked.js
- **Deployment**: Encore Cloud (Backend) + Vercel (Frontend)

## 🚀 Getting Started

### 1. Prerequisites
- [Encore CLI](https://encore.dev/docs/install)
- [Gemini API Key](https://aistudio.google.com/)
- [Anthropic API Key](https://console.anthropic.com/) (optional)

### 2. Installation
```bash
git clone https://github.com/WimpyvL/zappy-seo-engine.git
cd zappy-seo-engine
npm install
```

### 3. Environment Variables
```env
GEMINI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key  # Optional
```

### 4. Running Locally
```bash
encore run
```
Dashboard: `http://localhost:4000/ui`

## 📊 Token Usage
| Phase | Typical Tokens |
|-------|---------------|
| Research | ~7k |
| Synthesis | ~6k |
| Drafting | ~40-80k |
| Judging | ~18k |
| Critique | ~8k/loop |
| Finalization | ~10k |

**Average per article: 80k - 150k tokens**

## 🔧 Configuration

### Switching AI Providers
Edit `content/utils/ai.ts`:
```typescript
const GEMINI_ONLY_MODE = true;  // false = Claude primary
```

## 🛡️ Medical Quality Standards
- **Medical Critic**: Zero dangerous claims, mandatory citations
- **Editorial Critic**: Clarity score ≥ 8/10, patient-friendly tone
- **The Judge**: Coverage completeness check

---
*Built for Zappy Health — Redefining high-fidelity medical content automation.*
