import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Dimensions, PackingResult } from '../lib/packing';

function createDetailedPallet(
  dx: number,
  dy: number,
  dz: number,
  posX: number,
  posY: number,
  posZ: number
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(posX, posY, posZ);

  // Material: warm pine wood color
  const woodColor = 0xc29b6a;
  
  const createWoodMaterial = () => new THREE.MeshPhongMaterial({
    color: woodColor,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x5c4033,
    opacity: 0.4,
    transparent: true,
  });

  // Height dz is composed of standard wooden pallet layers:
  // - Top deck boards (T): 15% of dz
  // - Runner boards (R): 15% of dz
  // - Blocks (B): 55% of dz
  // - Bottom boards (L): 15% of dz
  const T = dz * 0.15;
  const R = dz * 0.15;
  const B = dz * 0.55;
  const L = dz * 0.15;

  // 1. Bottom boards (3 boards running along length dx)
  const bottomSlatWidth = Math.min(dy * 0.12, 12);
  const bottomSlatGeo = new THREE.BoxGeometry(dx, L, bottomSlatWidth);
  const bottomZPos = [-dy / 2 + bottomSlatWidth / 2, 0, dy / 2 - bottomSlatWidth / 2];

  for (const bz of bottomZPos) {
    const mesh = new THREE.Mesh(bottomSlatGeo, createWoodMaterial());
    mesh.userData = { isPackedItem: true, isPalletWood: true };
    mesh.position.set(0, -dz / 2 + L / 2, bz);

    const edges = new THREE.EdgesGeometry(bottomSlatGeo);
    const lines = new THREE.LineSegments(edges, edgeMaterial);
    mesh.add(lines);
    group.add(mesh);
  }

  // 2. Middle blocks (9 rectangular blocks)
  const blockLength = Math.min(dx * 0.10, 10);
  const blockWidth = Math.min(dy * 0.10, 10);
  const blockGeo = new THREE.BoxGeometry(blockLength, B, blockWidth);
  const blockXPos = [-dx / 2 + blockLength / 2, 0, dx / 2 - blockLength / 2];
  const blockZPos = [-dy / 2 + blockWidth / 2, 0, dy / 2 - blockWidth / 2];

  for (const bx of blockXPos) {
    for (const bz of blockZPos) {
      const mesh = new THREE.Mesh(blockGeo, createWoodMaterial());
      mesh.userData = { isPackedItem: true, isPalletWood: true };
      mesh.position.set(bx, -dz / 2 + L + B / 2, bz);

      const edges = new THREE.EdgesGeometry(blockGeo);
      const lines = new THREE.LineSegments(edges, edgeMaterial);
      mesh.add(lines);
      group.add(mesh);
    }
  }

  // 3. Runner boards (3 boards running along length dx on top of blocks)
  const runnerWidth = Math.min(dy * 0.12, 12);
  const runnerGeo = new THREE.BoxGeometry(dx, R, runnerWidth);
  const runnerZPos = [-dy / 2 + runnerWidth / 2, 0, dy / 2 - runnerWidth / 2];

  for (const rz of runnerZPos) {
    const mesh = new THREE.Mesh(runnerGeo, createWoodMaterial());
    mesh.userData = { isPackedItem: true, isPalletWood: true };
    mesh.position.set(0, -dz / 2 + L + B + R / 2, rz);

    const edges = new THREE.EdgesGeometry(runnerGeo);
    const lines = new THREE.LineSegments(edges, edgeMaterial);
    mesh.add(lines);
    group.add(mesh);
  }

  // 4. Top slats (5 boards running along width dy across runners)
  const topSlatWidth = Math.min(dx * 0.12, 12);
  const topSlatGeo = new THREE.BoxGeometry(topSlatWidth, T, dy);
  const spacing = (dx - topSlatWidth) / 4;

  for (let i = 0; i < 5; i++) {
    const tx = -dx / 2 + topSlatWidth / 2 + i * spacing;
    const mesh = new THREE.Mesh(topSlatGeo, createWoodMaterial());
    mesh.userData = { isPackedItem: true, isPalletWood: true };
    mesh.position.set(tx, dz / 2 - T / 2, 0);

    const edges = new THREE.EdgesGeometry(topSlatGeo);
    const lines = new THREE.LineSegments(edges, edgeMaterial);
    mesh.add(lines);
    group.add(mesh);
  }

  return group;
}

