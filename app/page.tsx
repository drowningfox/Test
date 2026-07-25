"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TILE = 24;
const MAP = [
  "###################",
  "#........#........#",
  "#.###.##.#.##.###.#",
  "#o###.##.#.##.###o#",
  "#.................#",
  "#.###.#.#####.#.###",
  "#.....#...#...#...#",
  "#####.### # ###.###",
  "    #.#       #.#  ",
  "#####.# ##-## #.###",
  "     .  #   #  .   ",
  "#####.# ##### #.###",
  "    #.#       #.#  ",
  "#####.# ##### #.###",
  "#........#........#",
  "#.###.##.#.##.###.#",
  "#o..#...........#o#",
  "###.#.#.#####.#.#.#",
  "#.....#...#...#...#",
  "#.#######.#.#######",
  "#.................#",
  "###################",
];

type Dir = { x: number; y: number };
type Actor = { x: number; y: number; dir: Dir; color?: string; homeX?: number; homeY?: number };
const DIRS: Record<string, Dir> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const gameRef = useRef<{ pac: Actor; ghosts: Actor[]; pellets: Set<string>; wanted: Dir; score: number; lives: number; power: number; status: "ready" | "playing" | "paused" | "over" | "won"; last: number } | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState("READY!");

  const resetActors = useCallback((g: NonNullable<typeof gameRef.current>) => {
    g.pac = { x: 9, y: 16, dir: DIRS.left };
    g.ghosts = [
      { x: 9, y: 10, dir: DIRS.left, color: "#ff3b52", homeX: 9, homeY: 10 },
      { x: 8, y: 10, dir: DIRS.up, color: "#ff8bd1", homeX: 8, homeY: 10 },
      { x: 10, y: 10, dir: DIRS.right, color: "#43dfff", homeX: 10, homeY: 10 },
      { x: 9, y: 9, dir: DIRS.down, color: "#ff9d38", homeX: 9, homeY: 9 },
    ];
  }, []);

  const newGame = useCallback(() => {
    const pellets = new Set<string>();
    MAP.forEach((row, y) => [...row].forEach((c, x) => { if (c === "." || c === "o") pellets.add(`${x},${y}`); }));
    const g = { pac: { x: 9, y: 16, dir: DIRS.left }, ghosts: [] as Actor[], pellets, wanted: DIRS.left, score: 0, lives: 3, power: 0, status: "ready" as const, last: performance.now() };
    resetActors(g);
    gameRef.current = g;
    setScore(0); setLives(3); setStatus("READY!");
    window.setTimeout(() => { if (gameRef.current === g) { g.status = "playing"; setStatus(""); } }, 900);
  }, [resetActors]);

  const isWall = (x: number, y: number) => y < 0 || y >= MAP.length || (x >= 0 && x < 19 && (MAP[y]?.[x] === "#" || MAP[y]?.[x] === "-"));
  const move = (a: Actor, d: Dir) => {
    let nx = a.x + d.x, ny = a.y + d.y;
    if (nx < 0) nx = 18; if (nx > 18) nx = 0;
    if (!isWall(nx, ny)) { a.x = nx; a.y = ny; a.dir = d; return true; }
    return false;
  };

  const input = useCallback((name: keyof typeof DIRS) => {
    const g = gameRef.current; if (!g) return;
    g.wanted = DIRS[name];
    if (g.status === "paused") { g.status = "playing"; setStatus(""); }
  }, []);

  useEffect(() => {
    const saved = Number(localStorage.getItem("pixel-chomp-best") || 0); setBest(saved);
    newGame();
    const onKey = (e: KeyboardEvent) => {
      const keys: Record<string, keyof typeof DIRS> = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
      if (keys[e.key]) { e.preventDefault(); input(keys[e.key]); }
      if (e.key === " ") { e.preventDefault(); const g = gameRef.current; if (!g || g.status === "over" || g.status === "won") newGame(); else { g.status = g.status === "paused" ? "playing" : "paused"; setStatus(g.status === "paused" ? "PAUSED" : ""); } }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [input, newGame]);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    const draw = (time: number) => {
      const g = gameRef.current;
      if (g && g.status === "playing" && time - g.last > 145) {
        g.last = time; move(g.pac, g.wanted) || move(g.pac, g.pac.dir);
        const key = `${g.pac.x},${g.pac.y}`;
        if (g.pellets.delete(key)) {
          const power = MAP[g.pac.y]?.[g.pac.x] === "o"; g.score += power ? 50 : 10; if (power) g.power = 45;
          setScore(g.score); if (g.score > best) { setBest(g.score); localStorage.setItem("pixel-chomp-best", String(g.score)); }
          if (!g.pellets.size) { g.status = "won"; setStatus("YOU WIN!"); }
        }
        if (g.power > 0) g.power--;
        g.ghosts.forEach((ghost, i) => {
          const choices = Object.values(DIRS).filter(d => !isWall(ghost.x + d.x, ghost.y + d.y) && !(d.x === -ghost.dir.x && d.y === -ghost.dir.y));
          choices.sort((a, b) => {
            const targetX = g.power ? (ghost.homeX ?? 9) : g.pac.x + (i % 2 ? g.pac.dir.x * 2 : 0);
            const targetY = g.power ? (ghost.homeY ?? 10) : g.pac.y + (i % 2 ? g.pac.dir.y * 2 : 0);
            return (Math.abs(ghost.x + a.x - targetX) + Math.abs(ghost.y + a.y - targetY)) - (Math.abs(ghost.x + b.x - targetX) + Math.abs(ghost.y + b.y - targetY));
          });
          move(ghost, Math.random() < .72 ? choices[0] || ghost.dir : choices[Math.floor(Math.random() * choices.length)] || ghost.dir);
          if (ghost.x === g.pac.x && ghost.y === g.pac.y) {
            if (g.power) { g.score += 200; ghost.x = ghost.homeX!; ghost.y = ghost.homeY!; setScore(g.score); }
            else { g.lives--; setLives(g.lives); if (g.lives <= 0) { g.status = "over"; setStatus("GAME OVER"); } else { g.status = "ready"; setStatus("READY!"); resetActors(g); window.setTimeout(() => { if (g.status === "ready") { g.status = "playing"; setStatus(""); } }, 900); } }
          }
        });
      }
      ctx.fillStyle = "#050513"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      MAP.forEach((row, y) => [...row].forEach((c, x) => {
        const px = x * TILE, py = y * TILE;
        if (c === "#") { ctx.fillStyle = "#162077"; ctx.fillRect(px + 2, py + 2, 20, 20); ctx.fillStyle = "#3347ff"; ctx.fillRect(px + 5, py + 5, 14, 3); }
        if (g?.pellets.has(`${x},${y}`)) { ctx.fillStyle = "#ffe8bd"; const s = c === "o" ? 9 : 4; ctx.fillRect(px + (24-s)/2, py + (24-s)/2, s, s); }
      }));
      if (g) {
        const p = g.pac; const cx = p.x*TILE+12, cy = p.y*TILE+12; const angle = Math.atan2(p.dir.y,p.dir.x); const mouth = .22 + Math.abs(Math.sin(time/85))*.18;
        ctx.fillStyle="#ffdf29"; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,10,angle+mouth*Math.PI,angle-mouth*Math.PI+Math.PI*2); ctx.fill();
        g.ghosts.forEach(gh => { const x=gh.x*TILE+4,y=gh.y*TILE+4; ctx.fillStyle=g.power && Math.floor(g.power/4)%2===0?"#204cff":gh.color!; ctx.fillRect(x,y+7,16,11); ctx.beginPath(); ctx.arc(x+8,y+7,8,Math.PI,0); ctx.fill(); ctx.fillStyle="#fff"; ctx.fillRect(x+3,y+7,5,6);ctx.fillRect(x+10,y+7,5,6);ctx.fillStyle="#142052";ctx.fillRect(x+5+gh.dir.x,y+9+gh.dir.y,2,3);ctx.fillRect(x+12+gh.dir.x,y+9+gh.dir.y,2,3); });
      }
      frameRef.current=requestAnimationFrame(draw);
    };
    frameRef.current=requestAnimationFrame(draw); return()=>cancelAnimationFrame(frameRef.current);
  }, [best, resetActors]);

  return <main className="game-shell">
    <section className="cabinet" aria-label="像素吃豆人游戏机">
      <header><div className="brand">PIXEL <span>CHOMP</span></div><div className="coin">● 1UP</div></header>
      <div className="scorebar"><div><small>SCORE</small><strong>{String(score).padStart(6,"0")}</strong></div><div><small>HIGH SCORE</small><strong>{String(best).padStart(6,"0")}</strong></div></div>
      <div className="screen-wrap"><canvas ref={canvasRef} width={456} height={528} aria-label="吃豆人迷宫"/><div className={`message ${status?"show":""}`}>{status}<small>{status === "GAME OVER" || status === "YOU WIN!" ? "PRESS SPACE" : ""}</small></div></div>
      <footer><div className="lives" aria-label={`剩余 ${lives} 条命`}>{Array.from({length:lives},(_,i)=><i key={i}/>)}</div><button className="pause" onClick={()=>{const g=gameRef.current;if(!g)return;if(g.status==="over"||g.status==="won")newGame();else{g.status=g.status==="paused"?"playing":"paused";setStatus(g.status==="paused"?"PAUSED":"");}}}>Ⅱ</button></footer>
    </section>
    <aside className="controls"><p>ARROW KEYS / WASD</p><div className="dpad"><button onPointerDown={()=>input("up")} aria-label="向上">▲</button><button onPointerDown={()=>input("left")} aria-label="向左">◀</button><button className="center" aria-hidden="true"/><button onPointerDown={()=>input("right")} aria-label="向右">▶</button><button onPointerDown={()=>input("down")} aria-label="向下">▼</button></div><button className="new" onClick={newGame}>NEW GAME</button></aside>
  </main>;
}
