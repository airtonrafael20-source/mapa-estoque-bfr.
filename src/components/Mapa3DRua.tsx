"use client";

import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Edges } from "@react-three/drei";
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
  const cor = p ? COR_NIVEL[nivel] : "#232326";

  return (
    <group position={[x, y, 0]}>
      <mesh onClick={() => p && onAbrir(p)} castShadow>
        <boxGeometry args={[1.15, ALTURA_CAIXA, 0.85]} />
        <meshStandardMaterial color={cor} roughness={0.6} />
        <Edges color="#000000" opacity={0.35} transparent />
      </mesh>

      {p?.produto && (
        <Html
          position={[0, 0, 0.44]}
          center
          distanceFactor={9}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(18,18,19,0.9)",
              border: "1px solid #333336",
              borderRadius: 6,
              padding: "2px 6px",
              whiteSpace: "nowrap",
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

export default function Mapa3DRua({ colunas }: { colunas: [string, Posicao[]][] }) {
  const router = useRouter();

  function abrir(p: Posicao) {
    router.push(`/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`);
  }

  const largura = colunas.length * ESPACO_COLUNA;

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border border-border bg-[#0b0b0c]">
      <Canvas shadows camera={{ position: [largura * 0.6, 5.5, 8], fov: 45 }}>
        <color attach="background" args={["#121213"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 10, 6]} intensity={0.85} castShadow />

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[largura + 6, 10]} />
          <meshStandardMaterial color="#1b1b1d" />
        </mesh>

        {colunas.map(([codigo, itens], indiceColuna) => {
          const x = indiceColuna * ESPACO_COLUNA - largura / 2 + ESPACO_COLUNA / 2;
          return (
            <group key={codigo}>
              {Array.from({ length: ANDARES }, (_, i) => i + 1).map((andar) => {
                const p = itens.find((it) => it.andar === andar);
                const y = (andar - 1) * ESPACO_ANDAR + ALTURA_CAIXA / 2;
                return <CaixaAndar key={andar} p={p} x={x} y={y} onAbrir={abrir} />;
              })}
              <Html position={[x, -0.4, 0]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f4f4f0", whiteSpace: "nowrap" }}>
                  {codigo}
                </span>
              </Html>
            </group>
          );
        })}

        <OrbitControls
          enablePan
          minDistance={4}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, ANDARES * ESPACO_ANDAR * 0.35, 0]}
        />
      </Canvas>
    </div>
  );
}
