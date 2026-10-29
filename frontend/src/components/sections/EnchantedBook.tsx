'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, CanvasProps, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { SUBTRACTION, ADDITION, Brush, Evaluator } from 'three-bvh-csg';

type BookPart = {
  size: [number, number, number];
  position: [number, number, number];
  color: number;
  roughness: number;
  metalness: number;
};

const BOOK_PARTS: BookPart[] = [
  // Back cover
  {
    size: [1.2, 1.5, 0.04],
    position: [0, 0, -0.11],
    color: 0xd0452c,
    roughness: 0.55,
    metalness: 0.1,
  },
  // White page block
  {
    size: [1.12, 1.42, 0.18],
    position: [0, 0, 0],
    color: 0xf7f2e6,
    roughness: 0.9,
    metalness: 0.0,
  },
  // Front cover
  {
    size: [1.2, 1.5, 0.04],
    position: [0, 0, 0.11],
    color: 0xd0452c,
    roughness: 0.55,
    metalness: 0.1,
  },
  // Spine (reliure)
  {
    size: [0.06, 1.5, 0.26],
    position: [-0.6, 0, 0],
    color: 0xd0452c,
    roughness: 0.55,
    metalness: 0.1,
  },
];

/**
 * Générateur de texture pixelisée procédurale (style dither / retro)
 */
function usePixelTexture(width = 32, height = 32) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const val = Math.floor(Math.random() * 40) + 215; // Bruit subtil
        ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }, [width, height]);
}

/**
 * Fonction qui prend les parties du livre et renvoie un Mesh UNIQUE
 * résultant de l'union booléenne (CSG) de toutes les pièces.
 */
function createAdditiveMesh(
  thickness: number,
  material: THREE.Material,
): THREE.Mesh {
  const evaluator = new Evaluator();
  let resultBrush: Brush | null = null;

  BOOK_PARTS.forEach((part) => {
    const sizeWithThickness: [number, number, number] = [
      part.size[0] + 2 * thickness,
      part.size[1] + 2 * thickness,
      part.size[2] + 2 * thickness,
    ];

    const geo = new THREE.BoxGeometry(...sizeWithThickness);
    geo.translate(...part.position);

    const brush = new Brush(geo);

    if (!resultBrush) {
      resultBrush = brush;
    } else {
      resultBrush = evaluator.evaluate(resultBrush, brush, ADDITION);
    }
  });

  const mergedGeometry = resultBrush
    ? resultBrush.geometry
    : new THREE.BufferGeometry();

  mergedGeometry.computeVertexNormals();

  return new THREE.Mesh(mergedGeometry, material);
}

