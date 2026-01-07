import { parallel } from "./utils/claude.js";
import { seoResearchAgent, medicalResearchAgent, competitorResearchAgent } from "./agents/research.js";
import { synthesizerAgent } from "./agents/synthesizer.js";
import { writeClinical, writeEmpathetic, writePractical, writeGemini, revisionWriter } from "./agents/writers.js";
import { judgeAgent } from "./agents/judge.js";
import { runCritique } from "./agents/critics.js";
import { seoFinalizerAgent } from "./agents/seo.js";
import type { Keyword, PipelineState, FinalArticle } from "./types.js";

// ============================================================================
// ORCHESTRATOR - Coordinates all agents
// ============================================================================

type DebugLogFn = (level: string, source: string, message: string, metadata?: any) => Promise<void>;

export class ContentOrchestrator {
  private state: PipelineState;
  private verbose: boolean;
  private totalTokens: number = 0;
  private debugLog: DebugLogFn | null = null;

  constructor(keyword: Keyword, options: { verbose?: boolean; maxRevisions?: number; debugLog?: DebugLogFn } = {}) {
    this.verbose = options.verbose ?? true;
    this.debugLog = options.debugLog ?? null;
    this.state = {
      keyword,
      status: "researching",
      revisionCount: 0,
      maxRevisions: options.maxRevisions ?? 3,
      startedAt: new Date(),
      errors: [],
      log: []
    };
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[ORCHESTRATOR] Starting pipeline for keyword: "${keyword.keyword}"`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private async log(message: string, emoji = "•", level = "INFO", source = "pipeline") {
    const entry = `${emoji} ${message}`;
    this.state.log.push(entry);
    if (this.verbose) {
      console.log(`  [PIPELINE] ${entry}`);
    }
    if (this.debugLog) {
      await this.debugLog(level, source, message);
    }
  }

  private async logPhase(phase: string) {
    if (this.verbose) {
      console.log(`\n  ${'─'.repeat(40)}`);
      console.log(`  [PHASE] ${phase.toUpperCase()}`);
      console.log(`  ${'─'.repeat(40)}`);
    }
    if (this.debugLog) {
      await this.debugLog("PHASE", "orchestrator", phase);
    }
  }

  private async logAgent(agent: string, status: "start" | "complete" | "error", details?: string, metadata?: any) {
    const msg = status === "start"
      ? `${agent} agent starting...`
      : status === "complete"
        ? `${agent} agent complete${details ? `: ${details}` : ""}`
        : `${agent} agent failed${details ? `: ${details}` : ""}`;

    if (this.verbose) {
      console.log(`  [AGENT] ${msg}`);
    }
    if (this.debugLog) {
      await this.debugLog("AGENT", agent.toLowerCase(), msg, metadata);
    }
  }

  async logProgress(percent: number, step: string) {
    console.log(`[PROGRESS] ${percent}% | ${step}`);
  }

  // ============================================================================
  // PHASE 1: Parallel Research
  // ============================================================================

  private async runResearch(): Promise<boolean> {
    await this.logPhase("PHASE 1: RESEARCH (Parallel)");
    this.state.status = "researching";

    const keyword = this.state.keyword.keyword;

    // Run all three research agents in parallel
    await this.log("Launching SEO, Medical, and Competitor research agents...", "🔍");
    await this.logAgent("SEO", "start");
    await this.logAgent("Medical", "start");
    await this.logAgent("Competitor", "start");

    const [seoResult, medicalResult, competitorResult] = await Promise.all([
      seoResearchAgent(keyword),
      medicalResearchAgent(keyword),
      competitorResearchAgent(keyword)
    ]);

    // Check for failures
    if (!seoResult.success || !seoResult.data) {
      this.state.errors.push(`SEO research failed: ${seoResult.error}`);
      await this.logAgent("SEO", "error", seoResult.error);
      await this.log("SEO research failed", "❌", "ERROR", "research");
      return false;
    }
    if (!medicalResult.success || !medicalResult.data) {
      this.state.errors.push(`Medical research failed: ${medicalResult.error}`);
      await this.logAgent("Medical", "error", medicalResult.error);
      await this.log("Medical research failed", "❌", "ERROR", "research");
      return false;
    }
    if (!competitorResult.success || !competitorResult.data) {
      this.state.errors.push(`Competitor research failed: ${competitorResult.error}`);
      await this.logAgent("Competitor", "error", competitorResult.error);
      await this.log("Competitor research failed", "❌", "ERROR", "research");
      return false;
    }

    this.state.seoResearch = seoResult.data;
    this.state.medicalResearch = medicalResult.data;
    this.state.competitorResearch = competitorResult.data;

    this.totalTokens += (seoResult.usage?.total_tokens || 0) +
      (medicalResult.usage?.total_tokens || 0) +
      (competitorResult.usage?.total_tokens || 0);

    await this.logAgent("SEO", "complete", `${seoResult.data.recommended_word_count} words`, { tokens: seoResult.usage?.total_tokens });
    await this.logAgent("Medical", "complete", `${medicalResult.data.key_facts.length} facts`, { tokens: medicalResult.usage?.total_tokens });
    await this.logAgent("Competitor", "complete", `${competitorResult.data.content_gaps.length} gaps`, { tokens: competitorResult.usage?.total_tokens });

    await this.log(`SEO: ${seoResult.data.search_intent} intent, ${seoResult.data.recommended_word_count} words`, "✓");
    await this.log(`Medical: ${medicalResult.data.key_facts.length} key facts identified`, "✓");
    await this.log(`Competitors: ${competitorResult.data.content_gaps.length} gaps found`, "✓");

    return true;
  }

  // ============================================================================
  // PHASE 2: Synthesize Research
  // ============================================================================

  private async runSynthesis(): Promise<boolean> {
    await this.logPhase("PHASE 2: SYNTHESIZE RESEARCH");
    this.state.status = "synthesizing";

    await this.logAgent("Synthesizer", "start");
    const result = await synthesizerAgent(
      this.state.keyword.keyword,
      this.state.seoResearch!,
      this.state.medicalResearch!,
      this.state.competitorResearch!
    );

    if (!result.success || !result.data) {
      this.state.errors.push(`Synthesis failed: ${result.error}`);
      await this.logAgent("Synthesizer", "error", result.error);
      await this.log("Synthesis failed", "❌", "ERROR", "synthesizer");
      return false;
    }

    this.state.synthesizedResearch = result.data;
    this.totalTokens += result.usage?.total_tokens || 0;

    await this.logAgent("Synthesizer", "complete", `${result.data.word_count} words target`, { tokens: result.usage?.total_tokens });
    await this.log(`Angle: "${result.data.primary_angle}"`, "✓");
    await this.log(`Target: ${result.data.word_count} words`, "✓");

    return true;
  }

  // ============================================================================
  // PHASE 3: Parallel Draft Generation
  // ============================================================================

  private async runDrafting(): Promise<boolean> {
    await this.logPhase("PHASE 3: DRAFT GENERATION (Parallel)");
    this.state.status = "drafting";

    const keyword = this.state.keyword.keyword;
    const research = this.state.synthesizedResearch!;

    // Generate 4 drafts with different angles in parallel
    await this.log("Generating 4 draft angles: Clinical, Empathetic, Practical, and Gemini Innovative...", "✍️");
    await this.logAgent("Writer-Clinical", "start");
    await this.logAgent("Writer-Empathetic", "start");
    await this.logAgent("Writer-Practical", "start");
    await this.logAgent("Writer-Gemini", "start");

    const [clinicalResult, empatheticResult, practicalResult, geminiResult] = await parallel([
      () => writeClinical(keyword, research),
      () => writeEmpathetic(keyword, research),
      () => writePractical(keyword, research),
      () => writeGemini(keyword, research)
    ]);

    const drafts = [];

    if (clinicalResult.success && clinicalResult.data) {
      drafts.push(clinicalResult.data);
      await this.logAgent("Writer-Clinical", "complete", clinicalResult.data.title, { tokens: clinicalResult.usage?.total_tokens });
      await this.log(`Clinical draft: "${clinicalResult.data.title}"`, "✓");
    } else {
      await this.logAgent("Writer-Clinical", "error", clinicalResult.error);
    }
    if (empatheticResult.success && empatheticResult.data) {
      drafts.push(empatheticResult.data);
      await this.logAgent("Writer-Empathetic", "complete", empatheticResult.data.title, { tokens: empatheticResult.usage?.total_tokens });
      await this.log(`Empathetic draft: "${empatheticResult.data.title}"`, "✓");
    } else {
      await this.logAgent("Writer-Empathetic", "error", empatheticResult.error);
    }
    if (practicalResult.success && practicalResult.data) {
      drafts.push(practicalResult.data);
      await this.logAgent("Writer-Practical", "complete", practicalResult.data.title, { tokens: practicalResult.usage?.total_tokens });
      await this.log(`Practical draft: "${practicalResult.data.title}"`, "✓");
    } else {
      await this.logAgent("Writer-Practical", "error", practicalResult.error);
    }
    if (geminiResult.success && geminiResult.data) {
      drafts.push(geminiResult.data);
      await this.logAgent("Writer-Gemini", "complete", geminiResult.data.title, { tokens: geminiResult.usage?.total_tokens });
      await this.log(`Gemini Innovative draft: "${geminiResult.data.title}"`, "✓");
    } else {
      await this.logAgent("Writer-Gemini", "error", geminiResult.error);
    }

    this.totalTokens += (clinicalResult.usage?.total_tokens || 0) +
      (empatheticResult.usage?.total_tokens || 0) +
      (practicalResult.usage?.total_tokens || 0) +
      (geminiResult.usage?.total_tokens || 0);

    if (drafts.length < 2) {
      this.state.errors.push("Not enough drafts generated");
      await this.log("Need at least 2 drafts to compare", "❌", "ERROR", "drafting");
      return false;
    }

    this.state.drafts = drafts;
    return true;
  }


  // ============================================================================
  // PHASE 4: Judge Selects Best Draft
  // ============================================================================

  private async runJudging(): Promise<boolean> {
    await this.logPhase("PHASE 4: JUDGE EVALUATION");

    await this.log("Judge evaluating all drafts...", "⚖️");
    await this.logAgent("Judge", "start");

    const result = await judgeAgent(this.state.drafts!, this.state.synthesizedResearch!);

    if (!result.success || !result.data) {
      this.state.errors.push(`Judge failed: ${result.error}`);
      await this.logAgent("Judge", "error", result.error);
      await this.log("Judge evaluation failed", "❌", "ERROR", "judge");
      return false;
    }

    const { selectedDraft, decision } = result.data;
    this.state.selectedDraft = selectedDraft;
    this.state.currentDraft = selectedDraft;
    this.totalTokens += result.usage?.total_tokens || 0;

    await this.logAgent("Judge", "complete", `Selected: ${selectedDraft.angle}`, { tokens: result.usage?.total_tokens, winner: decision.winner });
    await this.log(`Winner: Draft ${decision.winner + 1} (${selectedDraft.angle})`, "🏆");
    await this.log(`Reasoning: ${decision.reasoning.substring(0, 100)}...`, "📋");

    if (decision.synthesis_opportunity) {
      await this.log("Synthesized best elements from multiple drafts", "🔀");
    }

    return true;
  }

  // ============================================================================
  // PHASE 5: Critique Loop
  // ============================================================================

  private async runCritiqueLoop(): Promise<boolean> {
    await this.logPhase("PHASE 5: CRITIQUE LOOP");
    this.state.status = "critiquing";

    while (this.state.revisionCount < this.state.maxRevisions) {
      await this.log(`Critique iteration ${this.state.revisionCount + 1}/${this.state.maxRevisions}...`, "🔍");
      await this.logAgent("Critic-Medical", "start");
      await this.logAgent("Critic-Editorial", "start");

      // Run medical and editorial critics in parallel
      const critique = await runCritique(this.state.currentDraft!);
      this.totalTokens += critique.usage?.total_tokens || 0;

      // Store critiques
      if (critique.medical) {
        this.state.medicalCritique = critique.medical;
        await this.logAgent("Critic-Medical", critique.medical.approved ? "complete" : "complete",
          `${critique.medical.claims_verified}/${critique.medical.claims_found} verified`,
          { approved: critique.medical.approved });
        await this.log(`Medical: ${critique.medical.claims_verified}/${critique.medical.claims_found} claims verified`,
          critique.medical.approved ? "✓" : "⚠️");
      }
      if (critique.editorial) {
        this.state.editorialCritique = critique.editorial;
        await this.logAgent("Critic-Editorial", "complete",
          `Score: ${critique.editorial.overall_score}/10`,
          { approved: critique.editorial.approved, score: critique.editorial.overall_score });
        await this.log(`Editorial: ${critique.editorial.overall_score}/10`,
          critique.editorial.approved ? "✓" : "⚠️");
      }

      // If both approve, we're done
      if (critique.approved) {
        await this.log("Both critics approve! Moving to finalization.", "✅");
        return true;
      }

      // Need revision
      this.state.status = "revising";
      await this.log(`Revisions needed: ${critique.revisionNeeded.length} items`, "📝");
      await this.logAgent("Revision-Writer", "start");

      const medicalFeedback = this.state.medicalCritique?.revision_required || [];
      const editorialFeedback = this.state.editorialCritique?.revision_required || [];

      const revisionResult = await revisionWriter(
        this.state.currentDraft!,
        medicalFeedback,
        editorialFeedback
      );
      this.totalTokens += revisionResult.usage?.total_tokens || 0;

      if (!revisionResult.success || !revisionResult.data) {
        this.state.errors.push(`Revision failed: ${revisionResult.error}`);
        await this.logAgent("Revision-Writer", "error", revisionResult.error);
        await this.log("Revision failed", "❌", "ERROR", "revision");
        return false;
      }

      this.state.currentDraft = revisionResult.data;
      this.state.revisionCount++;
      await this.logAgent("Revision-Writer", "complete", `Iteration ${this.state.revisionCount}`, { tokens: revisionResult.usage?.total_tokens });
      await this.log(`Revision ${this.state.revisionCount} complete`, "✓");
    }

    // Max revisions reached
    await this.log(`Max revisions (${this.state.maxRevisions}) reached. Proceeding with current draft.`, "⚠️", "WARN", "critique");
    return true;
  }

  // ============================================================================
  // PHASE 6: SEO Finalization
  // ============================================================================

  private async runFinalization(): Promise<boolean> {
    await this.logPhase("PHASE 6: SEO FINALIZATION");
    this.state.status = "finalizing";

    await this.log("Optimizing for SEO...", "🎯");
    await this.logAgent("SEO-Finalizer", "start");

    const result = await seoFinalizerAgent(
      this.state.currentDraft!,
      this.state.seoResearch!
    );

    if (!result.success || !result.data) {
      this.state.errors.push(`Finalization failed: ${result.error}`);
      await this.logAgent("SEO-Finalizer", "error", result.error);
      await this.log("SEO finalization failed", "❌", "ERROR", "seo");
      return false;
    }

    this.totalTokens += result.usage?.total_tokens || 0;

    // Add iteration count
    result.data.iterations = this.state.revisionCount + 1;
    result.data.quality_score = this.state.editorialCritique?.overall_score || 0;
    result.data.total_tokens = this.totalTokens;

    this.state.finalArticle = result.data;
    this.state.status = "complete";
    this.state.completedAt = new Date();

    await this.logAgent("SEO-Finalizer", "complete", result.data.title, { tokens: result.usage?.total_tokens, links: result.data.internal_links.length });
    await this.log(`Final title: "${result.data.title}"`, "✓");
    await this.log(`Internal links: ${result.data.internal_links.length}`, "✓");
    await this.log(`Quality score: ${result.data.quality_score}/10`, "✓");
    await this.log(`Total Token Usage: ${this.totalTokens}`, "💰");

    return true;
  }

  // ============================================================================
  // RUN FULL PIPELINE
  // ============================================================================

  async run(): Promise<{ success: boolean; article?: FinalArticle; state: PipelineState }> {
    const startTime = Date.now();

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  MULTI-AGENT CONTENT GENERATION`);
    console.log(`  Keyword: "${this.state.keyword.keyword}"`);
    console.log(`${"═".repeat(60)}`);

