import { useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Cp, getI, getJ, getKL, getKm, getKR, getKs, getKv, KB, KT, MATERIALS } from "./gearCalculations.js";
import ShifterWorkflow from "./ShifterWorkflow.jsx";

// ============================================================
// CORE GEAR DESIGN — Shigley Chapter 14 workflow
// ============================================================
const designGear = ({
  power_kW, rpm_in, targetRatio,
  phi_deg = 20, Qv = 6, Ko = 1.25,
  sfBreq = 1.5, sfCreq = 1.5,
  maxCenter = 300, life_hours = 5000,
  reliability = 0.99,
  materialKey = "Carburized & Hardened (Grade 2)",
  mode = "simple",
}) => {
  const mat = MATERIALS[materialKey];
  const cycles = life_hours * 60 * rpm_in;
  const KL = getKL(cycles);
  const KR = getKR(+reliability);

  // Allowable stresses (Shigley Eq. 14-17, 14-18)
  const sigma_b_allow = (mat.sigma_b * KL) / (KT * KR);
  const sigma_c_allow = (mat.sigma_c * Math.sqrt(KL)) / (KT * Math.sqrt(KR));

  // Input torque
  const torque_Nm = (9550 * power_kW) / rpm_in;

  let designs = [];

  for (let m = 1.5; m <= 6; m += 0.5) {
    for (let Np = 17; Np <= 30; Np++) {
      const Ng = Math.round(targetRatio * Np);
      const mG = Ng / Np;
      const d_p = m * Np;       // mm
      const d_g = m * Ng;       // mm
      const center = (d_p + d_g) / 2;

      if (mode === "advanced" && center > maxCenter) continue;

      // Face width range: 8m to 16m (metric analog of 3/Pd to 5/Pd)
      const F_min = Math.ceil(8 * m);
      const F_max = Math.floor(16 * m);
      const F_step = Math.max(1, Math.round(m));

      for (let F = F_min; F <= F_max; F += F_step) {
        // Pitch-line velocity
        const V_ms = (Math.PI * (d_p / 1000) * rpm_in) / 60;

        // Computed AGMA factors
        const J_p  = getJ(Np);
        const J_g  = getJ(Ng);
        const I    = getI(phi_deg, mG);
        const Kv   = getKv(V_ms, Qv);
        const Ks   = getKs(F, m, J_p);
        const Km   = getKm(F, d_p);

        // Tangential load (N)
        const Wt = (2 * torque_Nm) / (d_p / 1000);

        // Bending stress — Shigley Eq. 14-15 (metric form)
        // sigma_b = Wt * Ko * Kv * Ks * (1/m) * (Km*KB/J) / F
        // units: N * (1/mm) / mm = N/mm² = MPa ✓
        const sigma_bp = (Wt * Ko * Kv * Ks * (1 / m) * Km * KB) / (F * J_p);
        const sigma_bg = (Wt * Ko * Kv * Ks * (1 / m) * Km * KB) / (F * J_g);

        // Contact stress — Shigley Eq. 14-16 (metric, Cp = 191 MPa^0.5)
        // sigma_c = Cp * sqrt(Wt*Ko*Kv*Ks*Km / (F * d_p * I))
        // units: MPa^0.5 * sqrt(N / (mm * mm)) = MPa^0.5 * sqrt(N/mm²) → MPa... but need to check:
        // Wt[N] / (F[mm] * d_p[mm]) = N/mm² = MPa → sigma_c = 191*sqrt(MPa) ... 
        // Cp=191 MPa^0.5 so sigma_c = 191 * sqrt(MPa) → MPa ✓ (consistent with metric Cp)
        const sigma_c = Cp * Math.sqrt((Wt * Ko * Kv * Ks * Km) / (F * d_p * I));

        const sf_b_p = sigma_b_allow / sigma_bp;
        const sf_b_g = sigma_b_allow / sigma_bg;
        const sf_c   = sigma_c_allow / sigma_c;
        const sf_b   = Math.min(sf_b_p, sf_b_g);
        const feasible = sf_b >= sfBreq && sf_c >= sfCreq;

        // Additional geometry
        const addendum   = m;
        const dedendum   = 1.25 * m;
        const wholeDepth = addendum + dedendum;
        const Wt_radial  = Wt * Math.tan(phi_deg * Math.PI / 180);

        designs.push({
          m, Np, Ng, mG_actual: mG, d_p, d_g, center, F,
          V_ms, Wt, Wt_radial,
          Kv, Ks, Km, J_p, J_g, I,
          sigma_bp, sigma_bg, sigma_c,
          sf_b_p, sf_b_g, sf_c, sf_b,
          feasible, addendum, dedendum, wholeDepth,
        });
      }
    }
  }

  const feasibles = designs.filter(d => d.feasible);
  feasibles.sort((a, b) => a.center - b.center); // rank by tightest packaging

  const best = feasibles.length > 0
    ? feasibles[0]
    : designs.sort((a, b) =>
        Math.min(b.sf_b / sfBreq, b.sf_c / sfCreq) - Math.min(a.sf_b / sfBreq, a.sf_c / sfCreq)
      )[0];

  return { best, feasible: feasibles.length > 0, count: feasibles.length, sigma_b_allow, sigma_c_allow };
};

