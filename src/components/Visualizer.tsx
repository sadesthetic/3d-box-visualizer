import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Dimensions, PackingResult } from '../lib/packing';

interface VisualizerProps {
  item: Dimensions;
  container: Dimensions;
  result: PackingResult;
  unit: 'in' | 'cm';
  itemUnit: 'in' | 'cm';
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

  useEffect(() => {
    highlightRef.current = highlightContainer;
  }, [highlightContainer]);

  const [selectedFace, setSelectedFace] = useState<{ width: number, height: number } | null>(null);
  const pointerDownPos = useRef<{ x: number, y: number } | null>(null);

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
    controls.enablePan = false;
    controlsRef.current = controls;

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

      mainBoxRef.current = mainBox;
    } else {
      // Show visualization of packing layout
      const { length: cL, width: cW, height: cH } = container;
      const contGroup = new THREE.Group();
      
      // Box geometry for the container
      const contGeo = new THREE.BoxGeometry(cL, cH, cW);
      
      // Translucent container faces
      const contMat = new THREE.MeshPhysicalMaterial({ 
          color: 0xffffff, 
          transparent: true, 
          opacity: 0.05,
          side: THREE.BackSide,
      });
      const contMesh = new THREE.Mesh(contGeo, contMat);
      contGroup.add(contMesh);

      // Thicker and brighter edges for container to understand context better
      const contEdges = new THREE.EdgesGeometry(contGeo);
      
      const contLines = new THREE.LineSegments(
          contEdges, 
          new THREE.LineBasicMaterial({ 
              color: 0xffffff, 
              opacity: 0.9, 
              transparent: true, 
              depthWrite: false 
          })
      );
      // Let's name the component to easily find it later
      contLines.name = "ContainerLines";
      contGroup.add(contLines);

      contGroup.position.y = cH / 2;
      scene.add(contGroup);
      containerWireframeRef.current = contGroup;

      const packedGroup = new THREE.Group();
      const displayLimit = Math.min(result.count, 2000); // Increased display limit for smaller items
      let created = 0;

      for (const pItem of result.items) {
          if (created >= displayLimit) break;
          
          // Map to Three.js axes: X=length, Y=height(Z), Z=width(Y)
          const itemGeo = new THREE.BoxGeometry(pItem.dx, pItem.dz, pItem.dy);
          const itemMat = new THREE.MeshPhongMaterial({ 
              color: 0x38bdf8, 
              transparent: true, 
              opacity: 0.6,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1
          });
          const m = new THREE.Mesh(itemGeo, itemMat);
          
          // Positioning from corner
          m.position.set(
              (-cL / 2) + pItem.x + (pItem.dx / 2),
              pItem.z + (pItem.dz / 2),
              (-cW / 2) + pItem.y + (pItem.dy / 2)
          );

          const e = new THREE.EdgesGeometry(itemGeo);
          const l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({color: 0xffffff, opacity: 0.3, transparent: true}));
          m.add(l);

          // We also need to add userData to the mesh for the 2D viewer click logic
          m.userData = { isPackedItem: true };

          packedGroup.add(m);
          created++;
      }

      scene.add(packedGroup);
      packedGroupRef.current = packedGroup;
    }
  }, [item, container, result, unit]);

  // Handle Raycasting for Face clicking
  const handleClick = (e: React.MouseEvent | React.PointerEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    
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
            // mainBox uses scale (length, height, width mapping)
            dimX = obj.scale.x; 
            dimY = obj.scale.y; 
            dimZ = obj.scale.z; 
        } else {
            // packed objects use BoxGeometry sizes directly based on specific orientation
            const geo = obj.geometry as THREE.BoxGeometry;
            dimX = geo.parameters.width;
            dimY = geo.parameters.height;
            dimZ = geo.parameters.depth;
        }

        const absNormal = new THREE.Vector3(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
        let faceW = 0, faceH = 0;

        if (absNormal.x > 0.5) {
            faceW = dimZ; // Face spanning Z and Y
            faceH = dimY;
        } else if (absNormal.y > 0.5) {
            faceW = dimX; // Face spanning X and Z
            faceH = dimZ;
        } else if (absNormal.z > 0.5) {
            faceW = dimX; // Face spanning X and Y
            faceH = dimY;
        }
        
        setSelectedFace({ width: faceW, height: faceH });
    } else {
        setSelectedFace(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownPos.current) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist < 5) {
        handleClick(e);
    }
    pointerDownPos.current = null;
  };

  // Rendering logic for bottom-right face viewer
  const renderFaceViewer = () => {
    if (!selectedFace) return null;
    
    // Determine effective unit
    const effectiveUnit = itemUnit;
    
    // Convert if necessary
    let displayW = selectedFace.width;
    let displayH = selectedFace.height;
    
    if (unit === 'in' && effectiveUnit === 'cm') {
       displayW *= 2.54;
       displayH *= 2.54;
    } else if (unit === 'cm' && effectiveUnit === 'in') {
       displayW /= 2.54;
       displayH /= 2.54;
    }

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
    <div className="w-full h-full relative" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <div ref={mountRef} className="w-full h-full radial-bg" />
      {renderFaceViewer()}
    </div>
  );
}