    try {
      await this.logProgress(5, "Initializing pipeline");

      // Phase 1: Research
      await this.logProgress(10, "PHASE 1: Global Research");
      if (!await this.runResearch()) throw new Error("Research phase failed");

      // Phase 2: Synthesis
      await this.logProgress(25, "PHASE 2: Synthesis");
      if (!await this.runSynthesis()) throw new Error("Synthesis phase failed");

      // Phase 3: Drafting
      await this.logProgress(40, "PHASE 3: Parallel Drafting");
      if (!await this.runDrafting()) throw new Error("Drafting phase failed");

      // Phase 4: Judging
      await this.logProgress(60, "PHASE 4: Editorial Judging");
      if (!await this.runJudging()) throw new Error("Judging phase failed");

      // Phase 5: Critique
      await this.logProgress(75, "PHASE 5: Medical & Style Critique");
      if (!await this.runCritiqueLoop()) throw new Error("Critique loop failed");

      // Phase 6: Finalization
      await this.logProgress(90, "PHASE 6: SEO Finalization");
      if (!await this.runFinalization()) throw new Error("Finalization failed");

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n${"═".repeat(60)}`);
      console.log(`  ✅ COMPLETE in ${duration}s`);
      console.log(`  📝 "${this.state.finalArticle!.title}"`);
      console.log(`  📊 Quality: ${this.state.finalArticle!.quality_score}/10`);
      console.log(`  🔄 Iterations: ${this.state.finalArticle!.iterations}`);
      console.log(`  💰 Total Tokens: ${this.state.finalArticle!.total_tokens}`);
      console.log(`${"═".repeat(60)}\n`);

      await this.logProgress(100, "Generation complete");

      return {
        success: true,
        article: this.state.finalArticle,
        state: this.state
      };

    } catch (error) {
      this.state.status = "failed";
      this.state.errors.push(String(error));
      console.error(`\n❌ Pipeline failed: ${error}`);
      await this.logProgress(0, "Pipeline failed");
      return { success: false, state: this.state };
    }
  }
}
