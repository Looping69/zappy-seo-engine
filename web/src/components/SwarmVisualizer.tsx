import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { fetchKeywords, fetchLogs } from '../api';

const COLORS = {
    cyan: 0x00f2ff,
    purple: 0xbc13fe,
    orange: 0xff4d00,
    yellow: 0xffd300,
    red: 0xff003c,
    green: 0x24ff00
};

const AGENT_DATA = [
    { id: 1, name: 'Researcher Alpha', role: 'Research', color: COLORS.cyan, mission: 'Executing deep-level semantic mining across 4,000 global medical databases.', op: 'Analyzing clinical trial metadata', facts: ['Cross-ref 12.4k papers', 'Domain authority: 9.8', 'Latent cluster: 04'] },
    { id: 2, name: 'Synthesizer Beta', role: 'Synthesis', color: COLORS.purple, mission: 'Building high-density information bridges between disparate clinical findings.', op: 'Mapping knowledge graph nodes', facts: ['Linking study S-99 to T-04', 'Entity weight: 0.88', 'Structure: Hierarchical'] },
    { id: 3, name: 'Drafting Core', role: 'Drafting', color: COLORS.orange, mission: 'Converting high-density data clusters into empathetic, readable expert narratives.', op: 'Generative Narrative Pulse', facts: ['Readability: Grade 10', 'Tone: Clinical/Expert', 'Words/sec: 145'] },
    { id: 4, name: 'Editorial Judge', role: 'Judging', color: COLORS.yellow, mission: 'Enforcing strict E-A-T protocols and scientific fact-density standards.', op: 'Truth-Scoping Clinical Claims', facts: ['Claim density: High', 'Source verification: 100%', 'Bias filter: Active'] },
    { id: 5, name: 'Critique Engine', role: 'Critique', color: COLORS.red, mission: 'Adversarially testing all drafted conclusions for logical gaps.', op: 'Logical Stress Testing', facts: ['Negative constraints: 44', 'Loop check: 0 errors', 'Style clash: Minor'] },
    { id: 6, name: 'SEO Architect', role: 'SEO', color: COLORS.green, mission: 'Optimizing the final neural structure for multi-vector semantic search intent.', op: 'Keyword Cluster Deployment', facts: ['Intent match: Informative', 'LSI density: Optimized', 'Breadcrumb: Verified'] }
];

export function SwarmVisualizer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xF8FAFC);
        scene.fog = new THREE.Fog(0xF8FAFC, 20, 100);

        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        containerRef.current.appendChild(renderer.domElement);

        camera.position.set(0, 10, 40);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(10, 20, 10);
        scene.add(directionalLight);

        const agents: any[] = [];
        AGENT_DATA.forEach((data, i) => {
            const group = new THREE.Group();
            const geometry = new THREE.SphereGeometry(0.4, 32, 32);
            const material = new THREE.MeshPhongMaterial({
                color: data.color,
                emissive: data.color,
                emissiveIntensity: 1.5,
                shininess: 100
            });
            const sphere = new THREE.Mesh(geometry, material);
            group.add(sphere);

            group.position.set(0, 0, 0);
            scene.add(group);

            const trailGeo = new THREE.BufferGeometry();
            const trailPositions = new Float32Array(3000 * 3);
            trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
            trailGeo.setDrawRange(0, 0);
            const trailMat = new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0.6 });
            const trail = new THREE.Line(trailGeo, trailMat);
            scene.add(trail);

            agents.push({
                mesh: group,
                trail: trail,
                trailPoints: [],
                target: new THREE.Vector3(),
                data: data
            });
        });

        const controls = new OrbitControls(camera, renderer.domElement);

        let isJobActive = false;
        let globalJobProgress = 0;

        const animate = () => {
            requestAnimationFrame(animate);
            agents.forEach(agent => {
                agent.mesh.position.lerp(agent.target, 0.05);
                agent.trailPoints.push(agent.mesh.position.clone());
                if (agent.trailPoints.length > 1000) agent.trailPoints.shift();

                const posAttr = agent.trail.geometry.attributes.position;
                agent.trailPoints.forEach((p: any, idx: number) => {
                    posAttr.setXYZ(idx, p.x, p.y, p.z);
                });
                agent.trail.geometry.setDrawRange(0, agent.trailPoints.length);
                posAttr.needsUpdate = true;

                if (Math.random() > 0.98) {
                    agent.target.set(
                        (Math.random() - 0.5) * 40,
                        (Math.random() - 0.5) * 40,
                        (Math.random() - 0.5) * 40
                    );
                }
            });
            controls.update();
            renderer.render(scene, camera);
        };

        animate();

        const interval = setInterval(async () => {
            try {
                const data = await fetchKeywords();
                const active = data.keywords.find((k: any) => k.status === 'generating');
                if (active) {
                    const lData = await fetchLogs(active.id);
                    if (lData.logs.length > 0) {
                        const last = lData.logs[lData.logs.length - 1];
                        setProgress(last.percent);
                    }
                } else {
                    setProgress(0);
                }
            } catch (e) { }
        }, 5000);

        return () => {
            clearInterval(interval);
            renderer.dispose();
        };
    }, []);

    return (
        <div className="relative w-full h-[600px] factory-card overflow-hidden">
            <div className="absolute top-4 left-6 z-10">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Neural Sync: {progress}%</span>
                </div>
            </div>
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}
