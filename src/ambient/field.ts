import * as THREE from 'three';
import { fragmentShader, vertexShader } from './fieldShader';

export interface FieldHandle {
  setAnchor(a: 'home' | 'diario'): void;
  setPointer(x: number, y: number): void;
  setBreath(v: number): void;
  setGlow(x: number, y: number, strength: number): void;
  dispose(): void;
}

const ANCHORS = { home: new THREE.Vector2(0.8, 0.85), diario: new THREE.Vector2(0.15, 0.4) };

export function startField(canvas: HTMLCanvasElement): FieldHandle | null {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const uniforms = {
    uRes: { value: new THREE.Vector2() },
    uAnchor: { value: ANCHORS.home.clone() },
    uPointer: { value: new THREE.Vector2() },
    uBreath: { value: 0 },
    uTime: { value: 0 },
    uGlow: { value: new THREE.Vector3(0, 0, 0) },
  };
  const target = {
    anchor: ANCHORS.home.clone(),
    pointer: new THREE.Vector2(),
    breath: 0,
    glow: new THREE.Vector3(0, 0, 0),
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })));

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  };
  resize();
  addEventListener('resize', resize);

  let raf = 0;
  const clock = new THREE.Clock();
  const frame = () => {
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uAnchor.value.lerp(target.anchor, 0.03);
    uniforms.uPointer.value.lerp(target.pointer, 0.06);
    uniforms.uBreath.value += (target.breath - uniforms.uBreath.value) * 0.05;
    uniforms.uGlow.value.lerp(target.glow, 0.08);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    setAnchor: (a) => target.anchor.copy(ANCHORS[a]),
    setPointer: (x, y) => target.pointer.set(x, y),
    setBreath: (v) => { target.breath = v; },
    setGlow: (x, y, s) => target.glow.set(x, y, s),
    dispose: () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
}
