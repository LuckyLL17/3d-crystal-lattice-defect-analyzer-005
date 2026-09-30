import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

type DefectType = 'vacancy' | 'substitution' | 'dislocation';
type AtomPoint = { key: string; x: number; y: number; z: number; defect?: 'vacancy' | 'substitution' | 'normal'; };

const colors = { host: '#64c9e1', substitution: '#efb863', vacancy: '#ef7e83', bond: '#4b8190' };

const defectLabels: Record<DefectType, { title: string; en: string }> = {
  vacancy: { title: '空位缺陷', en: 'Vacancy' },
  substitution: { title: '替位缺陷', en: 'Substitution' },
  dislocation: { title: '刃型位错', en: 'Edge Dislocation' },
};

function buildAtoms(cells: number, defect: DefectType): AtomPoint[] {
  const atoms: AtomPoint[] = [];
  for (let x = 0; x < cells; x += 1) for (let y = 0; y < cells; y += 1) for (let z = 0; z < cells; z += 1) {
    const key = `${x}-${y}-${z}`;
    if (defect === 'vacancy' && x === 1 && y === 1 && z === 1) continue;
    if (defect === 'substitution' && x === 1 && y === 1 && z === 1) atoms.push({ key, x, y, z, defect: 'substitution' });
    else atoms.push({ key, x, y, z, defect: 'normal' });
  }
  if (defect === 'dislocation') return atoms.filter(atom => !(atom.x === 2 && atom.y === 0 && atom.z === 2));
  return atoms;
}

/**
 * 挂载在 Canvas 内部：向外部 ref 注册同步截图函数。
 * 捕获时用当前相机/场景立即补渲染一帧，紧接 toDataURL 读取，
 * 确保拿到的 PNG 与界面当前状态严格对应（同一渲染时刻）。
 */
function CaptureBridge({ register }: { register: (capture: () => string) => void }) {
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  useEffect(() => {
    register(() => {
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/png');
      if (!dataUrl.startsWith('data:image/png')) throw new Error('画布未返回 PNG 数据');
      return dataUrl;
    });
  }, [gl, scene, camera, register]);
  return null;
}

