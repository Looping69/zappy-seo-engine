# Proposal: Agent Neural Network Visualizer (Three.js)

## 1. Vision: "The Ghost in the Machine"
A striking, immersive 3D environment that represents the **Zappy Multi-Agent Brain**. Instead of just looking at logs, users can *see* the autonomous agents collaborating in real-time. 

## 2. Visual Architecture
*   **The Agents**: Each agent in the `ContentOrchestrator` is represented by a luminous 3D sphere (dot).
    *   🔵 **Research Agent**: Cyan (Searching for data)
    *   🟣 **Synthesis Agent**: Royal Purple (Structuring data)
    *   🟠 **Drafting Agent**: Bright Orange (Writing content)
    *   🟡 **Editorial Judge**: Gold (Evaluating quality)
    *   🔴 **Critique Agent**: Crimson (Finding flaws)
    *   🟢 **SEO Agent**: Emerald (Finalizing structure)
*   **The Persistence (Trails)**: Every agent leaves a **Ribbon Trail** behind as it moves. These trails persist significantly, creating a complex "neural map" of the project's history before slowly dissolving.
*   **Thought Bubbles**: Floating CSS2D/3D labels that pop up above agents, displaying snippets of their current reasoning (e.g., *"Validating study from 2024..."*).

## 3. Technical Implementation
*   **Engine**: Three.js + `THREE.MeshLine` (for the trails) or `THREE.Points`.
*   **Data Source**: Integration with the existing Encore `/content/logs/:id` endpoint.
*   **Motion Logic**: 
    *   Agents move in "Knowledge Lines" towards specific project coordinates.
    *   When an agent waits for another, it orbits the active agent.
    *   When an error occurs, the dot "glitches" (shakes) and turns grey.

## 4. Proposed Layout
*   **Widescreen Immersive Mode**: A dedicated `/ui/swarm` route.
*   **Minimalist HUD**: Overlying stats (Total Sentience, Active Threads, Throughput) in a clinical, transparent glassmorphism overlay.
*   **Navigation**: Pan, zoom, and rotate around the agent cluster.

## 5. Integration Workflow
1.  **Frontend Update**: Add `Swarm.html` utilizing Three.js.
2.  **State Mapping**: Map pipeline phases to specific 3D behaviors (e.g., PHASES 1-2 = Convergence, PHASE 3 = Expansion).
3.  **Real-time Handshake**: Utilize the existing polling/pubsub to drive dot velocity and thought-bubble triggers.

---

**Objective**: Move Zappy from a "Dashboard" to a "Living Engine" experience.