// ============================================================
// VEHICLE SIMULATION — longitudinal model per assignment spec
// ============================================================
const simulate0to60 = (G1, G2, v_shift, power_kW, T_peak, m_veh, r_w, Cd, A, rho, Crr, mu, eta) => {
  const P = power_kW * 1000;
  const omega_base = P / T_peak;
  const v_target = 26.82; // 60 mph in m/s
  const dt = 0.01;

  let v = 0.1, t = 0;
  while (v < v_target && t < 30) {
    const G = v < v_shift ? G1 : G2;
    const omega_motor = G * (v / r_w);
    const T_motor = omega_motor <= omega_base ? T_peak : P / omega_motor;
    const F_motor = eta * G * T_motor / r_w;
    const F_trac  = mu * m_veh * 9.81;
    const F_drive = Math.min(F_motor, F_trac);
    const F_drag  = 0.5 * rho * Cd * A * v * v;
    const F_roll  = Crr * m_veh * 9.81;
    const F_net   = F_drive - F_drag - F_roll;
    if (F_net <= 0) break;
    v += (F_net / m_veh) * dt;
    t += dt;
  }
  return v >= v_target ? t : 99;
};

// ============================================================
// UI PRIMITIVES
// ============================================================
const Card = ({ title, accent, children }) => (
  <div style={{
    border: `1px solid ${accent || "#1e3a5f"}`, borderRadius: 10, padding: 18,
    marginBottom: 16, background: "#040f1e",
    boxShadow: accent ? `0 0 12px ${accent}18` : "none"
  }}>
    {title && <h2 style={{ margin: "0 0 14px", color: "#cbd5e1", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{title}</h2>}
    {children}
  </div>
);

const Row = ({ label, note, children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 8, marginBottom: 9, alignItems: "center" }}>
    <div style={{ fontSize: 13, color: "#64748b" }}>
      {label}{note && <span style={{ color: "#334155", marginLeft: 4, fontSize: 11 }}>[{note}]</span>}
    </div>
    <div>{children}</div>
  </div>
);

const Inp = ({ unit, ...props }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <input style={{
      padding: "7px 10px", flex: 1, borderRadius: 6,
      border: "1px solid #1e3a5f", background: "#020c1b", color: "#e2e8f0", fontSize: 13,
    }} {...props} />
    {unit && <span style={{ color: "#334155", fontSize: 11 }}>{unit}</span>}
  </div>
);

const Sel = ({ options, ...props }) => (
  <select style={{
    padding: "7px 10px", width: "100%", borderRadius: 6,
    border: "1px solid #1e3a5f", background: "#020c1b", color: "#e2e8f0", fontSize: 13
  }} {...props}>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const Btn = ({ active, color, children, ...props }) => (
  <button style={{
    padding: "8px 16px", marginRight: 6, marginBottom: 6, borderRadius: 7,
    border: `1px solid ${color || (active ? "#38bdf8" : "#1e3a5f")}`,
    background: active ? "#0c2a4a" : color ? `${color}18` : "#081424",
    color: color || (active ? "#38bdf8" : "#64748b"),
    fontWeight: 600, cursor: "pointer", fontSize: 12, fontFamily: "inherit"
  }} {...props}>{children}</button>
);

const SRow = ({ label, value, unit, ok, warn }) => (
  <tr style={{ borderBottom: "1px solid #0a1e35" }}>
    <td style={{ padding: "5px 10px", color: "#475569", fontSize: 12 }}>{label}</td>
    <td style={{ padding: "5px 10px", fontSize: 13, fontWeight: 600,
      color: ok === true ? "#4ade80" : ok === false ? "#f87171" : warn ? "#fbbf24" : "#cbd5e1" }}>
      {value !== undefined ? value : "—"}
      {unit && <span style={{ color: "#334155", fontWeight: 400, fontSize: 11, marginLeft: 3 }}>{unit}</span>}
    </td>
  </tr>
);

const GearCard = ({ title, result, sfBreq, sfCreq, showSafety, accent }) => {
  if (!result?.best) return null;
  const d = result.best;
  const bOk = d.sf_b >= sfBreq, cOk = d.sf_c >= sfCreq;
  const safe = bOk && cOk;
  return (
    <Card title={title} accent={accent || (safe ? "#10b981" : "#ef4444")}>
      {showSafety && (
        <div style={{
          padding: "7px 12px", borderRadius: 7, marginBottom: 10, fontSize: 12, fontWeight: 700,
          background: safe ? "#052e16" : "#450a0a",
          border: `1px solid ${safe ? "#16a34a" : "#dc2626"}`,
          color: safe ? "#4ade80" : "#f87171",
        }}>
          {safe ? "✅ SAFE" : "⚠️ UNSAFE"}
          {!safe && <div style={{ fontWeight: 400, marginTop: 3 }}>
            {!bOk && <div>• Bending SF {d.sf_b.toFixed(3)} &lt; {sfBreq}</div>}
            {!cOk && <div>• Contact SF {d.sf_c.toFixed(3)} &lt; {sfCreq}</div>}
          </div>}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <SRow label="Module m" value={d.m} unit="mm" />
          <SRow label="Face Width F" value={d.F} unit="mm" />
          <SRow label="Pinion Teeth Np" value={d.Np} />
          <SRow label="Gear Teeth Ng" value={d.Ng} />
          <SRow label="Actual Ratio" value={d.mG_actual.toFixed(4)} />
          <SRow label="Pitch Dia. pinion d_p" value={d.d_p.toFixed(1)} unit="mm" />
          <SRow label="Pitch Dia. gear d_g" value={d.d_g.toFixed(1)} unit="mm" />
          <SRow label="Center Distance C" value={d.center.toFixed(1)} unit="mm" />
          <SRow label="Addendum a" value={d.addendum.toFixed(2)} unit="mm" />
          <SRow label="Whole Depth h" value={d.wholeDepth.toFixed(2)} unit="mm" />
          <SRow label="Pitch Line Velocity V" value={d.V_ms.toFixed(3)} unit="m/s" />
          <SRow label="Tangential Load Wt" value={d.Wt.toFixed(1)} unit="N" />
          <SRow label="Radial Load Wr" value={d.Wt_radial.toFixed(1)} unit="N" />
          <tr style={{ borderBottom: "1px solid #0a1e35" }}>
            <td colSpan={2} style={{ padding: "5px 10px", color: "#1e3a5f", fontSize: 11, fontStyle: "italic" }}>
              — Computed AGMA Factors —
            </td>
          </tr>
          <SRow label="Kv (dynamic)" value={d.Kv.toFixed(4)} warn />
          <SRow label="Ks (size)" value={d.Ks.toFixed(4)} warn />
          <SRow label="Km (load dist.)" value={d.Km.toFixed(4)} warn />
          <SRow label="J pinion" value={d.J_p.toFixed(4)} warn />
          <SRow label="J gear" value={d.J_g.toFixed(4)} warn />
          <SRow label="I (contact geom.)" value={d.I.toFixed(5)} warn />
          <tr style={{ borderBottom: "1px solid #0a1e35" }}>
            <td colSpan={2} style={{ padding: "5px 10px", color: "#1e3a5f", fontSize: 11, fontStyle: "italic" }}>
              — Stresses & Safety Factors —
            </td>
          </tr>
          <SRow label="σb pinion" value={d.sigma_bp.toFixed(2)} unit="MPa" />
          <SRow label="σb gear" value={d.sigma_bg.toFixed(2)} unit="MPa" />
          <SRow label="σc contact" value={d.sigma_c.toFixed(2)} unit="MPa" />
          <SRow label="Allow. bending σb" value={result.sigma_b_allow.toFixed(2)} unit="MPa" />
          <SRow label="Allow. contact σc" value={result.sigma_c_allow.toFixed(2)} unit="MPa" />
          <SRow label="Bending SF (pinion)" value={d.sf_b_p.toFixed(3)} ok={d.sf_b_p >= sfBreq} />
          <SRow label="Bending SF (gear)" value={d.sf_b_g.toFixed(3)} ok={d.sf_b_g >= sfBreq} />
          <SRow label="Contact SF" value={d.sf_c.toFixed(3)} ok={d.sf_c >= sfCreq} />
        </tbody>
      </table>
    </Card>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [mode, setMode] = useState("simple");
  const [tab, setTab] = useState("inputs");

  // Vehicle inputs (all editable per assignment)
  const [power, setPower]   = useState(194);
  const [rpm, setRpm]       = useState(6000);
  const [Tpeak, setTpeak]   = useState(440);
  const [ratio, setRatio]   = useState(9.04);
  const [mVeh, setMVeh]     = useState(1760);
  const [rW, setRW]         = useState(0.3345);
  const [Cd, setCd]         = useState(0.219);
  const [Af, setAf]         = useState(2.22);
  const [Crr, setCrr]       = useState(0.010);
  const [mu, setMu]         = useState(1.0);

  // Gear design inputs
  const [material, setMaterial] = useState("Carburized & Hardened (Grade 2)");
  const [phi, setPhi]           = useState(20);
  const [Qv, setQv]             = useState(6);
  const [Ko, setKo]             = useState(1.25);
  const [lifeH, setLifeH]       = useState(5000);
  const [rel, setRel]           = useState(0.99);
  const [sfB, setSfB]           = useState(1.5);
  const [sfC, setSfC]           = useState(1.5);
  const [maxC, setMaxC]         = useState(300);

  const [singleRes, setSingleRes]   = useState(null);
  const [twoRes, setTwoRes]         = useState(null);
  const [running, setRunning]       = useState(false);

  const [motorData, setMotorData]     = useState([]);
  const [tractiveData, setTractiveData] = useState([]);
  const [accelData, setAccelData]     = useState([]);

  const [timeData, setTimeData] = useState([]);
  const [safetyData, setSafetyData] = useState([]);



  const params = (r = ratio, n = rpm) => ({
    power_kW: +power, rpm_in: +n, targetRatio: +r,
    phi_deg: +phi, Qv: +Qv, Ko: +Ko,
    sfBreq: +sfB, sfCreq: +sfC, maxCenter: +maxC,
    life_hours: +lifeH, reliability: +rel,
    materialKey: material, mode,
  });

  const runSingle = () => { setSingleRes(designGear(params())); setTab("single"); };

  const runTwo = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      let best = null, bestT = 99;
      const rho = 1.225, eta = 0.97;
      const baseline = simulate0to60(9.04, 9.04, 999, +power, +Tpeak, +mVeh, +rW, +Cd, +Af, rho, +Crr, +mu, eta);
      for (let G1 = 10; G1 <= 18; G1 += 0.5) {
        for (let G2 = 5; G2 < G1; G2 += 0.5) {
          for (let vs = 4; vs <= 24; vs += 1) {
            const t = simulate0to60(G1, G2, vs, +power, +Tpeak, +mVeh, +rW, +Cd, +Af, rho, +Crr, +mu, eta);
            if (t < bestT) { bestT = t; best = { G1, G2, vs, t }; }
          }
        }
      }
      const g1 = designGear(params(best.G1));
      const g2 = designGear(params(best.G2));
      setTwoRes({ ...best, baseline, g1, g2 });
      setRunning(false);
      setTab("twospeed");
    }, 50);
  }, [power, Tpeak, mVeh, rW, Cd, Af, Crr, mu, ratio, rpm, phi, Qv, Ko, lifeH, rel, sfB, sfC, maxC, material, mode]);

  const genMotor = () => {
    const P = +power * 1000, wb = P / +Tpeak, data = [];
    for (let n = 0; n <= 12000; n += 100) {
      const w = n * 2 * Math.PI / 60;
      const T = w <= wb ? +Tpeak : P / w;
      data.push({ rpm: n, "Torque (Nm)": +T.toFixed(1), "Power (kW)": +((T * w) / 1000).toFixed(1) });
    }
    setMotorData(data); setTab("graphs");
  };

  const genTractiveMulti = () => {
    const P = +power * 1000, wb = P / +Tpeak, eta = 0.97, data = [];
    const Rs = [6, 8, 9.04, 12, 14];
    for (let v = 0.5; v <= 30; v += 0.5) {
      const pt = { "Speed (m/s)": +v.toFixed(1) };
      Rs.forEach(G => {
        const w = G * (v / +rW);
        const T = w <= wb ? +Tpeak : P / w;
        pt[`G=${G}`] = +((eta * G * T) / +rW).toFixed(0);
      });
      data.push(pt);
    }
    setTractiveData(data); setTab("graphs");
  };
  
  const genAccel = () => {
    const P = +power * 1000, wb = P / +Tpeak, G = 9.04, rho = 1.225, eta = 0.97, data = [];
    for (let v = 0.5; v <= 30; v += 0.5) {
      const w = G * (v / +rW);
      const T = w <= wb ? +Tpeak : P / w;
      const Fd = eta * G * T / +rW;
      const Ft = Math.min(Fd, +mu * +mVeh * 9.81);
      const Fdr = 0.5 * rho * +Cd * +Af * v * v;
      const Fr = +Crr * +mVeh * 9.81;
      data.push({ "Speed (m/s)": +v.toFixed(1), "Accel (m/s²)": +((Ft - Fdr - Fr) / +mVeh).toFixed(3) });
    }
    setAccelData(data); setTab("graphs");
  };
    const genTimeVsRatio = () => {
    const data = [];
    const rho = 1.225, eta = 0.97;

    for (let G = 6; G <= 16; G += 0.5) {
      const t = simulate0to60(G, G, 999,
        +power, +Tpeak, +mVeh, +rW, +Cd, +Af, rho, +Crr, +mu, eta
      );

      data.push({
        ratio: G,
        time: +t.toFixed(2)
      });
    }

    setTimeData(data);
    setTab("graphs");
  };
  const genSafetyPlot = () => {
    const data = [];

    for (let m = 2; m <= 6; m += 0.5) {
      const res = designGear({ ...params(), targetRatio: ratio });

      if (!res?.best) continue;

      data.push({
        module: m,
        bending: +res.best.sf_b.toFixed(2),
        contact: +res.best.sf_c.toFixed(2)
      });
    }

    setSafetyData(data);
    setTab("graphs");
  };
  const TABS = ["inputs", "single", "twospeed", "graphs", "shifter"];
  const TLABELS = { inputs: "⚙ Inputs", single: "📐 Single Stage", twospeed: "🔁 Two-Speed", graphs: "📊 Graphs", shifter: "Shifter" };

  return (
    <div style={{ fontFamily: "ui-monospace, 'Cascadia Code', monospace", background: "#020c1b", minHeight: "100vh", color: "#e2e8f0", width: "100%", maxWidth: 1000, boxSizing: "border-box", margin: "auto", padding: "20px 20px 60px" }}>

      {/* Header */}
      <div style={{ marginBottom: 22, borderBottom: "1px solid #0a1e35", paddingBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#0ea5e9", marginBottom: 2 }}>{tab === "shifter" ? "SHIGLEY · AGMA · FORMULA SAE SHIFTER" : "SHIGLEY · AGMA · EV GEARBOX"}</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#f1f5f9" }}>Spur Gear Design Tool</h1>
        {tab !== "shifter" && <div style={{ color: "#334155", fontSize: 12, marginTop: 2 }}>Tesla Model 3 RWD Benchmark · Two-Speed Optimizer</div>}
      </div>

      {/* Mode */}
      {tab !== "shifter" && <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Btn active={mode === "simple"} onClick={() => setMode("simple")}>Simple</Btn>
        <Btn active={mode === "advanced"} onClick={() => setMode("advanced")}>Advanced</Btn>
        <span style={{ color: "#1e3a5f", fontSize: 11 }}>{mode === "advanced" ? "Max center distance constraint active" : "No packaging constraint"}</span>
      </div>}

      {/* Tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid #0a1e35", marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
            background: "transparent", fontWeight: tab === t ? 700 : 400, fontSize: 12,
            color: tab === t ? "#38bdf8" : "#334155",
            borderBottom: `2px solid ${tab === t ? "#38bdf8" : "transparent"}`,
          }}>{TLABELS[t]}</button>
        ))}
      </div>

      {tab === "shifter" && <ShifterWorkflow />}

      {/* ── INPUTS ── */}
      {tab === "inputs" && (<>
        <Card title="Vehicle & Powertrain" accent="#0ea5e9">
          <Row label="Peak Motor Power"><Inp value={power} onChange={e => setPower(e.target.value)} unit="kW" /></Row>
          <Row label="Motor Speed (input)"><Inp value={rpm} onChange={e => setRpm(e.target.value)} unit="rpm" /></Row>
          <Row label="Peak Motor Torque"><Inp value={Tpeak} onChange={e => setTpeak(e.target.value)} unit="N·m" /></Row>
          <Row label="Single-Speed Ratio"><Inp value={ratio} onChange={e => setRatio(e.target.value)} /></Row>
          <Row label="Vehicle Mass"><Inp value={mVeh} onChange={e => setMVeh(e.target.value)} unit="kg" /></Row>
          <Row label="Wheel Radius r_w"><Inp value={rW} onChange={e => setRW(e.target.value)} unit="m" /></Row>
          <Row label="Drag Coeff. Cd"><Inp value={Cd} onChange={e => setCd(e.target.value)} /></Row>
          <Row label="Frontal Area A"><Inp value={Af} onChange={e => setAf(e.target.value)} unit="m²" /></Row>
          <Row label="Rolling Resistance Crr"><Inp value={Crr} onChange={e => setCrr(e.target.value)} /></Row>
          <Row label="Friction Coeff. μ"><Inp value={mu} onChange={e => setMu(e.target.value)} /></Row>
        </Card>

        <Card title="Gear Design Parameters" accent="#8b5cf6">
          <Row label="Material">
            <Sel options={Object.keys(MATERIALS)} value={material} onChange={e => setMaterial(e.target.value)} />
          </Row>
          <Row label="Pressure Angle φ"><Inp value={phi} onChange={e => setPhi(e.target.value)} unit="°" /></Row>
          <Row label="Quality Number Qv" note="6=commercial 11=precision"><Inp value={Qv} onChange={e => setQv(e.target.value)} /></Row>
          <Row label="Overload Factor Ko"><Inp value={Ko} onChange={e => setKo(e.target.value)} /></Row>
          <Row label="Design Life"><Inp value={lifeH} onChange={e => setLifeH(e.target.value)} unit="hrs" /></Row>
          <Row label="Reliability">
            <Sel options={[0.9, 0.99, 0.999, 0.9999]} value={rel} onChange={e => setRel(e.target.value)} />
          </Row>
          <Row label="Min Bending SF"><Inp value={sfB} onChange={e => setSfB(e.target.value)} /></Row>
          <Row label="Min Contact SF"><Inp value={sfC} onChange={e => setSfC(e.target.value)} /></Row>
          {mode === "advanced" && (
            <Row label="Max Center Distance"><Inp value={maxC} onChange={e => setMaxC(e.target.value)} unit="mm" /></Row>
          )}
        </Card>

        <div style={{ marginTop: 4 }}>
          <Btn color="#10b981" onClick={runSingle}>▶ Run Single Stage</Btn>
          <Btn color="#0ea5e9" onClick={runTwo} disabled={running}>{running ? "⏳ Optimizing..." : "🔁 Optimize 2-Speed"}</Btn>
          <Btn onClick={genMotor}>Motor Curve</Btn>
          <Btn onClick={genTractiveMulti}>Tractive Force</Btn>
          <Btn onClick={genAccel}>Acceleration</Btn>
          <Btn onClick={genTimeVsRatio}>0–60 vs Ratio</Btn>
          <Btn onClick={genSafetyPlot}>Safety Factors</Btn>
        </div>
      </>)}

      {/* ── SINGLE STAGE ── */}
      {tab === "single" && (
        singleRes
          ? <GearCard title="Single Stage Design" result={singleRes} sfBreq={+sfB} sfCreq={+sfC} showSafety={mode === "advanced"} accent="#0ea5e9" />
          : <div style={{ color: "#334155", padding: 40, textAlign: "center" }}>Run from Inputs tab first.</div>
      )}

      {/* ── TWO-SPEED ── */}
      {tab === "twospeed" && (
        twoRes ? (<>
          <Card title="Optimal 2-Speed Strategy" accent="#10b981">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <SRow label="1st Gear (launch) G1" value={twoRes.G1} />
                <SRow label="2nd Gear (cruise) G2" value={twoRes.G2} />
                <SRow label="Shift Speed" value={twoRes.vs} unit="m/s" />
                <SRow label="0–60 mph (2-speed)" value={twoRes.t.toFixed(2)} unit="s" ok={true} />
                <SRow label="0–60 mph (baseline 9.04)" value={twoRes.baseline.toFixed(2)} unit="s" />
                <SRow label="Time saved" value={(twoRes.baseline - twoRes.t).toFixed(2)} unit="s" ok={true} />
              </tbody>
            </table>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <GearCard title="1st Gear Design" result={twoRes.g1} sfBreq={+sfB} sfCreq={+sfC} showSafety={mode === "advanced"} />
            <GearCard title="2nd Gear Design" result={twoRes.g2} sfBreq={+sfB} sfCreq={+sfC} showSafety={mode === "advanced"} />
          </div>
        </>) : <div style={{ color: "#334155", padding: 40, textAlign: "center" }}>Run from Inputs tab first.</div>
      )}

      {/* ── GRAPHS ── */}
      {tab === "graphs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {motorData.length > 0 && (
            <Card title="Motor Torque & Power vs RPM" accent="#38bdf8">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={motorData}>
                  <XAxis dataKey="rpm" stroke="#0a1e35" tick={{ fill: "#475569", fontSize: 11 }} />
                  <YAxis stroke="#0a1e35" tick={{ fill: "#475569", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#040f1e", border: "1px solid #1e3a5f", color: "#e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="Torque (Nm)" stroke="#38bdf8" dot={false} strokeWidth={2} />
                  <Line dataKey="Power (kW)"  stroke="#22c55e" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          {tractiveData.length > 0 && (
            <Card title="Tractive Force vs Speed — Multiple Gear Ratios" accent="#f97316">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={tractiveData}>
                  <XAxis dataKey="Speed (m/s)" stroke="#0a1e35" tick={{ fill: "#475569", fontSize: 11 }} />
                  <YAxis stroke="#0a1e35" tick={{ fill: "#475569", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#040f1e", border: "1px solid #1e3a5f", color: "#e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {[6,8,9.04,12,14].map((g,i) => (
                    <Line key={g} dataKey={`G=${g}`} stroke={["#f97316","#fb923c","#fbbf24","#a3e635","#34d399"][i]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          {accelData.length > 0 && (
            <Card title="Net Acceleration vs Speed (baseline G=9.04)" accent="#22c55e">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={accelData}>
                  <XAxis dataKey="Speed (m/s)" stroke="#0a1e35" tick={{ fill: "#475569", fontSize: 11 }} />
                  <YAxis stroke="#0a1e35" tick={{ fill: "#475569", fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#1e3a5f" strokeDasharray="4 2" />
                  <Tooltip contentStyle={{ background: "#040f1e", border: "1px solid #1e3a5f", color: "#e2e8f0", fontSize: 12 }} />
                  <Line dataKey="Accel (m/s²)" stroke="#22c55e" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          {timeData.length > 0 && (
            <Card title="0–60 Time vs Gear Ratio" accent="#a78bfa">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeData}>
                  <XAxis dataKey="ratio" stroke="#0a1e35" />
                  <YAxis stroke="#0a1e35" />
                  <Tooltip />
                  <Line dataKey="time" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          {safetyData.length > 0 && (
            <Card title="Safety Factors vs Module" accent="#f43f5e">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={safetyData}>
                  <XAxis dataKey="module" stroke="#0a1e35" />
                  <YAxis stroke="#0a1e35" />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="bending" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line dataKey="contact" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          {!motorData.length && !tractiveData.length && !accelData.length && (
            <div style={{ color: "#334155", padding: 40, textAlign: "center" }}>Generate graphs from the Inputs tab.</div>
          )}
        </div>
      )}
    </div>
  );
}
