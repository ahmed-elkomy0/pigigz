import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type GlobePlace = { gigId: number; lat: number; lng: number };

/* ------------------------------------------------------------------ */
/* Stylized earth texture, drawn on a canvas in equirectangular       */
/* projection so the continent polygons line up with real lat/lng     */
/* marker positions. Simplified continent outlines, brand palette:    */
/* deep blue-plum ocean, sandy-gold land, pale ice caps.               */
/* ------------------------------------------------------------------ */

type Poly = [number, number][];

const LAND: Poly[] = [
  // North America
  [
    [-168, 66], [-158, 71], [-145, 70], [-130, 71], [-115, 68], [-100, 69],
    [-90, 69], [-82, 66], [-80, 62], [-78, 58], [-76, 50], [-70, 45],
    [-68, 44], [-70, 41], [-74, 39], [-75, 35], [-76, 30], [-80, 26],
    [-81, 25], [-82, 28], [-84, 30], [-89, 29], [-94, 29], [-97, 26],
    [-97, 22], [-94, 18], [-90, 15], [-86, 13], [-83, 9], [-79, 9],
    [-78, 7], [-80, 8], [-84, 11], [-88, 14], [-92, 15], [-96, 16],
    [-101, 18], [-105, 20], [-108, 23], [-110, 24], [-112, 29],
    [-114, 31], [-117, 33], [-121, 34], [-122, 37], [-124, 42],
    [-124, 47], [-128, 51], [-133, 56], [-140, 60], [-152, 59],
    [-158, 56], [-162, 58], [-166, 60], [-168, 66],
  ],
  // Greenland
  [
    [-46, 60], [-42, 63], [-36, 66], [-30, 68], [-22, 70], [-18, 74],
    [-20, 78], [-28, 81], [-40, 81], [-52, 78], [-56, 73], [-54, 68],
    [-52, 63], [-50, 60], [-46, 60],
  ],
  // South America
  [
    [-77, 7], [-75, 10], [-72, 12], [-66, 11], [-61, 9], [-56, 6],
    [-51, 4], [-50, 0], [-46, -2], [-41, -4], [-35, -8], [-36, -11],
    [-39, -14], [-39, -18], [-41, -23], [-45, -24], [-48, -27],
    [-52, -33], [-56, -35], [-58, -38], [-62, -39], [-63, -41],
    [-65, -43], [-65, -46], [-67, -50], [-68, -53], [-70, -54],
    [-72, -53], [-73, -48], [-73, -42], [-72, -36], [-71, -31],
    [-70, -24], [-70, -19], [-71, -17], [-75, -15], [-76, -13],
    [-78, -9], [-79, -6], [-81, -3], [-81, 0], [-80, 3], [-77, 5],
    [-77, 7],
  ],
  // Africa
  [
    [-17, 15], [-16, 20], [-14, 25], [-11, 29], [-8, 32], [-6, 35],
    [-2, 35], [3, 37], [10, 37], [11, 34], [16, 32], [22, 33],
    [28, 31], [32, 31], [33, 29], [35, 24], [37, 20], [38, 17],
    [40, 15], [43, 12], [46, 11], [51, 12], [51, 9], [48, 5],
    [43, -1], [41, -6], [40, -12], [38, -18], [36, -22], [34, -27],
    [30, -31], [26, -34], [20, -35], [18, -33], [16, -29], [14, -23],
    [13, -17], [12, -12], [12, -7], [10, -2], [9, 3], [5, 5],
    [0, 6], [-4, 5], [-8, 5], [-12, 7], [-15, 10], [-17, 13],
    [-17, 15],
  ],
  // Madagascar
  [
    [44, -16], [47, -14], [50, -17], [49, -21], [47, -24], [45, -25],
    [44, -22], [43, -19], [44, -16],
  ],
  // Eurasia (Europe + Asia + Arabia, one simplified outline)
  [
    [-9, 43], [-9, 47], [-5, 49], [-2, 50], [1, 51], [4, 52], [7, 54],
    [8, 56], [10, 58], [6, 59], [5, 61], [6, 63], [11, 65], [15, 68],
    [22, 70], [32, 70], [45, 68], [58, 69], [70, 72], [82, 73],
    [95, 76], [105, 77], [115, 74], [128, 72], [142, 72], [155, 71],
    [168, 69], [178, 67], [179, 63], [170, 60], [161, 59], [159, 52],
    [153, 47], [144, 43], [141, 40], [140, 36], [136, 35], [131, 33],
    [128, 33], [126, 37], [123, 38], [121, 35], [121, 31], [122, 28],
    [118, 25], [113, 22], [109, 19], [107, 13], [106, 9], [104, 3],
    [101, 5], [100, 9], [98, 13], [95, 16], [92, 20], [89, 22],
    [87, 21], [84, 19], [81, 15], [79, 12], [77, 8], [75, 12],
    [73, 17], [72, 20], [69, 22], [66, 25], [61, 25], [58, 26],
    [56, 27], [59, 23], [57, 19], [54, 16], [50, 15], [45, 12],
    [43, 12], [41, 15], [39, 19], [36, 26], [34, 29], [34, 31],
    [36, 36], [31, 36], [28, 37], [24, 36], [20, 39], [17, 40],
    [14, 39], [13, 42], [10, 44], [7, 44], [3, 43], [-1, 38],
    [-5, 36], [-8, 37], [-9, 39], [-9, 43],
  ],
  // Indonesia / SE Asia islands (simplified blobs)
  [
    [96, 5], [100, 2], [104, -2], [107, -5], [105, -6], [101, -3],
    [97, 2], [96, 5],
  ],
  [
    [110, 1], [114, 3], [118, 2], [119, -1], [115, -3], [111, -2],
    [110, 1],
  ],
  [
    [120, 0], [124, 1], [128, 0], [131, -1], [136, -2], [141, -3],
    [146, -6], [150, -9], [147, -9], [142, -5], [136, -4],
    [130, -3], [124, -2], [120, 0],
  ],
  // Australia
  [
    [114, -22], [113, -26], [115, -32], [117, -35], [122, -34],
    [128, -32], [133, -32], [136, -35], [138, -36], [140, -38],
    [144, -38], [147, -38], [150, -37], [152, -33], [153, -29],
    [153, -25], [150, -22], [146, -19], [143, -15], [142, -11],
    [141, -14], [140, -18], [137, -16], [136, -12], [133, -11],
    [129, -14], [126, -14], [123, -17], [120, -19], [117, -20],
    [114, -22],
  ],
];

