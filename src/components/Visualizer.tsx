import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Dimensions, PackingResult } from '../lib/packing';

interface VisualizerProps {
  item: Dimensions;
  container: Dimensions;
  result: PackingResult;
  unit: 'in' | 'cm';
}

export function Visualizer({ item, container, result, unit }: VisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const mainBoxRef = useRef<THREE.Mesh | null>(null);
  const containerWireframeRef = useRef<THREE.Mesh | null>(null);
  const packedGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE SETUP
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // CAMERA
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(40, 40, 40);
    cameraRef.current = camera;

    // RENDERERS
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    mountRef.current.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // RESIZE HANDLER
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const mountNode = mountRef.current;
    
    // ANIMATE LOOP
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountNode) {
        if (renderer.domElement.parentNode === mountNode) mountNode.removeChild(renderer.domElement);
        if (labelRenderer.domElement.parentNode === mountNode) mountNode.removeChild(labelRenderer.domElement);
      }
      renderer.dispose();
    };
  }, []); // Run once on mount

  // Update logic on props change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old elements
    if (mainBoxRef.current) {
      scene.remove(mainBoxRef.current);
      mainBoxRef.current = null;
    }
    if (containerWireframeRef.current) {
      scene.remove(containerWireframeRef.current);
      containerWireframeRef.current = null;
    }
    if (packedGroupRef.current) {
      scene.remove(packedGroupRef.current);
      packedGroupRef.current = null;
    }

    if (!result || result.count === 0) {
      // Just show the main item box
      const { length: l, width: w, height: h } = item;
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshPhongMaterial({ 
          color: 0x38bdf8, 
          shininess: 10,
          transparent: true,
          opacity: 0.9
      });
      
      const mainBox = new THREE.Mesh(geometry, material);
      mainBox.castShadow = true;
      mainBox.scale.set(l, h, w); // Three.js Y is height
      mainBox.position.y = h / 2;
      scene.add(mainBox);
      
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }));
      mainBox.add(line);

      // Add labels
      const labels = [
        { text: `${l}${unit}`, pos: [0, -0.51, 0] }, // Bottom
        { text: `${h}${unit}`, pos: [0.51, 0, 0] },  // Side
        { text: `${w}${unit}`, pos: [0, 0, 0.51] }   // Front
      ];

      labels.forEach(lab => {
        const div = document.createElement('div');
        div.className = 'bg-black/70 text-white px-1.5 py-0.5 rounded text-xs pointer-events-none border border-sky-500 font-mono';
        div.textContent = lab.text;
        const labelObj = new CSS2DObject(div);
        labelObj.position.set(lab.pos[0], lab.pos[1], lab.pos[2]);
        mainBox.add(labelObj);
      });

      mainBoxRef.current = mainBox;
    } else {
      // Show visualization of packing layout
      const { length: cL, width: cW, height: cH } = container;
      const contGeo = new THREE.BoxGeometry(cL, cH, cW);
      const contMat = new THREE.MeshPhongMaterial({ 
          color: 0xcccccc, 
          wireframe: true, 
          transparent: true, 
          opacity: 0.2 
      });
      const containerWireframe = new THREE.Mesh(contGeo, contMat);
      containerWireframe.position.y = cH / 2;
      scene.add(containerWireframe);
      containerWireframeRef.current = containerWireframe;

      const packedGroup = new THREE.Group();
      const [nx, ny, nz] = result.layout;
      const { length: dx, width: dy, height: dz } = result.orientation;

      const itemGeo = new THREE.BoxGeometry(dx, dz, dy); // Map to Three.js axes
      const itemMat = new THREE.MeshPhongMaterial({ 
          color: 0x38bdf8, 
          transparent: true, 
          opacity: 0.6,
      });

      const displayLimit = Math.min(result.count, 1000);
      let created = 0;

      for (let x = 0; x < nx; x++) {
          for (let y = 0; y < ny; y++) {
              for (let z = 0; z < nz; z++) {
                  if (created >= displayLimit) break;
                  const m = new THREE.Mesh(itemGeo, itemMat);
                  
                  // Positioning from corner
                  m.position.set(
                      (-cL / 2) + (x * dx) + (dx / 2),
                      (z * dz) + (dz / 2),
                      (-cW / 2) + (y * dy) + (dy / 2)
                  );

                  const e = new THREE.EdgesGeometry(itemGeo);
                  const l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({color: 0xffffff}));
                  m.add(l);

                  packedGroup.add(m);
                  created++;
              }
          }
      }
      scene.add(packedGroup);
      packedGroupRef.current = packedGroup;
    }
  }, [item, container, result, unit]);

  return <div ref={mountRef} className="w-full h-full relative radial-bg" />;
}
