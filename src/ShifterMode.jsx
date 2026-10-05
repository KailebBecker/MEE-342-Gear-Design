import { useState } from "react";
import { MATERIALS } from "./gearCalculations.js";
import { calculateShifterDesign, SHIFTER_DEFAULTS } from "./shifterDesign.js";

const PAIRS = [[12, 60], [14, 70], [16, 80]];
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 9px", border: "1px solid #26445f", borderRadius: 4, background: "#061321", color: "#e6edf3", fontSize: 13 };
const labelStyle = { display: "grid", gap: 5, color: "#9aabba", fontSize: 12 };
const panelStyle = { borderTop: "1px solid #263b4d", padding: "16px 0" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" };

function NumberField({ label, unit, value, onChange, min, max, step = "any" }) {
  return <label style={labelStyle}>{label}<span style={{ display: "flex", gap: 7, alignItems: "center" }}><input style={inputStyle} type="number" value={value} min={min} max={max} step={step} onChange={onChange} /><span style={{ minWidth: 26, color: "#718394" }}>{unit}</span></span></label>;
}

function GearShape({ teeth, outerRadius, rootRadius, centerX, centerY, color }) {
  const points = [];
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const base = (tooth / teeth) * Math.PI * 2 - Math.PI / 2;
    for (const [fraction, radius] of [[0, rootRadius], [0.18, outerRadius], [0.52, outerRadius], [0.7, rootRadius]]) {
      const angle = base + (fraction / teeth) * Math.PI * 2;
      points.push(`${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}`);
    }
  }
  return <polygon points={points.join(" ")} fill={`${color}24`} stroke={color} strokeWidth="1.5" />;
}

function GearVisualization({ result }) {
  const maxDiameter = Math.max(result.outsideDiameterPinionMm, result.outsideDiameterGearMm);
  const scale = 166 / maxDiameter;
  const leftX = 120;
  const centerY = 114;
  const rightX = leftX + result.centerDistanceMm * scale;
  const pinionOuter = result.outsideDiameterPinionMm * scale / 2;
  const gearOuter = result.outsideDiameterGearMm * scale / 2;
  const pinionPitch = result.pitchDiameterPinionMm * scale / 2;
  const gearPitch = result.pitchDiameterGearMm * scale / 2;
  const pinionRoot = result.rootDiameterPinionMm * scale / 2;
  const gearRoot = result.rootDiameterGearMm * scale / 2;
  return <svg viewBox="0 0 540 245" role="img" aria-label={`Scaled side view of ${result.pinionTeeth}-tooth pinion and ${result.gearTeeth}-tooth driven gear`} style={{ width: "100%", display: "block", background: "#071522", border: "1px solid #203547", borderRadius: 4 }}>
    <line x1="26" y1={centerY} x2="514" y2={centerY} stroke="#24394a" strokeDasharray="4 5" />
    <GearShape teeth={result.pinionTeeth} outerRadius={pinionOuter} rootRadius={pinionRoot} centerX={leftX} centerY={centerY} color="#5dc8b1" />
    <GearShape teeth={result.gearTeeth} outerRadius={gearOuter} rootRadius={gearRoot} centerX={rightX} centerY={centerY} color="#e7ad59" />
    <circle cx={leftX} cy={centerY} r={pinionPitch} fill="none" stroke="#5dc8b1" strokeDasharray="5 4" opacity=".8" />
    <circle cx={rightX} cy={centerY} r={gearPitch} fill="none" stroke="#e7ad59" strokeDasharray="5 4" opacity=".8" />
    <circle cx={leftX} cy={centerY} r="3" fill="#d9e4ed" /><circle cx={rightX} cy={centerY} r="3" fill="#d9e4ed" />
    <line x1={leftX} y1="214" x2={rightX} y2="214" stroke="#a2b2c1" />
    <line x1={leftX} y1="205" x2={leftX} y2="220" stroke="#a2b2c1" />
    <line x1={rightX} y1="205" x2={rightX} y2="220" stroke="#a2b2c1" />
    <text x={leftX} y="239" fill="#c5d2dc" fontSize="11" textAnchor="middle">{result.centerDistanceMm.toFixed(1)} mm center distance</text>
    <text x={leftX} y="22" fill="#5dc8b1" fontSize="11" textAnchor="middle">Driver · {result.pinionTeeth}T</text>
    <text x={rightX} y="22" fill="#e7ad59" fontSize="11" textAnchor="middle">Driven · {result.gearTeeth}T</text>
  </svg>;
}

