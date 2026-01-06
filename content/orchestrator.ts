import { parallel } from "./utils/claude.js";
import { seoResearchAgent, medicalResearchAgent, competitorResearchAgent } from "./agents/research.js";
import { synthesizerAgent } from "./agents/synthesizer.js";
import { writeClinical, writeEmpathetic, writePractical, writeDeepSeek, revisionWriter } from "./agents/writers.js";
import { judgeAgent } from "./agents/judge.js";
import { runCritique } from "./agents/critics.js";
import { seoFinalizerAgent } from "./agents/seo.js";
import type { Keyword, PipelineState, FinalArticle } from "./types.js";

// ============================================================================
// ORCHESTRATOR - Coordinates all agents
// ============================================================================

export class ContentOrchestrator {
  private state: PipelineState;
  private verbose: boolean;
  private totalTokens: number = 0;

  constructor(keyword: Keyword, options: { verbose?: boolean; maxRevisions?: number } = {}) {
    this.verbose = options.verbose ?? true;
    this.state = {
      keyword,
      status: "researching",
      revisionCount: 0,
      maxRevisions: options.maxRevisions ?? 3,
      startedAt: new Date(),
      errors: [],
      log: []
    };
  }

  private log(message: string, emoji = "•") {
    const entry = `${emoji} ${message}`;
    this.state.log.push(entry);
    if (this.verbose) {
      console.log(`  ${entry}`);
    }
  }

  private logPhase(phase: string) {
    if (this.verbose) {
      console.log(`\n  ───────────────────────`);
      console.log(`  ${phase.toUpperCase()}`);
      console.log(`  ───────────────────────`);
    }
  }

  async logProgress(percent: number, step: string) {
    console.log(`REPORT_PROGRESS: ${percent}|${step}`);
  }

  // ============================================================================
  // PHASE 1: Parallel Research
  // ============================================================================

  private async runResearch(): Promise<boolean> {
    this.logPhase("PHASE 1: RESEARCH (Parallel)");
    this.state.status = "researching";

    const keyword = this.state.keyword.keyword;

    // Run all three research agents in parallel
    this.log("Launching SEO, Medical, and Competitor research agents...", "🔍");

    const [seoResult, medicalResult, competitorResult] = await parallel([
      () => seoResearchAgent(keyword),
      () => medicalResearchAgent(keyword),
      () => competitorResearchAgent(keyword)
    ]);

    // Check for failures
    if (!seoResult.success || !seoResult.data) {
      this.state.errors.push(`SEO research failed: ${seoResult.error}`);
      this.log("SEO research failed", "❌");
      return false;
    }
    if (!medicalResult.success || !medicalResult.data) {
      this.state.errors.push(`Medical research failed: ${medicalResult.error}`);
      this.log("Medical research failed", "❌");
      return false;
    }
    if (!competitorResult.success || !competitorResult.data) {
      this.state.errors.push(`Competitor research failed: ${competitorResult.error}`);
      this.log("Competitor research failed", "❌");
      return false;
    }

    this.state.seoResearch = seoResult.data;
    this.state.medicalResearch = medicalResult.data;
    this.state.competitorResearch = competitorResult.data;

    this.totalTokens += (seoResult.usage?.total_tokens || 0) +
      (medicalResult.usage?.total_tokens || 0) +
      (competitorResult.usage?.total_tokens || 0);

    this.log(`SEO: ${seoResult.data.search_intent} intent, ${seoResult.data.recommended_word_count} words`, "✓");
    this.log(`Medical: ${medicalResult.data.key_facts.length} key facts identified`, "✓");
    this.log(`Competitors: ${competitorResult.data.content_gaps.length} gaps found`, "✓");

    return true;
  }

  // ============================================================================
  // PHASE 2: Synthesize Research
  // ============================================================================

  private async runSynthesis(): Promise<boolean> {
    this.logPhase("PHASE 2: SYNTHESIZE RESEARCH");
    this.state.status = "synthesizing";

    const result = await synthesizerAgent(
      this.state.keyword.keyword,
      this.state.seoResearch!,
      this.state.medicalResearch!,
      this.state.competitorResearch!
    );

    if (!result.success || !result.data) {
      this.state.errors.push(`Synthesis failed: ${result.error}`);
      this.log("Synthesis failed", "❌");
      return false;
    }

    this.state.synthesizedResearch = result.data;
    this.totalTokens += result.usage?.total_tokens || 0;

    this.log(`Angle: "${result.data.primary_angle}"`, "✓");
    this.log(`Target: ${result.data.word_count} words`, "✓");

    return true;
  }

  // ============================================================================
  // PHASE 3: Parallel Draft Generation
  // ============================================================================