function DefectScene({ cells, defect, showBonds, planeOpacity, registerCapture }: { cells: number; defect: DefectType; showBonds: boolean; planeOpacity: number; registerCapture: (capture: () => string) => void }) {
  const atoms = useMemo(() => buildAtoms(cells, defect), [cells, defect]);
  const bonds = useMemo(() => { const list: [THREE.Vector3, THREE.Vector3][] = []; atoms.forEach(atom => { const origin = new THREE.Vector3((atom.x - (cells - 1) / 2) * 1.25, (atom.y - (cells - 1) / 2) * 1.25, (atom.z - (cells - 1) / 2) * 1.25); const neighbor = atoms.find(item => item.x === atom.x + 1 && item.y === atom.y && item.z === atom.z); if (neighbor) list.push([origin, new THREE.Vector3((neighbor.x - (cells - 1) / 2) * 1.25, (neighbor.y - (cells - 1) / 2) * 1.25, (neighbor.z - (cells - 1) / 2) * 1.25)]); const zNeighbor = atoms.find(item => item.x === atom.x && item.y === atom.y && item.z === atom.z + 1); if (zNeighbor) list.push([origin, new THREE.Vector3((zNeighbor.x - (cells - 1) / 2) * 1.25, (zNeighbor.y - (cells - 1) / 2) * 1.25, (zNeighbor.z - (cells - 1) / 2) * 1.25)]); }); return list; }, [atoms, cells]);
  return <Canvas shadows camera={{ position: [8, 6, 8], fov: 38 }} gl={{ preserveDrawingBuffer: true, antialias: true }}><color attach="background" args={['#09151d']} /><ambientLight intensity={1.25} /><directionalLight position={[5, 8, 5]} intensity={2.3} castShadow /><pointLight position={[-4, 2, 3]} color="#5fd4ee" intensity={12} distance={12} /><CaptureBridge register={registerCapture} /><group rotation={[.15, -.35, 0]}>{showBonds && bonds.map((bond, index) => <Line key={index} points={bond} color={colors.bond} lineWidth={1.2} transparent opacity={.65} />)}{atoms.map(atom => { const position = [(atom.x - (cells - 1) / 2) * 1.25, (atom.y - (cells - 1) / 2) * 1.25, (atom.z - (cells - 1) / 2) * 1.25] as [number, number, number]; const color = atom.defect === 'substitution' ? colors.substitution : colors.host; return <mesh key={atom.key} position={position} castShadow><sphereGeometry args={[atom.defect === 'substitution' ? .3 : .2, 18, 12]} /><meshStandardMaterial color={color} emissive={atom.defect === 'substitution' ? colors.substitution : '#000'} emissiveIntensity={atom.defect === 'substitution' ? .35 : 0} /></mesh>; })}{defect === 'vacancy' && <mesh position={[0, 0, 0]}><sphereGeometry args={[.35, 16, 12]} /><meshBasicMaterial color={colors.vacancy} transparent opacity={.26} wireframe /></mesh>}{defect === 'dislocation' && <Line points={[new THREE.Vector3(-1.9, -1.9, 0), new THREE.Vector3(-.65, -1.9, 0), new THREE.Vector3(-.65, -.65, 0), new THREE.Vector3(.65, -.65, 0), new THREE.Vector3(.65, .65, 0), new THREE.Vector3(1.9, .65, 0)]} color="#f08d87" lineWidth={4} />}</group><mesh rotation={[0, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[5.6, 5.6]} /><meshBasicMaterial color="#69cde2" transparent opacity={planeOpacity} side={THREE.DoubleSide} /></mesh><Grid args={[8, 8]} cellSize={1.25} sectionSize={2.5} cellColor="#326778" sectionColor="#72b9c9" position={[0, -2.55, 0]} /><OrbitControls makeDefault enableDamping={false} minDistance={5} maxDistance={15} /></Canvas>;
}
function DefectCard({ type, active, onClick, title, subtitle, color }: { type: DefectType; active: boolean; onClick: () => void; title: string; subtitle: string; color: string }) { return <button className={active ? 'defect-card active' : 'defect-card'} onClick={onClick}><span className="defect-symbol" style={{ color }}>{type === 'vacancy' ? '○' : type === 'substitution' ? '◉' : '∿'}</span><span><b>{title}</b><small>{subtitle}</small></span><i>{active ? 'ACTIVE' : 'SELECT'}</i></button>; }

export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

export function timestampParts(date: Date) {
  const display = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  const file = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
  return { display, file };
}

type SnapshotData = {
  defect: DefectType;
  cells: number;
  planeOpacity: number;
  showBonds: boolean;
  metrics: { atoms: number; neighbors: string; strain: string };
  pngDataUrl: string;
};

/** 构造完全自包含的实验记录 HTML：PNG 内嵌为 data URI，样式内联，仅使用系统字体，无任何外部依赖。 */
export function buildReportHtml(data: SnapshotData, exportedAt: string): string {
  const label = defectLabels[data.defect];
  const fields: Array<[string, string]> = [
    ['缺陷类型', `${label.title}（${label.en}）`],
    ['晶胞数量', `${data.cells} × ${data.cells} × ${data.cells}`],
    ['原子数', String(data.metrics.atoms)],
    ['平均配位', data.metrics.neighbors],
    ['局部应变', data.metrics.strain],
    ['晶面透明度', `${Math.round(data.planeOpacity * 100)}%`],
    ['最近邻连接', data.showBonds ? '显示' : '隐藏'],
    ['晶格类型', 'FCC'],
    ['晶格常数', '4.05 Å'],
    ['理论密度', '2.70 g/cm³'],
    ['当前温度', '298 K'],
    ['样品编号', 'FCC-AL-04'],
  ];
  const rows = fields.map(([name, value]) => `<div class="field"><span>${escapeHtml(name)}</span><b>${escapeHtml(value)}</b></div>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>晶格缺陷结构快照 · ${escapeHtml(label.title)} · ${escapeHtml(exportedAt)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:40px 20px;background:#08131a;color:#edf6f7;font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
  .report{max-width:980px;margin:0 auto;border:1px solid #2b5662;border-radius:10px;background:#0d202a;overflow:hidden}
  header{padding:26px 30px;border-bottom:1px solid #254550;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;background:#0a1820}
  .eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#76a9b5}
  h1{font-size:20px;margin:8px 0 0}
  h1 small{font-size:13px;color:#8fb3bc;font-weight:400;margin-left:8px}
  .stamp{text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#9cc3cb;line-height:1.9;white-space:nowrap}
  .shot{padding:22px 30px 0}
  .shot img{display:block;width:100%;border:1px solid #2b5662;border-radius:8px;background:#09151d}
  .caption{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:#70909a;margin:10px 2px 0}
  section{padding:22px 30px}
  h2{font-size:14px;margin:0 0 16px}
  .fields{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .field{padding:12px 13px;background:#102c36;border:1px solid #244651;border-radius:6px}
  .field span{display:block;font-size:10px;color:#6f919a;margin-bottom:7px}
  .field b{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:#d9edef;font-weight:500}
  .note{margin:20px 0 0;padding:12px 14px;border-left:3px solid #4b8e9a;background:#102934;border-radius:0 5px 5px 0;font-size:12px;line-height:1.7;color:#a9c9ce}
  footer{padding:16px 30px;border-top:1px solid #254550;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:#5f818b;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  @media(max-width:760px){.fields{grid-template-columns:repeat(2,1fr)}header{flex-direction:column}.stamp{text-align:left;white-space:normal}}
</style>
</head>
<body>
<div class="report">
  <header>
    <div>
      <div class="eyebrow">MATERIALS SCIENCE / LATTICE LAB</div>
      <h1>晶格缺陷结构快照 <small>Crystal Defect Lab · 3D</small></h1>
    </div>
    <div class="stamp">
      <div>SAMPLE / FCC-AL-04</div>
      <div>EXPORTED / ${escapeHtml(exportedAt)}</div>
    </div>
  </header>
  <div class="shot">
    <img src="${data.pngDataUrl}" alt="${escapeHtml(label.title)}三维结构截图（${escapeHtml(data.cells + '³ 晶胞')}）"/>
    <div class="caption">VIEW CAPTURE · 三维画布实时渲染截图（相机视角与导出时刻一致）</div>
  </div>
  <section>
    <h2>参数与指标快照</h2>
    <div class="fields">${rows}</div>
    <p class="note">本记录由 Crystal Defect Lab 在本地生成，截图与参数取自同一渲染时刻。指标为演示计算结果，后续可接入真实晶体结构文件与模拟数据。此 HTML 完全自包含，可离线打开，无需开发服务器或网络字体。</p>
  </section>
  <footer>
    <span>CRYSTAL DEFECT LAB · STRUCTURE SNAPSHOT</span>
    <span>${escapeHtml(label.en.toUpperCase())} · ${escapeHtml(data.cells)}×${escapeHtml(data.cells)}×${escapeHtml(data.cells)} · ${escapeHtml(data.metrics.atoms)} ATOMS</span>
  </footer>
</div>
</body>
</html>`;
}

export default function App() {
  const [cells, setCells] = useState(4);
  const [defect, setDefect] = useState<DefectType>('vacancy');
  const [showBonds, setShowBonds] = useState(true);
  const [planeOpacity, setPlaneOpacity] = useState(.08);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  // Canvas 内注册的截图函数
  const captureRef = useRef<(() => string) | null>(null);
  // 重入锁：重复点击不能触发并发/失控下载
  const isExportingRef = useRef(false);
  // 锁释放计时器：同步工作结束后仍保持一个短窗口，吞掉同一次连点爆发
  const unlockTimerRef = useRef<number | null>(null);
  // 上一次下载的 Object URL，便于回收
  const lastObjectUrlRef = useRef<string | null>(null);

  const metrics = useMemo(() => ({ atoms: defect === 'vacancy' ? cells ** 3 - 1 : cells ** 3, neighbors: defect === 'dislocation' ? '5 / 6' : defect === 'vacancy' ? '5 / 6' : '6 / 6', strain: defect === 'dislocation' ? '8.4%' : defect === 'substitution' ? '3.1%' : '1.7%' }), [cells, defect]);

  const registerCapture = useRef((capture: () => string) => { captureRef.current = capture; }).current;

  useEffect(() => () => { if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current); }, []);

  const handleExport = () => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setExporting(true);
    setNotice(null);

    // 同步工作完成后，仍保持锁与禁用态一个短窗口（覆盖双击/同任务连点爆发），再恢复可点击
    const finish = (result: { kind: 'ok' | 'error'; text: string }) => {
      setNotice(result);
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = window.setTimeout(() => {
        isExportingRef.current = false;
        setExporting(false);
        unlockTimerRef.current = null;
      }, 350);
    };

    try {
      const capture = captureRef.current;
      if (!capture) throw new Error('三维渲染尚未就绪');

      // 同一时刻采样：截图捕获的是当前已提交的场景，下面文字也全部取自同一次状态闭包，
      // 二者之间不 await、不 setState，保证截图与参数/指标严格对应。
      const pngDataUrl = capture();
      const now = new Date();
      const { display, file } = timestampParts(now);
      const html = buildReportHtml({ defect, cells, planeOpacity, showBonds, metrics, pngDataUrl }, display);

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `crystal-defect-snapshot-${defect}-${cells}x${cells}x${cells}-${file}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      // 回收上一次的 URL；本次 URL 延迟回收，给浏览器留出完成下载的时间
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = url;
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        if (lastObjectUrlRef.current === url) lastObjectUrlRef.current = null;
      }, 4000);

      finish({ kind: 'ok', text: `快照已导出：${link.download}` });
    } catch (error) {
      // 导出失败：不触碰相机与模型，短延迟后按钮恢复，允许重试
      finish({ kind: 'error', text: `快照导出失败：${error instanceof Error ? error.message : '未知错误'}，相机与模型未改变，可重试。` });
    }
  };

  return <div className="app"><header className="topbar"><div className="brand"><div className="brand-icon">◈</div><div><span className="eyebrow">MATERIALS SCIENCE / LATTICE LAB</span><h1>Crystal Defect Lab <span>·</span> 晶格缺陷分析</h1></div></div><div className="header-meta"><span className="sample">SAMPLE / FCC-AL-04</span><button data-testid="export-snapshot" onClick={handleExport} disabled={exporting}>{exporting ? '正在导出…' : '导出快照 ↗'}</button></div></header><main className="layout"><section className="model-card"><div className="model-head"><div><span className="eyebrow">UNIT CELL EXPLORER</span><h2>面心立方晶格 · 缺陷结构可视化</h2></div><div className="head-stats"><span><b>{cells}³</b> 晶胞</span><span><b>{metrics.atoms}</b> 原子</span></div></div><div className="canvas-wrap"><DefectScene cells={cells} defect={defect} showBonds={showBonds} planeOpacity={planeOpacity} registerCapture={registerCapture} /><div className="model-legend"><span><i className="dot host" />基体原子</span><span><i className="dot sub" />缺陷原子</span><span><i className="dot line" />滑移/缺陷线</span></div><div className="model-hint">拖拽旋转 · 滚轮缩放 · 三维晶面已叠加</div></div></section><aside className="sidebar"><section className="panel summary"><span className="eyebrow">STRUCTURE SUMMARY</span><h3>晶格参数</h3><div className="summary-grid"><div><span>晶格类型</span><b>FCC</b></div><div><span>晶格常数</span><b>4.05 Å</b></div><div><span>理论密度</span><b>2.70 g/cm³</b></div><div><span>当前温度</span><b>298 K</b></div></div></section><section className="panel"><div className="panel-title"><div><span className="eyebrow">DEFECT LIBRARY</span><h3>缺陷类型</h3></div><span className="count">3 MODELS</span></div><div className="defect-list"><DefectCard type="vacancy" active={defect === 'vacancy'} onClick={() => setDefect('vacancy')} title="空位缺陷" subtitle="原子位置缺失" color={colors.vacancy} /><DefectCard type="substitution" active={defect === 'substitution'} onClick={() => setDefect('substitution')} title="替位缺陷" subtitle="异质原子替换" color={colors.substitution} /><DefectCard type="dislocation" active={defect === 'dislocation'} onClick={() => setDefect('dislocation')} title="刃型位错" subtitle="局部滑移面错位" color="#ef8d86" /></div></section><section className="panel controls"><div className="panel-title"><div><span className="eyebrow">ANALYSIS CONTROLS</span><h3>分析参数</h3></div></div><label>晶胞数量 <output>{cells} × {cells} × {cells}</output><input type="range" min="3" max="5" value={cells} onChange={event => setCells(Number(event.target.value))} /></label><label>晶面透明度 <output>{Math.round(planeOpacity * 100)}%</output><input type="range" min="0" max=".3" step=".01" value={planeOpacity} onChange={event => setPlaneOpacity(Number(event.target.value))} /></label><button className={showBonds ? 'toggle active' : 'toggle'} onClick={() => setShowBonds(value => !value)}><span className="toggle-dot" />显示最近邻连接</button></section><section className="panel metrics-panel"><span className="eyebrow">DEFECT METRICS</span><h3>结构指标</h3><div className="metric-row"><div><span>原子数</span><b>{metrics.atoms}</b></div><div><span>平均配位</span><b>{metrics.neighbors}</b></div><div><span>局部应变</span><b>{metrics.strain}</b></div></div><p>指标为演示计算结果，后续可接入真实晶体结构文件与模拟数据。</p></section>{notice && <div className={notice.kind === 'error' ? 'toast error' : 'toast'} onClick={() => setNotice(null)}>{notice.text}<span>×</span></div>}</aside></main></div>;
}
