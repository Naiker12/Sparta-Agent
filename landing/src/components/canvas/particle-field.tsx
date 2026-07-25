import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function ParticleField() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060f, 0.0018);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    camera.position.set(0, 120, 280);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 4. Undulating Blueprint Grid Math
    const cols = 50;
    const rows = 50;
    const spacing = 18;
    const particleCount = cols * rows;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorViolet = new THREE.Color('#663af3');
    const colorBlue = new THREE.Color('#b6d9fc');
    const colorWhite = new THREE.Color('#d1e4fa');

    // Initial position & color setup
    let index = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = (c - cols / 2) * spacing;
        const z = (r - rows / 2) * spacing;
        const y = 0;

        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;

        // Gradient coloring: Violet in the center fading to Blueprint Blue/White at the edges
        const distFromCenter = Math.sqrt(x * x + z * z);
        const maxDist = Math.sqrt(
          (cols / 2 * spacing) ** 2 + (rows / 2 * spacing) ** 2
        );
        const ratio = Math.min(distFromCenter / maxDist, 1);

        const mixedColor = colorViolet.clone().lerp(
          c % 2 === 0 ? colorBlue : colorWhite,
          ratio
        );

        colors[index * 3] = mixedColor.r;
        colors[index * 3 + 1] = mixedColor.g;
        colors[index * 3 + 2] = mixedColor.b;

        // Custom size variation
        sizes[index] = Math.random() * 2 + 1;

        index++;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom shader material for glowing round points instead of square pixels
    const pointTexture = new THREE.TextureLoader().load(
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="white"/></svg>'
    );

    const material = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      map: pointTexture,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 5. Additional Floating Data Nodes (Brighter glowing packets)
    const nodeCount = 40;
    const nodeGeometry = new THREE.BufferGeometry();
    const nodePositions = new Float32Array(nodeCount * 3);
    const nodeColors = new Float32Array(nodeCount * 3);
    const nodeSpeeds = new Float32Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
      nodePositions[i * 3] = (Math.random() - 0.5) * 800;
      nodePositions[i * 3 + 1] = Math.random() * 100 - 30;
      nodePositions[i * 3 + 2] = (Math.random() - 0.5) * 800;

      // Packets are bright Void Violet or Pure White
      const c = Math.random() > 0.5 ? colorViolet : colorWhite;
      nodeColors[i * 3] = c.r;
      nodeColors[i * 3 + 1] = c.g;
      nodeColors[i * 3 + 2] = c.b;

      nodeSpeeds[i] = Math.random() * 0.4 + 0.1;
    }

    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));

    const nodeMaterial = new THREE.PointsMaterial({
      size: 6.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      map: pointTexture,
      depthWrite: false
    });

    const dataNodes = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(dataNodes);

    // 6. Interactive Mouse Ripple
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      targetMouseX = (event.clientX - window.innerWidth / 2) * 0.08;
      targetMouseY = (event.clientY - window.innerHeight / 2) * 0.08;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 7. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const nodePositionAttribute = nodeGeometry.getAttribute('position') as THREE.BufferAttribute;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse interpolation (Damping)
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      // Dynamic Camera Path
      camera.position.x = mouseX * 0.8;
      camera.position.y = 120 + Math.sin(elapsedTime * 0.2) * 15 - mouseY * 0.2;
      camera.lookAt(0, 15, 0);

      // Undulate Grid Particles: z-wave math
      const posArray = positionAttribute.array as Float32Array;
      let idx = 0;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = posArray[idx * 3];
          const z = posArray[idx * 3 + 2];

          // Complex double sin/cos wave pattern representing computational flow
          const ripple = Math.sin(x * 0.015 + elapsedTime * 0.8) * Math.cos(z * 0.015 + elapsedTime * 0.6) * 22;
          const localRipple = Math.sin(Math.sqrt(x*x + z*z) * 0.008 - elapsedTime * 1.2) * 12;

          posArray[idx * 3 + 1] = ripple + localRipple;
          idx++;
        }
      }
      positionAttribute.needsUpdate = true;

      // Move data packets upward
      const nodePosArray = nodePositionAttribute.array as Float32Array;
      for (let i = 0; i < nodeCount; i++) {
        nodePosArray[i * 3 + 1] += nodeSpeeds[i];
        
        // Wrap around when rising too high
        if (nodePosArray[i * 3 + 1] > 180) {
          nodePosArray[i * 3] = (Math.random() - 0.5) * 800;
          nodePosArray[i * 3 + 1] = -50;
          nodePosArray[i * 3 + 2] = (Math.random() - 0.5) * 800;
        }
      }
      nodePositionAttribute.needsUpdate = true;

      // Slow orbital rotate
      particles.rotation.y = elapsedTime * 0.012;
      dataNodes.rotation.y = elapsedTime * 0.015;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Handle Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // 9. Memory Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-60"
    />
  );
}