function GlowEffect({ thickness = 0.05 }: { thickness?: number }) {
  const pixelTexture = usePixelTexture(8, 8);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0xaa66ff) },
          uIntensity: { value: 1.2 },
          uBase: { value: 0.45 },
          uFresnelPower: { value: 2.0 },
          uFresnelBias: { value: 0.25 },
          uFresnelScale: { value: 0.8 },
          uPixelTex: { value: pixelTexture },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying vec2 vUv;

          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uIntensity;
          uniform float uBase;
          uniform float uFresnelPower;
          uniform float uFresnelBias;
          uniform float uFresnelScale;
          uniform sampler2D uPixelTex;

          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying vec2 vUv;

          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            float fresnel = pow(
              uFresnelBias + uFresnelScale * (1.0 - abs(dot(normalize(vNormal), viewDir))),
              uFresnelPower
            );
            float glow = uBase + fresnel;

            // Pulsation pixelisée (paliers discrets)
            float steppedTime = floor(uTime * 6.0) / 6.0;
            glow *= 1.0 + 0.12 * sin(steppedTime * 1.5);

            // Quantification de l'intensité (effet retro/posterized)
            glow = floor(glow * 4.0) / 4.0;

            // Bruit pixel-art
            vec4 tex = texture2D(uPixelTex, vUv * 8.0);

            vec3 color = uColor * glow * uIntensity * tex.rgb;
            float alpha = glow * 0.6;
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [pixelTexture],
  );

  const glowMesh = useMemo(() => {
    return createAdditiveMesh(thickness, material);
  }, [thickness, material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return <primitive object={glowMesh} />;
}

function Book({ onClick }: { onClick?: () => void }) {
  const bookRef = useRef<THREE.Group>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Stocke le point de départ pour mesurer la distance parcourue
  const pointerDownPos = useRef({ x: 0, y: 0 });
  
  const dragStart = useRef({ x: 0, y: 0 });
  const dragRotation = useRef({ x: 0, y: 0 });
  const autoRotation = useRef({ x: 0.66, y: -0.66 });

  const pixelTexture = usePixelTexture(32, 32);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      dragRotation.current.y = dx * 0.01;
      dragRotation.current.x = dy * 0.005;
    };

    const onPointerUp = (e: PointerEvent) => {
      setIsDragging(false);
      autoRotation.current.y += dragRotation.current.y;
      autoRotation.current.x += dragRotation.current.x;
      dragRotation.current.x = 0;
      dragRotation.current.y = 0;

      // Calcul de la distance parcourue pendant la pression
      const dist = Math.hypot(
        e.clientX - pointerDownPos.current.x,
        e.clientY - pointerDownPos.current.y
      );

      // Si le mouvement est minimal (< 5px), c'est un clic pur
      if (dist < 5 && onClick) {
        onClick();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging, onClick]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (!bookRef.current) return;

    if (isMobile) {
      bookRef.current.rotation.y = Math.sin(time * 0.3) * 0.15;
      bookRef.current.rotation.x = Math.sin(time * 0.2) * 0.05;
      bookRef.current.position.y = Math.sin(time * 0.5) * 0.05;
      return;
    }

    if (isDragging) {
      bookRef.current.rotation.y =
        autoRotation.current.y + dragRotation.current.y;
      bookRef.current.rotation.x =
        autoRotation.current.x + dragRotation.current.x;
    } else {
      const targetY = autoRotation.current.y + Math.sin(time * 0.3) * 0.1;
      const targetX = autoRotation.current.x + Math.sin(time * 0.2) * 0.03;
      bookRef.current.rotation.y = THREE.MathUtils.lerp(
        bookRef.current.rotation.y,
        targetY,
        0.04
      );
      bookRef.current.rotation.x = THREE.MathUtils.lerp(
        bookRef.current.rotation.x,
        targetX,
        0.04
      );
      bookRef.current.position.y = Math.sin(time * 0.5) * 0.05;
    }
  });

  return (
    <group
      ref={bookRef}
      position={[0, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => (
        e.stopPropagation(),
        (document.body.style.cursor = 'pointer')
      )}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {BOOK_PARTS.map((part, i) => (
        <mesh key={i} castShadow receiveShadow position={part.position}>
          <boxGeometry args={part.size} />
          <meshStandardMaterial
            color={part.color}
            roughness={part.roughness}
            metalness={part.metalness}
            map={pixelTexture}
            flatShading
          />
        </mesh>
      ))}

      <mesh position={[0, 0, 0.132]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial
          color={0xffd700}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          map={pixelTexture}
        />
      </mesh>

      <GlowEffect thickness={0.05} />
      <Runes />
    </group>
  );
}

function Runes() {
  const runes = 'Hactazia'.split('').sort(() => Math.random() - 0.5);

  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <RuneMesh key={i} index={i} rune={runes[i % runes.length]} />
      ))}
    </>
  );
}

function RuneMesh({ index, rune }: { index: number; rune: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const radius = 0.9;

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const angle = (index / 8) * Math.PI * 2 + time * 0.2;
    const height = Math.sin(time * 0.5 + index) * 0.3;

    meshRef.current.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius,
    );
    meshRef.current.rotation.set(0, -angle + Math.PI / 2, 0);
  });

  return (
    <mesh ref={meshRef} scale={0.15}>
      <Text3D text={rune} color={0xaa88ff} opacity={0.6} />
    </mesh>
  );
}

function Text3D({
  text,
  color,
  opacity,
}: {
  text: string;
  color: number;
  opacity: number;
}) {
  return (
    <Text
      fontSize={0.5}
      maxWidth={2}
      anchorX="center"
      anchorY="middle"
      color={color}
      opacity={opacity}
    >
      {text}
    </Text>
  );
}

export interface EnchantedBookProps {
  className?: string;
  onClick?: () => void;
  style?: CanvasProps['style']
}

export function EnchantedBook({ className, onClick, style }: EnchantedBookProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.2, 3.5], fov: 45 }}
      shadows
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    >
      <ambientLight intensity={0.8} />
      <Book onClick={onClick} />
    </Canvas>
  );
}