function OutputRow({ label, value, unit = "", good, bad }) {
  const color = good ? "#72d6a0" : bad ? "#ff8a7a" : "#e2eaf0";
  return <tr style={{ borderBottom: "1px solid #1e3040" }}><td style={{ padding: "7px 4px", color: "#91a2b1" }}>{label}</td><td style={{ padding: "7px 4px", color, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}{unit && <span style={{ color: "#758899", marginLeft: 4 }}>{unit}</span>}</td></tr>;
}

function Comparison({ inputs }) {
  const rows = PAIRS.map(([pinionTeeth, gearTeeth]) => calculateShifterDesign({ ...inputs, pinionTeeth, gearTeeth }).result);
  return <section style={panelStyle}>
    <h2 style={{ color: "#e2eaf0", fontSize: 15, margin: "0 0 5px" }}>Gear-pair comparison</h2>
    <p style={{ color: "#7d909f", fontSize: 11, margin: "0 0 12px" }}>Same material, loading, face width, DP, quality, and life assumptions for each pair.</p>
    <div style={{ overflowX: "auto" }}><table style={{ ...tableStyle, minWidth: 760 }}><thead><tr>{["Pair", "OD pinion / gear", "Center", "Ft", "Bending stress max", "Contact stress", "SF bending", "SF contact", "Torque margin", "Status"].map((heading) => <th key={heading} style={{ color: "#7e94a5", padding: "8px 5px", borderBottom: "1px solid #34495a", fontWeight: 600 }}>{heading}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={`${row.pinionTeeth}-${row.gearTeeth}`} style={{ borderBottom: "1px solid #1e3040" }}>
        <td style={{ padding: "9px 5px", color: "#e2eaf0" }}>{row.pinionTeeth}T / {row.gearTeeth}T</td>
        <td>{row.outsideDiameterPinionMm.toFixed(1)} / {row.outsideDiameterGearMm.toFixed(1)} mm</td>
        <td>{row.centerDistanceMm.toFixed(1)} mm</td><td>{row.tangentialForceN.toFixed(0)} N</td>
        <td>{Math.max(row.bendingPinionMPa, row.bendingGearMPa).toFixed(1)} MPa</td><td>{row.contactMPa.toFixed(1)} MPa</td>
        <td>{row.bendingSafety.toFixed(2)}</td><td>{row.contactSafety.toFixed(2)}</td>
        <td style={{ color: row.torquePass ? "#72d6a0" : "#ff8a7a" }}>{row.torqueMarginNm.toFixed(2)} N·m</td>
        <td style={{ color: row.pass ? "#72d6a0" : "#ff8a7a", fontWeight: 700 }}>{row.pass ? "PASS" : "FAIL"}</td>
      </tr>)}</tbody></table></div>
  </section>;
}

export default function ShifterMode() {
  const [inputs, setInputs] = useState({ ...SHIFTER_DEFAULTS });
  const analysis = calculateShifterDesign(inputs);
  const result = analysis.result;
  const update = (key) => (event) => setInputs((current) => ({ ...current, [key]: event.target.value }));
  const format = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";

  return <main style={{ color: "#e2eaf0", textAlign: "left" }}>
    <header style={{ marginBottom: 18 }}>
      <div style={{ color: "#64c4ae", fontSize: 10, letterSpacing: ".18em", marginBottom: 4 }}>LOW-DUTY-CYCLE TRANSMISSION · SHIGLEY / AGMA PROJECT METHOD</div>
      <h1 style={{ fontSize: 22, margin: 0, color: "#f1f5f7" }}>Sequential Shifter Gear Design</h1>
      <p style={{ color: "#8093a3", fontSize: 12, marginTop: 6 }}>ODrive D5065 270 kV candidate · single-stage external spur reduction. Shift life is entered as load cycles, not vehicle hours or mileage.</p>
    </header>

    <section style={panelStyle}>
      <h2 style={{ color: "#e2eaf0", fontSize: 15, margin: "0 0 12px" }}>Design inputs</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: "12px 18px" }}>
        <NumberField label="Motor torque" unit="N·m" value={inputs.motorTorqueNm} onChange={update("motorTorqueNm")} min="0.01" />
        <NumberField label="Motor speed" unit="rpm" value={inputs.motorSpeedRpm} onChange={update("motorSpeedRpm")} min="1" />
        <NumberField label="Driver / pinion teeth" unit="teeth" value={inputs.pinionTeeth} onChange={update("pinionTeeth")} min="12" max="200" step="1" />
        <NumberField label="Driven gear teeth" unit="teeth" value={inputs.gearTeeth} onChange={update("gearTeeth")} min="12" max="200" step="1" />
        <NumberField label="Diametral pitch" unit="teeth/in" value={inputs.diametralPitch} onChange={update("diametralPitch")} min="4" max="80" />
        <NumberField label="Pressure angle" unit="degrees" value={inputs.pressureAngleDeg} onChange={update("pressureAngleDeg")} min="14.5" max="30" />
        <NumberField label="Face width" unit="mm" value={inputs.faceWidthMm} onChange={update("faceWidthMm")} min="0.1" />
        <label style={labelStyle}>Gear material<select style={inputStyle} value={inputs.materialKey} onChange={update("materialKey")}>{Object.keys(MATERIALS).map((material) => <option key={material}>{material}</option>)}</select></label>
        <NumberField label="Gear quality Qv" unit="AGMA" value={inputs.qualityNumber} onChange={update("qualityNumber")} min="5" max="12" />
        <NumberField label="Overload factor Ko" unit="-" value={inputs.overloadFactor} onChange={update("overloadFactor")} min="1" max="5" />
        <NumberField label="Required output torque" unit="N·m" value={inputs.requiredOutputTorqueNm} onChange={update("requiredOutputTorqueNm")} min="0.01" />
        <NumberField label="Mesh efficiency" unit="0–1" value={inputs.meshEfficiency} onChange={update("meshEfficiency")} min="0.01" max="1" step="0.01" />
        <NumberField label="Required bending safety factor" unit="-" value={inputs.bendingSafetyFactorRequired} onChange={update("bendingSafetyFactorRequired")} min="0.1" step="0.1" />
        <NumberField label="Required contact safety factor" unit="-" value={inputs.contactSafetyFactorRequired} onChange={update("contactSafetyFactorRequired")} min="0.1" step="0.1" />
        <NumberField label="Design shift count" unit="shifts" value={inputs.shiftCycles} onChange={update("shiftCycles")} min="1" step="1" />
        <NumberField label="Loaded pinion revolutions / shift" unit="rev/shift" value={inputs.pinionRevolutionsPerShift} onChange={update("pinionRevolutionsPerShift")} min="0.01" step="0.1" />
        <label style={labelStyle}>Reliability<select style={inputStyle} value={inputs.reliability} onChange={update("reliability")}>{[0.9, 0.99, 0.999, 0.9999].map((value) => <option key={value} value={value}>{(value * 100).toFixed(value === 0.9999 ? 2 : value === 0.999 ? 1 : 0)}%</option>)}</select></label>
        <NumberField label="Gear temperature" unit="°C" value={inputs.temperatureC} onChange={update("temperatureC")} min="0" max="120" />
        <NumberField label="Rim thickness factor KB" unit="-" value={inputs.rimThicknessFactor} onChange={update("rimThicknessFactor")} min="1" step="0.05" />
      </div>
      <p style={{ color: "#74899a", fontSize: 11, lineHeight: 1.5, margin: "13px 0 0" }}>Assumptions to confirm: 6480 rpm corresponds to 270 kV at 24 V no-load; 10,000 shifts and 1 loaded pinion revolution per shift are placeholders; Ko=1.5 represents shock loading; 12.7 mm face width and 97% efficiency are editable estimates. KT=1 is supported only through 120 °C. Bending geometry factor support is limited to 20° full-depth teeth.</p>
    </section>

    {analysis.errors.length > 0 && <div role="alert" style={{ margin: "12px 0", padding: 12, border: "1px solid #a44943", background: "#2a1718", color: "#ffb0a7", fontSize: 12 }}>{analysis.errors.map((error) => <div key={error}>{error}</div>)}</div>}

    {result && <>
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ color: "#e2eaf0", fontSize: 15, margin: 0 }}>Design result</h2>
          <span style={{ border: `1px solid ${result.pass ? "#3b9b70" : "#bd5a50"}`, color: result.pass ? "#72d6a0" : "#ff8a7a", padding: "5px 10px", fontSize: 12, fontWeight: 800 }}>{result.pass ? "PASS" : "FAIL"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 18 }}>
          <div>
            <h3 style={{ color: "#91a6b6", fontSize: 12, margin: "0 0 5px" }}>Geometry and output</h3>
            <table style={tableStyle}><tbody>
              <OutputRow label="Actual reduction" value={`${format(result.ratio, 3)}:1`} />
              <OutputRow label="Pitch diameters (pinion / gear)" value={`${format(result.pitchDiameterPinionMm, 2)} / ${format(result.pitchDiameterGearMm, 2)} mm`} />
              <OutputRow label="Outside diameters (pinion / gear)" value={`${format(result.outsideDiameterPinionMm, 2)} / ${format(result.outsideDiameterGearMm, 2)} mm`} />
              <OutputRow label="Root diameters (pinion / gear)" value={`${format(result.rootDiameterPinionMm, 2)} / ${format(result.rootDiameterGearMm, 2)} mm`} />
              <OutputRow label="Center distance" value={format(result.centerDistanceMm)} unit="mm" />
              <OutputRow label="Output speed" value={format(result.outputSpeedRpm, 1)} unit="rpm" />
              <OutputRow label="Calculated output torque" value={format(result.outputTorqueNm)} unit="N·m" good={result.torquePass} bad={!result.torquePass} />
              <OutputRow label="Required output torque" value={format(result.requiredOutputTorqueNm)} unit="N·m" />
              <OutputRow label="Torque margin" value={format(result.torqueMarginNm)} unit="N·m" good={result.torquePass} bad={!result.torquePass} />
            </tbody></table>
          </div>
          <div>
            <h3 style={{ color: "#91a6b6", fontSize: 12, margin: "0 0 5px" }}>Tooth loads and stress</h3>
            <table style={tableStyle}><tbody>
              <OutputRow label="Pitch-line velocity" value={format(result.velocityMs, 3)} unit="m/s" />
              <OutputRow label="Tangential / radial / normal force" value={`${format(result.tangentialForceN, 1)} / ${format(result.radialForceN, 1)} / ${format(result.normalForceN, 1)} N`} />
              <OutputRow label="Design tangential load Ko·Kv·Wt" value={format(result.designLoadN, 1)} unit="N" />
              <OutputRow label="Bending stress (pinion / gear)" value={`${format(result.bendingPinionMPa, 1)} / ${format(result.bendingGearMPa, 1)} MPa`} />
              <OutputRow label="Contact stress" value={format(result.contactMPa, 1)} unit="MPa" />
              <OutputRow label="Allowable bending / contact" value={`${format(result.bendingAllowableMPa, 1)} / ${format(result.contactAllowableMPa, 1)} MPa`} />
              <OutputRow label="Bending SF (pinion / gear)" value={`${format(result.bendingSafetyPinion, 2)} / ${format(result.bendingSafetyGear, 2)}`} good={result.bendingSafety >= result.bendingSafetyFactorRequired} bad={result.bendingSafety < result.bendingSafetyFactorRequired} />
              <OutputRow label="Contact safety factor" value={format(result.contactSafety, 2)} good={result.contactSafety >= result.contactSafetyFactorRequired} bad={result.contactSafety < result.contactSafetyFactorRequired} />
              <OutputRow label="Life basis" value={`${format(result.lifeCycles, 0)} pinion load cycles`} />
            </tbody></table>
          </div>
        </div>
        <div style={{ marginTop: 18 }}><h3 style={{ color: "#91a6b6", fontSize: 12, margin: "0 0 8px" }}>Scaled side view</h3><GearVisualization result={result} /><div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "#8598a8", fontSize: 10, marginTop: 6 }}><span>Solid outline: outside diameter</span><span>Dashed circle: pitch diameter</span><span>Schematic tooth form, not an involute profile</span></div></div>
      </section>

      <Comparison inputs={inputs} />

      <section style={panelStyle}>
        <details>
          <summary style={{ color: "#b6c5d0", fontSize: 13, cursor: "pointer" }}>Calculation factors, assumptions, and applicability</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 18, marginTop: 12 }}>
            <table style={tableStyle}><tbody>
              <OutputRow label="Ko overload" value={format(result.factors.Ko, 3)} /><OutputRow label="Kv dynamic" value={format(result.factors.Kv, 4)} />
              <OutputRow label="Ks size" value={format(result.factors.Ks, 4)} /><OutputRow label="Km load distribution" value={format(result.factors.Km, 4)} />
              <OutputRow label="KB rim thickness" value={format(result.factors.KB, 3)} /><OutputRow label="J pinion / gear" value={`${format(result.factors.JPinion, 4)} / ${format(result.factors.JGear, 4)}`} />
              <OutputRow label="I contact geometry" value={format(result.factors.I, 5)} />
            </tbody></table>
            <table style={tableStyle}><tbody>
              <OutputRow label="KL bending life" value={format(result.factors.KL, 4)} /><OutputRow label="KR reliability" value={format(result.factors.KR, 3)} />
              <OutputRow label="KT temperature" value={format(result.factors.KT, 3)} /><OutputRow label="Life cycles" value={format(result.lifeCycles, 0)} unit="revolutions" />
              <OutputRow label="Unshifted minimum teeth" value={result.minimumTeeth} /><OutputRow label="Geometry applicability" value={result.geometrySupported ? "Within basic limit" : "Undercut risk / unsupported"} bad={!result.geometrySupported} />
            </tbody></table>
          </div>
          <ul style={{ paddingLeft: 18, color: "#a9bac7", fontSize: 11, lineHeight: 1.6 }}>{analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <p style={{ borderTop: "1px solid #283c4d", paddingTop: 10, color: "#91a2af", fontSize: 11, lineHeight: 1.6 }}>Stress calculations reuse the existing app factor equations and material library; they are a screening analysis, not a certified gear rating. In particular, the existing J fit is not valid for an undercut 12T tooth, the cycle-life curve is inherited from the project, and mesh shock, profile shift, shaft/bearing deflection, lubrication, surface finish, and detailed material/process certification require engineering confirmation. A FAIL reflects unmet torque/safety requirements or unsupported standard geometry; do not use this result as a release approval.</p>
        </details>
      </section>
    </>}
  </main>;
}
