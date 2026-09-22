"use client";

import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Edges, Grid, ContactShadows } from "@react-three/drei";
import { Posicao, nivelOcupacao } from "@/lib/types";

const COR_NIVEL: Record<string, string> = {
  cheio: "#3fa34d",
  medio: "#d98e2b",
  baixo: "#c1443c",
  vazio: "#333336",
};

const ANDARES = 6;
const ALTURA_CAIXA = 0.55;
const ESPACO_ANDAR = 0.68;
const ESPACO_COLUNA = 1.55;
const LARGURA_CAIXA = 1.15;
const PROFUNDIDADE_CAIXA = 0.85;

function CaixaAndar({
  p,
  x,
  y,
  onAbrir,
}: {
  p: Posicao | undefined;
  x: number;
  y: number;
  onAbrir: (p: Posicao) => void;
}) {
  const nivel = p ? nivelOcupacao(p) : "vazio";
  const cor = p ? COR_NIVEL[nivel] : "#1c1c1e";

  return (
    <group position={[x, y, 0]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          p && onAbrir(p);
        }}
        onPointerOver={(e) => p && ((document.body.style.cursor = "pointer"), e.stopPropagation())}
        onPointerOut={() => (document.body.style.cursor = "auto")}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[LARGURA_CAIXA, ALTURA_CAIXA, PROFUNDIDADE_CAIXA]} />
        <meshStandardMaterial color={cor} roughness={0.55} metalness={0.08} />
        <Edges color="#000000" opacity={0.4} transparent />
      </mesh>

      {p?.produto && (
        <Html position={[0, 0, 0.46]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(18,18,19,0.92)",
              border: "1px solid #333336",
              borderRadius: 6,
              padding: "2px 6px",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }}
          >
            {p.imagem_base64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imagem_base64}
                alt=""
                style={{ width: 18, height: 18, borderRadius: 3, objectFit: "cover" }}
              />
            )}
            {p.tamanho && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#d4af17" }}>{p.tamanho}</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Estrutura de metal (postes + travessas) por trás dos cestos, pra dar cara de estante de verdade. */
function EstruturaRack({ x, altura }: { x: number; altura: number }) {
  const meioLargura = LARGURA_CAIXA * 0.5 + 0.06;
  const profundidadeMeio = PROFUNDIDADE_CAIXA * 0.5;
  const corMetal = "#2a2a2d";

  return (
    <group position={[x, 0, 0]}>
      {[-meioLargura, meioLargura].map((dx) =>
        [-profundidadeMeio, profundidadeMeio].map((dz) => (
          <mesh key={`${dx}-${dz}`} position={[dx, altura / 2, dz]} castShadow>
            <boxGeometry args={[0.06, altura, 0.06]} />
            <meshStandardMaterial color={corMetal} roughness={0.4} metalness={0.6} />
          </mesh>
        ))
      )}
      {Array.from({ length: ANDARES + 1 }, (_, i) => i).map((nivel) => (
        <mesh key={nivel} position={[0, nivel * ESPACO_ANDAR, 0]} receiveShadow>
          <boxGeometry args={[meioLargura * 2 + 0.06, 0.04, PROFUNDIDADE_CAIXA + 0.1]} />
          <meshStandardMaterial color={corMetal} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export default function Mapa3DRua({ colunas }: { colunas: [string, Posicao[]][] }) {
  const router = useRouter();

  function abrir(p: Posicao) {
    router.push(`/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`);
  }

  const largura = colunas.length * ESPACO_COLUNA;
  const alturaRack = ANDARES * ESPACO_ANDAR + 0.15;

  return (
    <div className="h-[440px] w-full overflow-hidden rounded-xl border border-border bg-[#0b0b0c]">
      <Canvas shadows camera={{ position: [largura * 0.55, 5.5, 8.5], fov: 45 }}>
        <color attach="background" args={["#0e0e0f"]} />
        <fog attach="fog" args={["#0e0e0f", 14, 30]} />

        <ambientLight intensity={0.5} />
        <directionalLight
          position={[6, 11, 7]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-largura}
          shadow-camera-right={largura}
          shadow-camera-top={largura}
          shadow-camera-bottom={-largura}
        />
        <directionalLight position={[-8, 5, -4]} intensity={0.25} color="#d4af17" />

        <Grid
          position={[0, -0.01, 0]}
          args={[largura + 10, 12]}
          cellSize={0.7}
          cellThickness={0.5}
          cellColor="#2a2a2d"
          sectionSize={ESPACO_COLUNA * 4}
          sectionThickness={1}
          sectionColor="#3a3a3e"
          fadeDistance={26}
          fadeStrength={1}
          infiniteGrid
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[largura + 14, 16]} />
          <meshStandardMaterial color="#141415" roughness={0.95} />
        </mesh>

        <mesh position={[0, alturaRack / 2, -PROFUNDIDADE_CAIXA - 1.2]} receiveShadow>
          <planeGeometry args={[largura + 8, alturaRack + 3]} />
          <meshStandardMaterial color="#0b0b0c" roughness={1} />
        </mesh>

        {colunas.map(([codigo, itens], indiceColuna) => {
          const x = indiceColuna * ESPACO_COLUNA - largura / 2 + ESPACO_COLUNA / 2;
          return (
            <group key={codigo}>
              <EstruturaRack x={x} altura={alturaRack} />
              {Array.from({ length: ANDARES }, (_, i) => i + 1).map((andar) => {
                const p = itens.find((it) => it.andar === andar);
                const y = (andar - 1) * ESPACO_ANDAR + ALTURA_CAIXA / 2 + 0.03;
                return <CaixaAndar key={andar} p={p} x={x} y={y} onAbrir={abrir} />;
              })}
              <Html position={[x, -0.42, 0]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f4f4f0", whiteSpace: "nowrap" }}>
                  {codigo}
                </span>
              </Html>
            </group>
          );
        })}

        <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={largura + 10} blur={2} far={4} />

        <OrbitControls
          enablePan
          minDistance={4}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, alturaRack * 0.4, 0]}
        />
      </Canvas>
    </div>
  );
}
