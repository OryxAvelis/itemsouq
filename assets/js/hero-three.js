const host = document.querySelector('[data-hero-three]');
const showcase = host?.closest('.hero-showcase');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const saveData = Boolean(navigator.connection?.saveData);

if (host && showcase && !reduceMotion.matches && !saveData) {
  const probe = document.createElement('canvas');
  const supportsWebGL2 = Boolean(probe.getContext('webgl2'));

  if (supportsWebGL2) {
    initHeroScene().catch(() => {
      host.dataset.threeState = 'fallback';
      host.replaceChildren();
    });
  } else {
    host.dataset.threeState = 'unsupported';
  }
}

async function initHeroScene() {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js');
  const compactViewport = window.matchMedia('(max-width: 680px)');
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-three-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  host.append(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !compactViewport.matches,
    depth: false,
    stencil: false,
    powerPreference: 'low-power'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
  camera.position.z = 5.6;

  const effectGroup = new THREE.Group();
  effectGroup.rotation.x = -0.08;
  scene.add(effectGroup);

  let randomSeed = 0x1f2e3d4c;
  const random = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  };

  const createParticles = (count, color, size, opacity, spread, depthOffset) => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = spread.min + random() * (spread.max - spread.min);
      const verticalScale = 0.68 + random() * 0.18;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle) * radius * verticalScale;
      positions[index * 3 + 2] = depthOffset + (random() - 0.5) * 1.15;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });
    const particles = new THREE.Points(geometry, material);
    effectGroup.add(particles);
    return particles;
  };

  const createOrbit = (radius, color, opacity, rotation) => {
    const segments = compactViewport.matches ? 72 : 120;
    const points = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });
    const orbit = new THREE.LineLoop(geometry, material);
    orbit.rotation.set(rotation.x, rotation.y, rotation.z);
    orbit.scale.y = rotation.scaleY;
    effectGroup.add(orbit);
    return orbit;
  };

  const particleCount = compactViewport.matches ? 30 : 56;
  const purpleParticles = createParticles(
    particleCount,
    0x9f83ff,
    compactViewport.matches ? 0.038 : 0.046,
    0.72,
    { min: 1.45, max: 2.75 },
    -0.15
  );
  const greenParticles = createParticles(
    Math.round(particleCount * 0.52),
    0x3fe19a,
    compactViewport.matches ? 0.034 : 0.042,
    0.66,
    { min: 1.7, max: 2.85 },
    0.1
  );

  const purpleOrbit = createOrbit(1.9, 0x8062ff, 0.28, {
    x: 0.82,
    y: 0.12,
    z: -0.18,
    scaleY: 0.86
  });
  const greenOrbit = createOrbit(2.26, 0x31d991, 0.18, {
    x: 1.08,
    y: -0.28,
    z: 0.38,
    scaleY: 0.78
  });
  const outerOrbit = createOrbit(2.62, 0xc4b6ff, 0.11, {
    x: 0.66,
    y: 0.34,
    z: -0.48,
    scaleY: 0.74
  });

  let visible = !('IntersectionObserver' in window);
  let running = false;
  let renderedOnce = false;
  const pointer = { x: 0, y: 0 };
  const targetPointer = { x: 0, y: 0 };

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const pixelRatioLimit = compactViewport.matches ? 1 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = (time) => {
    const seconds = time * 0.001;
    pointer.x += (targetPointer.x - pointer.x) * 0.035;
    pointer.y += (targetPointer.y - pointer.y) * 0.035;

    effectGroup.rotation.x = -0.08 + pointer.y * 0.075;
    effectGroup.rotation.y = pointer.x * 0.1;
    effectGroup.rotation.z = seconds * 0.018;
    purpleParticles.rotation.z = -seconds * 0.027;
    greenParticles.rotation.z = seconds * 0.034;
    purpleOrbit.rotation.z = -0.18 + seconds * 0.035;
    greenOrbit.rotation.z = 0.38 - seconds * 0.028;
    outerOrbit.rotation.z = -0.48 + seconds * 0.018;

    renderer.render(scene, camera);
    if (!renderedOnce) {
      renderedOnce = true;
      host.dataset.threeState = 'ready';
      host.classList.add('is-ready');
    }
  };

  const syncLoop = () => {
    const shouldRun = visible && !document.hidden && !reduceMotion.matches;
    if (shouldRun === running) return;
    running = shouldRun;
    renderer.setAnimationLoop(running ? render : null);
  };

  const handlePointerMove = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const bounds = showcase.getBoundingClientRect();
    targetPointer.x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    targetPointer.y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
  };

  const resetPointer = () => {
    targetPointer.x = 0;
    targetPointer.y = 0;
  };

  const visibilityObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        syncLoop();
      }, { threshold: 0.08 })
    : null;
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;

  resize();
  visibilityObserver?.observe(showcase);
  resizeObserver?.observe(host);
  showcase.addEventListener('pointermove', handlePointerMove, { passive: true });
  showcase.addEventListener('pointerleave', resetPointer, { passive: true });
  document.addEventListener('visibilitychange', syncLoop);
  reduceMotion.addEventListener?.('change', syncLoop);
  compactViewport.addEventListener?.('change', resize);
  syncLoop();
}