  private async runDrafting(): Promise<boolean> {
    this.logPhase("PHASE 3: DRAFT GENERATION (Parallel)");
    this.state.status = "drafting";

    const keyword = this.state.keyword.keyword;
    const research = this.state.synthesizedResearch!;

    // Generate 4 drafts with different angles in parallel
    this.log("Generating 4 draft angles: Clinical, Empathetic, Practical, and DeepSeek Innovative...", "✍️");

    const [clinicalResult, empatheticResult, practicalResult, deepSeekResult] = await parallel([
      () => writeClinical(keyword, research),
      () => writeEmpathetic(keyword, research),
      () => writePractical(keyword, research),
      () => writeDeepSeek(keyword, research)
    ]);

    const drafts = [];

    if (clinicalResult.success && clinicalResult.data) {
      drafts.push(clinicalResult.data);
      this.log(`Clinical draft: "${clinicalResult.data.title}"`, "✓");
    }
    if (empatheticResult.success && empatheticResult.data) {
      drafts.push(empatheticResult.data);
      this.log(`Empathetic draft: "${empatheticResult.data.title}"`, "✓");
    }
    if (practicalResult.success && practicalResult.data) {
      drafts.push(practicalResult.data);
      this.log(`Practical draft: "${practicalResult.data.title}"`, "✓");
    }
    if (deepSeekResult.success && deepSeekResult.data) {
      drafts.push(deepSeekResult.data);
      this.log(`DeepSeek Innovative draft: "${deepSeekResult.data.title}"`, "✓");
    }

    this.totalTokens += (clinicalResult.usage?.total_tokens || 0) +
      (empatheticResult.usage?.total_tokens || 0) +
      (practicalResult.usage?.total_tokens || 0) +
      (deepSeekResult.usage?.total_tokens || 0);

    if (drafts.length < 2) {
      this.state.errors.push("Not enough drafts generated");
      this.log("Need at least 2 drafts to compare", "❌");
      return false;
    }

    this.state.drafts = drafts;
    return true;
  }

  // ============================================================================
  // PHASE 4: Judge Selects Best Draft
  // ============================================================================

  private async runJudging(): Promise<boolean> {
    this.logPhase("PHASE 4: JUDGE EVALUATION");

    this.log("Judge evaluating all drafts...", "⚖️");

    const result = await judgeAgent(this.state.drafts!, this.state.synthesizedResearch!);

    if (!result.success || !result.data) {
      this.state.errors.push(`Judge failed: ${result.error}`);
      this.log("Judge evaluation failed", "❌");
      return false;
    }

    const { selectedDraft, decision } = result.data;
    this.state.selectedDraft = selectedDraft;
    this.state.currentDraft = selectedDraft;
    this.totalTokens += result.usage?.total_tokens || 0;

    this.log(`Winner: Draft ${decision.winner + 1} (${selectedDraft.angle})`, "🏆");
    this.log(`Reasoning: ${decision.reasoning.substring(0, 100)}...`, "📋");

    if (decision.synthesis_opportunity) {
      this.log("Synthesized best elements from multiple drafts", "🔀");
    }

    return true;
  }

  // ============================================================================
  // PHASE 5: Critique Loop
  // ============================================================================

  private async runCritiqueLoop(): Promise<boolean> {
    this.logPhase("PHASE 5: CRITIQUE LOOP");
    this.state.status = "critiquing";

    while (this.state.revisionCount < this.state.maxRevisions) {
      this.log(`Critique iteration ${this.state.revisionCount + 1}/${this.state.maxRevisions}...`, "🔍");

      // Run medical and editorial critics in parallel
      const critique = await runCritique(this.state.currentDraft!);
      this.totalTokens += critique.usage?.total_tokens || 0;

      // Store critiques
      if (critique.medical) {
        this.state.medicalCritique = critique.medical;
        this.log(`Medical: ${critique.medical.claims_verified}/${critique.medical.claims_found} claims verified`,
          critique.medical.approved ? "✓" : "⚠️");
      }
      if (critique.editorial) {
        this.state.editorialCritique = critique.editorial;
        this.log(`Editorial: ${critique.editorial.overall_score}/10`,
          critique.editorial.approved ? "✓" : "⚠️");
      }

      // If both approve, we're done
      if (critique.approved) {
        this.log("Both critics approve! Moving to finalization.", "✅");
        return true;
      }

      // Need revision
      this.state.status = "revising";
      this.log(`Revisions needed: ${critique.revisionNeeded.length} items`, "📝");

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
        this.log("Revision failed", "❌");
        return false;
      }

      this.state.currentDraft = revisionResult.data;
      this.state.revisionCount++;
      this.log(`Revision ${this.state.revisionCount} complete`, "✓");
    }

    // Max revisions reached
    this.log(`Max revisions (${this.state.maxRevisions}) reached. Proceeding with current draft.`, "⚠️");
    return true;
  }

  // ============================================================================
  // PHASE 6: SEO Finalization
  // ============================================================================

  private async runFinalization(): Promise<boolean> {
    this.logPhase("PHASE 6: SEO FINALIZATION");
    this.state.status = "finalizing";

    this.log("Optimizing for SEO...", "🎯");

    const result = await seoFinalizerAgent(
      this.state.currentDraft!,
      this.state.seoResearch!
    );

    if (!result.success || !result.data) {
      this.state.errors.push(`Finalization failed: ${result.error}`);
      this.log("SEO finalization failed", "❌");
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

    this.log(`Final title: "${result.data.title}"`, "✓");
    this.log(`Internal links: ${result.data.internal_links.length}`, "✓");
    this.log(`Quality score: ${result.data.quality_score}/10`, "✓");
    this.log(`Total Token Usage: ${this.totalTokens}`, "💰");

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