interface VisualizerProps {
  item: Dimensions;
  container: Dimensions;
  secondaryItem?: Dimensions;
  result: PackingResult;
  unit: 'in' | 'cm' | 'ft';
  itemUnit: 'in' | 'cm' | 'ft';
  highlightContainer?: boolean;
}

export function Visualizer({ item, container, result, unit, itemUnit, highlightContainer = false }: VisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const mainBoxRef = useRef<THREE.Mesh | null>(null);
  const containerWireframeRef = useRef<THREE.Group | null>(null);
  const packedGroupRef = useRef<THREE.Group | null>(null);
  const highlightRef = useRef(highlightContainer);
  const isRotatingRef = useRef(false);
  
  // Animation targets for fluidity
  const targetItemScale = useRef(new THREE.Vector3(1, 1, 1));
  const targetContainerScale = useRef(new THREE.Vector3(1, 1, 1));
  const targetPackedScale = useRef(new THREE.Vector3(1, 1, 1));
  const targetPackedOpacity = useRef(0.6);
  const currentPackedOpacity = useRef(0.6);
  const targetPackedYOffset = useRef(0);
  const currentPackedYOffset = useRef(0);
  

  useEffect(() => {
    highlightRef.current = highlightContainer;
  }, [highlightContainer]);

  const [selectedFace, setSelectedFace] = useState<{ width: number, height: number } | null>(null);
  const pointerDownPos = useRef<{ x: number, y: number } | null>(null);

  // Define handleCanvasClick as a stable callback to be used in event listeners
  const handleCanvasClick = (e: PointerEvent, camera: THREE.PerspectiveCamera) => {
    if (!mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const objectsToIntersect: THREE.Object3D[] = [];
    if (mainBoxRef.current) objectsToIntersect.push(mainBoxRef.current);
    if (packedGroupRef.current) objectsToIntersect.push(...packedGroupRef.current.children);

    const intersects = raycaster.intersectObjects(objectsToIntersect, false);
    
    if (intersects.length > 0) {
        const hit = intersects[0];
        const normal = hit.face?.normal;
        if (!normal) return;

        const obj = hit.object as THREE.Mesh;
        let dimX = 0, dimY = 0, dimZ = 0;
        
        if (obj === mainBoxRef.current) {
            dimX = obj.scale.x; 
            dimY = obj.scale.y; 
            dimZ = obj.scale.z; 
        } else {
            const geo = obj.geometry as THREE.BoxGeometry;
            dimX = geo.parameters.width;
            dimY = geo.parameters.height;
            dimZ = geo.parameters.depth;
        }

        const absNormal = new THREE.Vector3(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
        let faceW = 0, faceH = 0;

        if (absNormal.x > 0.5) {
            faceW = dimZ; 
            faceH = dimY;
        } else if (absNormal.y > 0.5) {
            faceW = dimX; 
            faceH = dimZ;
        } else if (absNormal.z > 0.5) {
            faceW = dimX; 
            faceH = dimY;
        }
        
        setSelectedFace({ width: faceW, height: faceH });
    } else {
        setSelectedFace(null);
    }
  };

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
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = true;
    renderer.sortObjects = true;
    
    // Clear mount point to prevent double-canvas in StrictMode
    if (mountRef.current) {
      mountRef.current.innerHTML = '';
      mountRef.current.appendChild(renderer.domElement);
    }
    rendererRef.current = renderer;
    
    // ATTACH EVENTS DIRECTLY TO CANVAS (Avoids React layout thrashing)
    const canvas = renderer.domElement;
    const onCanvasPointerDown = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    };
    
    const onCanvasPointerUp = (e: PointerEvent) => {
      if (!pointerDownPos.current) return;
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 5 && camera) {
        // Trigger click logic using the stored refs
        handleCanvasClick(e, camera);
      }
      pointerDownPos.current = null;
    };
    
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    canvas.addEventListener('pointerup', onCanvasPointerUp);
    
    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const onStart = () => { isRotatingRef.current = true; };
    const onEnd = () => { isRotatingRef.current = false; };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);

    // RESIZE HANDLER
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const mountNode = mountRef.current;
    
    // ANIMATE LOOP
    const clock = new THREE.Clock();
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();

      const time = clock.getElapsedTime();
      
      // Smooth transitions for fluidity
      const lerpFactor = 0.15;
      const animFactor = 0.1; // Slower for subtle effects
      
      // Rotation-based opacity masking (fixes Z-fighting pop)
      if (isRotatingRef.current) {
        targetPackedOpacity.current = 0.45;
      } else {
        targetPackedOpacity.current = 0.65;
      }
      
      currentPackedOpacity.current = THREE.MathUtils.lerp(currentPackedOpacity.current, targetPackedOpacity.current, animFactor);
      currentPackedYOffset.current = THREE.MathUtils.lerp(currentPackedYOffset.current, targetPackedYOffset.current, animFactor);

      if (mainBoxRef.current) {
        mainBoxRef.current.scale.lerp(targetItemScale.current, lerpFactor);
        mainBoxRef.current.position.y = THREE.MathUtils.lerp(mainBoxRef.current.position.y, targetItemScale.current.y / 2, lerpFactor);
      }
      
      if (containerWireframeRef.current) {
        containerWireframeRef.current.scale.lerp(targetContainerScale.current, lerpFactor);
        containerWireframeRef.current.position.y = THREE.MathUtils.lerp(containerWireframeRef.current.position.y, targetContainerScale.current.y / 2, lerpFactor);
      }
      
      if (packedGroupRef.current) {
        packedGroupRef.current.scale.lerp(targetPackedScale.current, lerpFactor);
        // Apply vertical slide offset
        packedGroupRef.current.position.y = currentPackedYOffset.current;
        // Apply dynamic opacity to all items in group
        packedGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isPackedItem) {
            if (child.material instanceof THREE.Material) {
              child.material.opacity = child.userData.isPalletWood
                ? Math.min(0.9, currentPackedOpacity.current * 1.3)
                : currentPackedOpacity.current;
            }
          }
        });
      }

      if (sceneRef.current) {
        const lines = sceneRef.current.getObjectByName("ContainerLines") as THREE.LineSegments;
        if (lines && lines.material instanceof THREE.LineBasicMaterial) {
            if (highlightRef.current) {
                // Pulsating glow effect
                const glow = 0.5 + 0.5 * Math.sin(time * 6);
                lines.material.opacity = 0.5 + glow * 0.5;
                const baseColor = new THREE.Color(0x00ffcc);
                const brightColor = new THREE.Color(0xffffff);
                lines.material.color.lerpColors(baseColor, brightColor, glow * 0.4);
            } else if (lines.material.opacity !== 0.9) {
                // Reset state when highlight is toggled off
                lines.material.opacity = 0.9;
                lines.material.color.setHex(0xffffff);
            }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      canvas.removeEventListener('pointerup', onCanvasPointerUp);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      cancelAnimationFrame(animationId);
      if (mountNode) {
        if (renderer.domElement.parentNode === mountNode) mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []); // Run once on mount

  // Update logic on props change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Helper to dispose objects
    const disposeNode = (node: THREE.Object3D) => {
        node.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            } else if (child instanceof THREE.LineSegments) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    };

    // Remove old elements only if structural change
    const isShowingPacked = result && result.count > 0;
    
    // Logic to manage packed group (fully recreated on result change for simplicity/correctness)
    if (packedGroupRef.current) {
      disposeNode(packedGroupRef.current);
      scene.remove(packedGroupRef.current);
      packedGroupRef.current = null;
    }

    // Logic to manage main box visibility and existence
    if (isShowingPacked && mainBoxRef.current) {
       disposeNode(mainBoxRef.current);
       scene.remove(mainBoxRef.current);
       mainBoxRef.current = null;
    } else if (!isShowingPacked && containerWireframeRef.current) {
       disposeNode(containerWireframeRef.current);
       scene.remove(containerWireframeRef.current);
       containerWireframeRef.current = null;
    }


    if (!result || result.count === 0) {
      // Just show the main item box
      const { length: l, width: w, height: h } = item;
      const targetL = parseFloat(l.toString()) || 0.1;
      const targetH = parseFloat(h.toString()) || 0.1;
      const targetW = parseFloat(w.toString()) || 0.1;
      
      targetItemScale.current.set(targetL, targetH, targetW);
      
      if (!mainBoxRef.current) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x38bdf8, 
            transparent: true,
            opacity: 0.9
        });
        
        const mainBox = new THREE.Mesh(geometry, material);
        // Initial state
        mainBox.scale.copy(targetItemScale.current);
        mainBox.position.y = targetItemScale.current.y / 2;
        scene.add(mainBox);
        
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }));
        mainBox.add(line);
        mainBoxRef.current = mainBox;
      }
    } else {
      // Show visualization of packing layout
      const { length: cL, width: cW, height: cH } = container;
      const targetCL = parseFloat(cL.toString()) || 1;
      const targetCH = parseFloat(cH.toString()) || 1;
      const targetCW = parseFloat(cW.toString()) || 1;
      
      targetContainerScale.current.set(targetCL, targetCH, targetCW);
      targetPackedScale.current.set(1, 1, 1);

      if (!containerWireframeRef.current) {
        const contGroup = new THREE.Group();
        const contGeo = new THREE.BoxGeometry(1, 1, 1);
        const contMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.1,
            side: THREE.BackSide,
            depthWrite: false
        });
        const contMesh = new THREE.Mesh(contGeo, contMat);
        contGroup.add(contMesh);

        const contEdges = new THREE.EdgesGeometry(contGeo);
        const contLines = new THREE.LineSegments(contEdges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.9, transparent: true, depthWrite: false }));
        contLines.name = "ContainerLines";
        contGroup.add(contLines);
        
        contGroup.scale.copy(targetContainerScale.current);
        contGroup.position.y = targetContainerScale.current.y / 2;
        scene.add(contGroup);
        containerWireframeRef.current = contGroup;
      }

      const packedGroup = new THREE.Group();
      const displayLimit = Math.min(result.count, 2000); // Increased display limit for smaller items
      let created = 0;

      for (const pItem of result.items) {
          if (created >= displayLimit) break;
          
          const isItem2 = pItem.type === 2;
          const originalDx = pItem.originalDx ?? pItem.dx;
          const originalDy = pItem.originalDy ?? pItem.dy;
          const originalDz = pItem.originalDz ?? pItem.dz;

          const itemGeo = new THREE.BoxGeometry(originalDx, originalDz, originalDy);
          const itemMat = new THREE.MeshPhongMaterial({ 
              color: isItem2 ? 0x10b981 : 0x38bdf8, // Emerald Green for Item 2, Sky Blue for Item 1
              transparent: true, 
              opacity: 0, // Starts at 0 for fade-in
              polygonOffset: true,
              polygonOffsetFactor: 4,
              polygonOffsetUnits: 4,
              depthWrite: true
          });
          const m = new THREE.Mesh(itemGeo, itemMat);
          m.userData = { isPackedItem: true, type: pItem.type };
          
          // Positioning from corner (centered horizontally, bottom-aligned inside its slot)
          m.position.set(
              (-cL / 2) + pItem.x + (pItem.dx / 2),
              pItem.z + (originalDz / 2),
              (-cW / 2) + pItem.y + (pItem.dy / 2)
          );

          const e = new THREE.EdgesGeometry(itemGeo);
          const l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.3, transparent: true}));
          m.add(l);

          packedGroup.add(m);
          created++;
      }

      // Render wooden pallets if present in result
      if (result.pallets && result.pallets.length > 0) {
        for (const pPallet of result.pallets) {
          const pGroup = createDetailedPallet(
            pPallet.dx,
            pPallet.dy,
            pPallet.dz,
            (-cL / 2) + pPallet.x + (pPallet.dx / 2),
            pPallet.z + (pPallet.dz / 2),
            (-cW / 2) + pPallet.y + (pPallet.dy / 2)
          );
          packedGroup.add(pGroup);
        }
      }

      // Start from slight offset and zero opacity for a "entry" animation
      packedGroup.scale.set(1, 1, 1);
      targetPackedScale.current.set(1, 1, 1);
      
      // Trigger animations
      currentPackedOpacity.current = 0;
      targetPackedOpacity.current = 0.65;
      currentPackedYOffset.current = 2; // Start slightly above/below for slide
      targetPackedYOffset.current = 0;
      
      scene.add(packedGroup);
      packedGroupRef.current = packedGroup;
    }

    // Auto-fit camera if unit/scale changes drastically
    if (cameraRef.current && controlsRef.current) {
      const parsedCL = parseFloat(container.length.toString()) || 1;
      const parsedCH = parseFloat(container.height.toString()) || 1;
      const parsedCW = parseFloat(container.width.toString()) || 1;
      const maxDim = Math.max(parsedCL, parsedCH, parsedCW);
      
      const currentCamDist = cameraRef.current.position.length();
      if (currentCamDist < maxDim * 0.5 || currentCamDist > maxDim * 4) {
        cameraRef.current.position.set(maxDim * 1.4, maxDim * 1.3, maxDim * 1.4);
        controlsRef.current.target.set(0, parsedCH / 2, 0);
        controlsRef.current.update();
      }
    }
  }, [item, container, result, unit]);



  // Rendering logic for bottom-right face viewer
  const renderFaceViewer = () => {
    if (!selectedFace) return null;
    
    // Determine effective unit
    const effectiveUnit = itemUnit;
    
    // Convert if necessary
    const convertVal = (val: number, from: 'cm' | 'in' | 'ft', to: 'cm' | 'in' | 'ft') => {
      if (from === to) return val;
      let cm = val;
      if (from === 'in') cm = val * 2.54;
      else if (from === 'ft') cm = val * 30.48;

      if (to === 'cm') return cm;
      if (to === 'in') return cm / 2.54;
      if (to === 'ft') return cm / 30.48;
      return val;
    };
    
    let displayW = convertVal(selectedFace.width, unit, effectiveUnit);
    let displayH = convertVal(selectedFace.height, unit, effectiveUnit);

    const maxDim = 140; // Max size for the view
    const scale = maxDim / Math.max(displayW, displayH);
    const viewW = displayW * scale;
    const viewH = displayH * scale;

    return (
      <div className="absolute top-4 left-4 md:top-auto md:bottom-6 md:right-6 md:left-auto bg-slate-900/90 border border-slate-700/50 rounded-xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-5 md:slide-in-from-bottom-5 fade-in duration-300 pointer-events-none scale-90 md:scale-100 origin-top-left md:origin-bottom-right">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              2D View (Selected Face)
            </h3>
        </div>
        
        <div className="flex flex-col items-center justify-center p-2 min-w-[160px] min-h-[160px]">
          <div className="text-sky-400/80 text-[11px] font-mono mb-1">{displayW.toFixed(1)} {effectiveUnit}</div>
          <div className="flex items-center gap-2">
            <div className="text-sky-400/80 text-[11px] font-mono -rotate-90 origin-center whitespace-nowrap">{displayH.toFixed(1)} {effectiveUnit}</div>
            
            <div 
              className="relative border-2 border-sky-400/60 bg-sky-500/10 shadow-[0_0_15px_rgba(56,189,248,0.15)] flex items-center justify-center transition-all duration-500 ease-out"
              style={{
                width: `${Math.max(1, viewW)}px`,
                height: `${Math.max(1, viewH)}px`
              }}
            >
              <div className="absolute opacity-0 hover:opacity-100 transition-opacity inset-0 flex items-center justify-center bg-sky-500/20">
                 <span className="text-sky-200 text-xs font-mono font-medium drop-shadow-md">
                   Area: {(displayW * displayH).toFixed(1)}
                 </span>
              </div>
            </div>
            {/* Spacer to balance the rotated height text */}
            <div className="w-[11px] opacity-0 overflow-hidden">{displayH.toFixed(1)}</div> 
          </div>
        </div>
        
        <div className="mt-2 text-center">
            <p className="text-[10px] text-slate-500">Select another face to update</p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mountRef} className="w-full h-full radial-bg" />
      {renderFaceViewer()}
    </div>
  );
}