function drawEarthTexture(): HTMLCanvasElement {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, "#274b73");
  ocean.addColorStop(0.5, "#173763");
  ocean.addColorStop(1, "#1d2f57");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);

  const px = (lng: number) => ((lng + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;

  // Graticule
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let lng = -180; lng <= 180; lng += 30) {
    ctx.beginPath();
    ctx.moveTo(px(lng), 0);
    ctx.lineTo(px(lng), H);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    ctx.moveTo(0, py(lat));
    ctx.lineTo(W, py(lat));
    ctx.stroke();
  }

  // Land
  for (const poly of LAND) {
    ctx.beginPath();
    poly.forEach(([lng, lat], i) => {
      if (i === 0) ctx.moveTo(px(lng), py(lat));
      else ctx.lineTo(px(lng), py(lat));
    });
    ctx.closePath();
    ctx.fillStyle = "#c8a45f";
    ctx.fill();
    ctx.strokeStyle = "rgba(59,17,69,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,244,214,0.18)";
    ctx.fill();
  }

  // Ice caps
  ctx.fillStyle = "rgba(240,246,252,0.92)";
  ctx.fillRect(0, 0, W, py(80));
  ctx.fillRect(0, py(-76), W, H - py(-76));

  return canvas;
}

function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const theta = ((90 - lat) * Math.PI) / 180;
  const phi = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function makePinSprite(label: string, selected: boolean): THREE.Sprite {
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
    ctx.fillStyle = selected ? "#3b1145" : "#f2a900";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = selected ? "#f2a900" : "#3b1145";
    ctx.font = `900 ${label.length > 1 ? 62 : 76}px Cairo, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, size / 2, size / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(selected ? 0.21 : 0.16);
  return sprite;
}

function makeDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.7)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/* ------------------------------------------------------------------ */

export default function GlobeView({
  places,
  selected,
  onSelect,
  onFail,
  ariaLabel,
}: {
  places: GlobePlace[];
  selected: number | null;
  onSelect: (index: number) => void;
  onFail: () => void;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  const sceneRef = useRef<{
    markers: THREE.Group;
    hitMeshes: THREE.Mesh[];
    sprites: THREE.Sprite[];
    renderer: THREE.WebGLRenderer;
  } | null>(null);

  const placesKey = places.map((p) => `${p.gigId}:${p.lat},${p.lng}`).join("|");
  const placesRef = useRef(places);
  placesRef.current = places;

  // Init scene once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onFailRef.current();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#140a20");

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0.6, 0.7, 2.9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.55;
    controls.maxDistance = 4.6;
    controls.rotateSpeed = 0.55;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.55;
    let idleTimer: number | undefined;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      window.clearTimeout(idleTimer);
      renderer.domElement.style.cursor = "grabbing";
    });
    controls.addEventListener("end", () => {
      renderer.domElement.style.cursor = "grab";
      if (!reducedMotion) {
        idleTimer = window.setTimeout(() => {
          controls.autoRotate = true;
        }, 3000);
      }
    });

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xfff2d9, 1.6);
    key.position.set(4, 2, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf2a900, 0.5);
    rim.position.set(-4, -1, -3);
    scene.add(rim);

    // Earth
    const earthTex = new THREE.CanvasTexture(drawEarthTexture());
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthTex.anisotropy = 4;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.85, metalness: 0.05 }),
    );
    scene.add(earth);

    // Atmosphere glow
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            gl_FragColor = vec4(0.95, 0.66, 0.1, 1.0) * intensity;
          }`,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    scene.add(atmosphere);

    // Stars
    const starCount = 700;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(14 + Math.random() * 18);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        size: 0.14,
        map: makeDotTexture(),
        transparent: true,
        depthWrite: false,
        color: 0xffe9bd,
        sizeAttenuation: true,
      }),
    );
    scene.add(stars);

    const markers = new THREE.Group();
    scene.add(markers);
    sceneRef.current = { markers, hitMeshes: [], sprites: [], renderer };

    // Raycast picking: treat as a tap only if the pointer barely moved,
    // so dragging to spin the globe never opens a gig by accident.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(downX - e.clientX, downY - e.clientY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const state = sceneRef.current;
      if (!state) return;
      const hits = raycaster.intersectObjects(state.hitMeshes, false);
      const first = hits[0];
      if (first) {
        const idx = first.object.userData.index as number;
        onSelectRef.current(idx);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      try {
        controls.update();
        // Gentle pulse on the selected pin.
        const state = sceneRef.current;
        if (state) {
          const sel = selectedRef.current;
          state.sprites.forEach((s, i) => {
            if (i === sel) {
              const pulse = 0.21 + Math.sin(now / 280) * 0.02;
              s.scale.setScalar(pulse);
            }
          });
        }
        stars.rotation.y += dt * 0.004;
        renderer.render(scene, camera);
      } catch {
        // Keep the loop alive on transient render errors.
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
          obj.geometry?.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      earthTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // (Re)build markers when the place set changes.
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    const { markers } = state;
    for (const child of [...markers.children]) {
      markers.remove(child);
    }
    state.hitMeshes = [];
    state.sprites = [];
    placesRef.current.forEach((p, i) => {
      const pos = latLngToVec3(p.lat, p.lng, 1.012);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      dot.position.copy(pos);
      markers.add(dot);

      const sprite = makePinSprite(String(i + 1), i === selectedRef.current);
      sprite.position.copy(latLngToVec3(p.lat, p.lng, 1.07));
      markers.add(sprite);
      state.sprites.push(sprite);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.copy(latLngToVec3(p.lat, p.lng, 1.03));
      hit.userData.index = i;
      markers.add(hit);
      state.hitMeshes.push(hit);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey]);

  // Refresh pin styling when the selection changes.
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.sprites.forEach((sprite, i) => {
      const fresh = makePinSprite(String(i + 1), i === selected);
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
      (sprite.material as THREE.SpriteMaterial).map = (
        fresh.material as THREE.SpriteMaterial
      ).map;
      (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
      sprite.scale.setScalar(i === selected ? 0.21 : 0.16);
    });
  }, [selected, placesKey]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className="h-[400px] w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[#140a20] sm:h-[480px]"
    />
  );
}
