import { useState } from "react";
import { MATERIALS } from "./gearCalculations.js";
import { calculateShifterDesign, SHIFTER_DEFAULTS } from "./shifterDesign.js";

const PAIRS = [[12, 60], [14, 70], [15, 75], [16, 80], [18, 90]];
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 9px", border: "1px solid #26445f", borderRadius: 4, background: "#061321", color: "#e6edf3", fontSize: 13 };
const labelStyle = { display: "grid", gap: 5, color: "#9aabba", fontSize: 12 };
const panelStyle = { borderTop: "1px solid #263b4d", padding: "16px 0" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" };
const ASSUMED_KEYS = [
  "motorKv", "operatingVoltageV", "faceWidthMm", "materialKey", "assumedMaterialKey", "shiftCycles", "qualityNumber",
  "overloadFactor", "meshEfficiency", "bendingSafetyFactorRequired",
  "contactSafetyFactorRequired", "reliability", "temperatureC", "rimThicknessFactor",
  "pinionRevolutionsPerShift", "sameMaterialForPair", "materialRatings", "kmBasis",
];
const VERIFIED_AS = {
  motorKv: "MANUFACTURER DATA",
  operatingVoltageV: "USER INPUT",
  faceWidthMm: "MANUFACTURER DATA",
  materialKey: "MANUFACTURER DATA",
  shiftCycles: "USER INPUT",
  qualityNumber: "MANUFACTURER DATA",
  overloadFactor: "USER INPUT",
  meshEfficiency: "USER INPUT",
  bendingSafetyFactorRequired: "USER INPUT",
  contactSafetyFactorRequired: "USER INPUT",
  reliability: "USER INPUT",
  temperatureC: "USER INPUT",
  rimThicknessFactor: "MANUFACTURER DATA",
  pinionRevolutionsPerShift: "USER INPUT",
  sameMaterialForPair: "MANUFACTURER DATA",
  materialRatings: "MANUFACTURER DATA",
  kmBasis: "USER INPUT",
};

function BasisTag({ basis }) {
  const colors = { "USER INPUT": "#78c6e8", DERIVED: "#a9b6ce", ASSUMED: "#e5b567", "MANUFACTURER DATA": "#80d3aa" };
  return <span style={{ color: colors[basis] || "#9aabba", fontSize: 9, fontWeight: 700, letterSpacing: ".04em", whiteSpace: "nowrap" }}>{basis}</span>;
}

function FieldHeading({ id, label, basis, verified, onVerify, verifiedAs, canConfirm = true }) {
  const displayedBasis = basis === "ASSUMED" && verified ? verifiedAs : basis;
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
    <label htmlFor={id}>{label}</label>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <BasisTag basis={displayedBasis} />
      {basis === "ASSUMED" && <label style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#8798a7", fontSize: 10 }}><input type="checkbox" checked={verified} onChange={onVerify} disabled={!canConfirm} aria-label={`Confirm ${label}`} />Confirm</label>}
    </span>
  </div>;
}

function NumberField({ id, label, unit, value, onChange, min, max, step = "any", basis = "USER INPUT", verified, onVerify, verifiedAs, canConfirm = true, readOnly = false }) {
  return <div style={labelStyle}>
    <FieldHeading id={id} label={label} basis={basis} verified={verified} onVerify={onVerify} verifiedAs={verifiedAs} canConfirm={canConfirm} />
    <span style={{ display: "flex", gap: 7, alignItems: "center" }}><input id={id} aria-label={label} style={{ ...inputStyle, opacity: readOnly ? 0.8 : 1 }} type="number" value={value} min={min} max={max} step={step} onChange={onChange} readOnly={readOnly} /><span style={{ minWidth: 26, color: "#718394" }}>{unit}</span></span>
  </div>;
}

function SelectField({ id, label, value, onChange, options, basis, verified, onVerify, verifiedAs, canConfirm = true }) {
  return <div style={labelStyle}>
    <FieldHeading id={id} label={label} basis={basis} verified={verified} onVerify={onVerify} verifiedAs={verifiedAs} canConfirm={canConfirm} />
    <select id={id} aria-label={label} style={inputStyle} value={value} onChange={onChange}>{options.map((option) => typeof option === "object" ? <option key={option.value} value={option.value}>{option.label}</option> : <option key={option}>{option}</option>)}</select>
  </div>;
}

function AssumptionConfirmation({ label, checked, onChange, verifiedAs, disabled = false }) {
  return <label style={{ display: "flex", alignItems: "center", gap: 7, color: "#a9bac7", fontSize: 11 }}>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-label={`Confirm ${label}`} />
    <span>{label}</span><BasisTag basis={checked ? verifiedAs : "ASSUMED"} />
  </label>;
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

function CheckStatus({ title, passed, detail }) {
  const color = passed ? "#72d6a0" : "#ff8a7a";
  return <div style={{ border: `1px solid ${passed ? "#347a5a" : "#8e4843"}`, borderLeft: `3px solid ${color}`, padding: "10px 12px", background: passed ? "#0a211b" : "#281819", minWidth: 0 }}>
    <div style={{ color: "#b7c6d1", fontSize: 11 }}>{title}</div>
    <strong style={{ display: "block", color, fontSize: 15, margin: "4px 0" }}>{passed ? "PASS" : "FAIL"}</strong>
    <div style={{ color: "#91a2af", fontSize: 10, lineHeight: 1.4 }}>{detail}</div>
  </div>;
}

function StrengthStatus({ title, passed, detail, preliminary }) {
  const color = passed ? "#72d6a0" : "#ff8a7a";
  return <div style={{ border: `1px solid ${passed ? "#347a5a" : "#8e4843"}`, borderLeft: `3px solid ${color}`, padding: "10px 12px", background: passed ? "#0a211b" : "#281819", minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 5, color: "#b7c6d1", fontSize: 11 }}><span>{title}</span>{preliminary && <span style={{ color: "#e5b567", fontSize: 9 }}>PRELIMINARY</span>}</div>
    <strong style={{ display: "block", color, fontSize: 15, margin: "4px 0" }}>{passed ? "PASS" : "FAIL"}</strong>
    <div style={{ color: "#91a2af", fontSize: 10, lineHeight: 1.4 }}>{detail}</div>
  </div>;
}

function GeometryStatus({ supported, detail }) {
  const color = supported ? "#72d6a0" : "#e5b567";
  return <div style={{ border: `1px solid ${supported ? "#347a5a" : "#ad7b35"}`, borderLeft: `3px solid ${color}`, padding: "10px 12px", background: supported ? "#0a211b" : "#282116", minWidth: 0 }}>
    <div style={{ color: "#b7c6d1", fontSize: 11 }}>Standard Geometry</div>
    <strong style={{ display: "block", color, fontSize: 13, margin: "4px 0" }}>{supported ? "SUPPORTED" : "STANDARD GEOMETRY WARNING"}</strong>
    <div style={{ color: "#91a2af", fontSize: 10, lineHeight: 1.4 }}>{detail}</div>
  </div>;
}

function Comparison({ inputs }) {
  const rows = PAIRS.map(([pinionTeeth, gearTeeth]) => calculateShifterDesign({ ...inputs, pinionTeeth, gearTeeth }).result);
  return <section style={panelStyle}>
    <h2 style={{ color: "#e2eaf0", fontSize: 15, margin: "0 0 5px" }}>Gear-pair comparison</h2>
    <p style={{ color: "#7d909f", fontSize: 11, margin: "0 0 12px" }}>Strength values are PRELIMINARY and depend on the assumed material and operating factors. Same DP, pressure angle, face width, loading, and calculation basis for all pairs.</p>
    <div style={{ overflowX: "auto" }}><table style={{ ...tableStyle, minWidth: 850 }}><thead><tr>{["Pair", "OD pinion / gear", "Center", "Ft", "Bending stress · PRELIMINARY", "Contact stress · PRELIMINARY", "SF bending", "SF contact", "Standard Geometry", "Torque margin"].map((heading) => <th key={heading} style={{ color: "#7e94a5", padding: "8px 5px", borderBottom: "1px solid #34495a", fontWeight: 600 }}>{heading}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={`${row.pinionTeeth}-${row.gearTeeth}`} style={{ borderBottom: "1px solid #1e3040" }}>
        <td style={{ padding: "9px 5px", color: "#e2eaf0" }}>{row.pinionTeeth}T / {row.gearTeeth}T</td>
        <td>{row.outsideDiameterPinionMm.toFixed(1)} / {row.outsideDiameterGearMm.toFixed(1)} mm</td>
        <td>{row.centerDistanceMm.toFixed(1)} mm</td><td>{row.tangentialForceN.toFixed(0)} N</td>
        <td>{Math.max(row.bendingPinionMPa, row.bendingGearMPa).toFixed(1)} MPa</td><td>{row.contactMPa.toFixed(1)} MPa</td>
        <td>{row.bendingSafety.toFixed(2)}</td><td>{row.contactSafety.toFixed(2)}</td>
        <td style={{ color: row.geometrySupported ? "#72d6a0" : "#e5b567", fontWeight: 700 }}>{row.geometrySupported ? "SUPPORTED" : "WARNING"}</td>
        <td style={{ color: row.torquePass ? "#72d6a0" : "#ff8a7a" }}>{row.torqueMarginNm.toFixed(2)} N·m</td>
      </tr>)}</tbody></table></div>
  </section>;
}

export default function ShifterMode() {
  const [inputs, setInputs] = useState({ ...SHIFTER_DEFAULTS });
  const [verified, setVerified] = useState(() => Object.fromEntries(ASSUMED_KEYS.map((key) => [key, false])));
  const analysis = calculateShifterDesign(inputs);
  const result = analysis.result;
  const update = (key) => (event) => {
    setInputs((current) => ({ ...current, [key]: event.target.value }));
    if (ASSUMED_KEYS.includes(key)) setVerified((current) => ({ ...current, [key]: false }));
    if (key === "materialKey") setVerified((current) => ({ ...current, materialRatings: false }));
  };
  const confirm = (key) => (event) => setVerified((current) => ({ ...current, [key]: event.target.checked }));
  const fieldBasis = (key) => ({
    basis: "ASSUMED",
    verified: verified[key],
    onVerify: confirm(key),
    verifiedAs: VERIFIED_AS[key],
  });
  const format = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
  const activeAssumptions = ASSUMED_KEYS.filter((key) => {
      if (inputs.motorSpeedMode === "direct" && ["motorKv", "operatingVoltageV"].includes(key)) return false;
      if (inputs.materialKey !== "Unknown / Not Selected" && key === "assumedMaterialKey") return false;
      return true;
    });
  const assumptionsRemain = activeAssumptions.some((key) => !verified[key]);
  const unconfirmedCount = activeAssumptions.filter((key) => !verified[key]).length;

  return <main style={{ color: "#e2eaf0", textAlign: "left" }}>
    <header style={{ marginBottom: 18 }}>
      <div style={{ color: "#64c4ae", fontSize: 10, letterSpacing: ".18em", marginBottom: 4 }}>LOW-DUTY-CYCLE TRANSMISSION · SHIGLEY / AGMA PROJECT METHOD</div>
      <h1 style={{ fontSize: 22, margin: 0, color: "#f1f5f7" }}>Sequential Shifter Gear Design</h1>
      <p style={{ color: "#8093a3", fontSize: 12, marginTop: 6 }}>ODrive D5065 270 kV candidate · single-stage external spur reduction. Shift life is entered as load cycles, not vehicle hours or mileage.</p>
    </header>

    <section style={panelStyle}>
      <h2 style={{ color: "#e2eaf0", fontSize: 15, margin: "0 0 12px" }}>Basic Design Inputs</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: "12px 18px" }}>
        <NumberField id="motorTorqueNm" label="Motor torque" unit="N·m" value={inputs.motorTorqueNm} onChange={update("motorTorqueNm")} min="0.01" />
        <SelectField id="motorSpeedMode" label="Motor speed source" value={inputs.motorSpeedMode} onChange={update("motorSpeedMode")} options={[{ value: "direct", label: "Direct RPM input" }, { value: "estimated", label: "Estimate from Kv × voltage" }]} />
        {inputs.motorSpeedMode === "direct" ? <NumberField id="motorSpeedRpm" label="Motor speed" unit="rpm" value={inputs.motorSpeedRpm} onChange={update("motorSpeedRpm")} min="1" /> : <>
          <NumberField id="motorKv" label="Motor Kv" unit="rpm/V" value={inputs.motorKv} onChange={update("motorKv")} min="1" {...fieldBasis("motorKv")} />
          <NumberField id="operatingVoltageV" label="Motor operating voltage" unit="V" value={inputs.operatingVoltageV} onChange={update("operatingVoltageV")} min="1" {...fieldBasis("operatingVoltageV")} />
          <NumberField id="estimatedMotorSpeedRpm" label="Estimated no-load motor speed" unit="rpm · estimate" value={Number(inputs.motorKv) * Number(inputs.operatingVoltageV)} readOnly basis="DERIVED" />
        </>}
        <NumberField id="pinionTeeth" label="Driver / pinion teeth" unit="teeth" value={inputs.pinionTeeth} onChange={update("pinionTeeth")} min="12" max="200" step="1" />
        <NumberField id="gearTeeth" label="Driven gear teeth" unit="teeth" value={inputs.gearTeeth} onChange={update("gearTeeth")} min="12" max="200" step="1" />
        <NumberField id="diametralPitch" label="Diametral pitch" unit="teeth/in" value={inputs.diametralPitch} onChange={update("diametralPitch")} min="4" max="80" />
        <NumberField id="pressureAngleDeg" label="Pressure angle" unit="degrees" value={inputs.pressureAngleDeg} onChange={update("pressureAngleDeg")} min="14.5" max="30" />
        <NumberField id="faceWidthMm" label="Face width" unit="mm" value={inputs.faceWidthMm} onChange={update("faceWidthMm")} min="0.1" {...fieldBasis("faceWidthMm")} />
        <SelectField id="materialKey" label="Gear material (both gears)" value={inputs.materialKey} onChange={update("materialKey")} options={["Unknown / Not Selected", ...Object.keys(MATERIALS)]} canConfirm={inputs.materialKey !== "Unknown / Not Selected"} {...fieldBasis("materialKey")} />
        <NumberField id="requiredOutputTorqueNm" label="Required output torque" unit="N·m" value={inputs.requiredOutputTorqueNm} onChange={update("requiredOutputTorqueNm")} min="0.01" />
        <NumberField id="shiftCycles" label="Design shift count" unit="shifts" value={inputs.shiftCycles} onChange={update("shiftCycles")} min="1" step="1" {...fieldBasis("shiftCycles")} />
      </div>
      <p style={{ color: "#74899a", fontSize: 11, lineHeight: 1.5, margin: "13px 0 0" }}>{inputs.motorSpeedMode === "estimated" ? `Estimated no-load RPM = ${inputs.motorKv} Kv × ${inputs.operatingVoltageV} V. This is a no-load estimate; loaded speed depends on the motor/controller operating point.` : "Motor RPM is directly specified; no Kv voltage-based estimate is applied."} Face width remains an assumption until verified from a gear specification. Gear material is unknown until a manufacturer specification is selected; the temporary analysis material is separately identified below.</p>
    </section>

    <details style={{ ...panelStyle, borderBottom: "1px solid #263b4d" }}>
      <summary style={{ color: "#e2eaf0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Advanced Shigley Parameters</summary>
      <p style={{ color: "#9aabba", fontSize: 11, lineHeight: 1.55, margin: "10px 0 14px" }}>These preliminary assumptions complete the Shigley analysis; replace or confirm them using the selected gear data and actual operating conditions. Confirming a value records your review, but does not independently verify the calculation model.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: "12px 18px" }}>
        <NumberField id="qualityNumber" label="Gear quality Qv" unit="AGMA" value={inputs.qualityNumber} onChange={update("qualityNumber")} min="5" max="12" {...fieldBasis("qualityNumber")} />
        <SelectField id="assumedMaterialKey" label="Temporary assumed analysis material" value={inputs.assumedMaterialKey} onChange={update("assumedMaterialKey")} options={Object.keys(MATERIALS)} {...fieldBasis("assumedMaterialKey")} canConfirm={false} />
        <NumberField id="overloadFactor" label="Overload factor Ko" unit="-" value={inputs.overloadFactor} onChange={update("overloadFactor")} min="1" max="5" {...fieldBasis("overloadFactor")} />
        <NumberField id="meshEfficiency" label="Mesh efficiency" unit="0–1" value={inputs.meshEfficiency} onChange={update("meshEfficiency")} min="0.01" max="1" step="0.01" {...fieldBasis("meshEfficiency")} />
        <NumberField id="bendingSafetyFactorRequired" label="Required bending safety factor" unit="-" value={inputs.bendingSafetyFactorRequired} onChange={update("bendingSafetyFactorRequired")} min="0.1" step="0.1" {...fieldBasis("bendingSafetyFactorRequired")} />
        <NumberField id="contactSafetyFactorRequired" label="Required contact safety factor" unit="-" value={inputs.contactSafetyFactorRequired} onChange={update("contactSafetyFactorRequired")} min="0.1" step="0.1" {...fieldBasis("contactSafetyFactorRequired")} />
        <SelectField id="reliability" label="Reliability" value={inputs.reliability} onChange={update("reliability")} options={[0.9, 0.99, 0.999, 0.9999].map((value) => ({ value, label: `${(value * 100).toFixed(value === 0.9999 ? 2 : value === 0.999 ? 1 : 0)}%` }))} {...fieldBasis("reliability")} />
        <NumberField id="temperatureC" label="Gear temperature" unit="°C" value={inputs.temperatureC} onChange={update("temperatureC")} min="0" max="120" {...fieldBasis("temperatureC")} />
        <NumberField id="rimThicknessFactor" label="Rim thickness factor KB" unit="-" value={inputs.rimThicknessFactor} onChange={update("rimThicknessFactor")} min="1" step="0.05" {...fieldBasis("rimThicknessFactor")} />
        <NumberField id="pinionRevolutionsPerShift" label="Loaded pinion revolutions / shift" unit="rev/shift" value={inputs.pinionRevolutionsPerShift} onChange={update("pinionRevolutionsPerShift")} min="0.01" step="0.1" {...fieldBasis("pinionRevolutionsPerShift")} />
      </div>
      <div style={{ display: "grid", gap: 9, marginTop: 14, paddingTop: 12, borderTop: "1px solid #203547" }}>
        <AssumptionConfirmation label="Both gears use the selected material" checked={verified.sameMaterialForPair} onChange={confirm("sameMaterialForPair")} verifiedAs={VERIFIED_AS.sameMaterialForPair} disabled={inputs.materialKey === "Unknown / Not Selected"} />
        <AssumptionConfirmation label="Project-library allowable stresses match the gear manufacturer's material and heat-treatment ratings" checked={verified.materialRatings} onChange={confirm("materialRatings")} verifiedAs={VERIFIED_AS.materialRatings} disabled={inputs.materialKey === "Unknown / Not Selected"} />
        <AssumptionConfirmation label="The shifter housing/alignment matches the precision-enclosed, uncrowned Km assumption" checked={verified.kmBasis} onChange={confirm("kmBasis")} verifiedAs={VERIFIED_AS.kmBasis} />
      </div>
    </details>

    {analysis.errors.length > 0 && <div role="alert" style={{ margin: "12px 0", padding: 12, border: "1px solid #a44943", background: "#2a1718", color: "#ffb0a7", fontSize: 12 }}>{analysis.errors.map((error) => <div key={error}>{error}</div>)}</div>}

    {result && <>
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div><h2 style={{ color: "#e2eaf0", fontSize: 15, margin: 0 }}>Design result</h2><div style={{ color: "#8798a7", fontSize: 10, marginTop: 4 }}>{assumptionsRemain ? `${unconfirmedCount} assumed values remain unconfirmed` : "All user-confirmable values are marked confirmed; model limitations remain"}</div></div>
          <span style={{ border: `1px solid ${assumptionsRemain ? "#ad7b35" : "#347a5a"}`, color: assumptionsRemain ? "#e5b567" : "#80d3aa", padding: "5px 10px", fontSize: 12, fontWeight: 800 }}>{assumptionsRemain ? "PRELIMINARY" : "VERIFIED INPUTS"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 175px), 1fr))", gap: 9, marginBottom: 12 }}>
          <CheckStatus title="Output Torque" passed={result.torquePass} detail={`${format(result.outputTorqueNm)} / ${format(result.requiredOutputTorqueNm)} N·m required · margin ${format(result.torqueMarginNm)} N·m`} />
          <StrengthStatus title="Bending Strength" passed={result.bendingPass} preliminary={assumptionsRemain} detail={`Minimum SF ${format(result.bendingSafety, 2)} / ${format(result.bendingSafetyFactorRequired, 2)} required`} />
          <StrengthStatus title="Contact Strength" passed={result.contactPass} preliminary={assumptionsRemain} detail={`SF ${format(result.contactSafety, 2)} / ${format(result.contactSafetyFactorRequired, 2)} required`} />
            <GeometryStatus supported={result.geometrySupported} detail={result.geometrySupported ? `${result.pinionTeeth}T pinion meets the ${result.minimumTeeth}T minimum.` : `${result.pinionTeeth}T pinion is below the ${result.minimumTeeth}T minimum for ${result.pressureAngleDeg}° standard full-depth involute teeth. Investigate profile modification or a different tooth count; profile shift is not assumed.`} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", background: result.pass ? "#0a211b" : "#281819", border: `1px solid ${result.pass ? "#347a5a" : "#8e4843"}`, marginBottom: 14 }}>
          <strong style={{ color: "#dce5eb", fontSize: 12 }}>Overall result</strong>
            <strong style={{ color: result.pass ? "#72d6a0" : "#ff8a7a", fontSize: 13 }}>{result.pass ? (result.geometrySupported ? "PASS" : "PASS WITH STANDARD GEOMETRY WARNING") : "FAIL"}</strong>
        </div>
        <p style={{ color: "#8193a2", fontSize: 10, lineHeight: 1.45, margin: "0 0 14px" }}>Output torque is checked directly against the required torque. Bending and contact safety factors apply only to their respective gear-strength checks; they are not multiplied into the torque requirement.</p>
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
            <h3 style={{ color: "#91a6b6", fontSize: 12, margin: "0 0 5px" }}>Tooth loads and stress{assumptionsRemain ? " · PRELIMINARY" : ""}</h3>
            <table style={tableStyle}><tbody>
              <OutputRow label={inputs.motorSpeedMode === "estimated" ? "Estimated no-load speed" : "Specified motor speed"} value={format(result.motorSpeedUsedRpm, 1)} unit="rpm" />
              <OutputRow label="Pitch-line velocity" value={format(result.velocityMs, 3)} unit="m/s" />
              <OutputRow label="Tangential / radial / normal force" value={`${format(result.tangentialForceN, 1)} / ${format(result.radialForceN, 1)} / ${format(result.normalForceN, 1)} N`} />
              <OutputRow label="Design tangential load Ko·Kv·Wt" value={format(result.designLoadN, 1)} unit="N" />
              <OutputRow label="Bending stress (pinion / gear)" value={`${format(result.bendingPinionMPa, 1)} / ${format(result.bendingGearMPa, 1)} MPa`} />
              <OutputRow label="Contact stress" value={format(result.contactMPa, 1)} unit="MPa" />
              <OutputRow label="Allowable bending / contact" value={`${format(result.bendingAllowableMPa, 1)} / ${format(result.contactAllowableMPa, 1)} MPa`} />
              <OutputRow label="Bending SF (pinion / gear)" value={`${format(result.bendingSafetyPinion, 2)} / ${format(result.bendingSafetyGear, 2)}`} good={result.bendingPass} bad={!result.bendingPass} />
              <OutputRow label="Contact safety factor" value={format(result.contactSafety, 2)} good={result.contactPass} bad={!result.contactPass} />
              <OutputRow label="Life basis" value={`${format(result.lifeCycles, 0)} pinion load cycles`} />
            </tbody></table>
          </div>
        </div>
        <div style={{ marginTop: 18 }}><h3 style={{ color: "#91a6b6", fontSize: 12, margin: "0 0 8px" }}>Scaled side view</h3><GearVisualization result={result} /><div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "#8598a8", fontSize: 10, marginTop: 6 }}><span>Solid outline: outside diameter</span><span>Dashed circle: pitch diameter</span><span>Schematic tooth form, not an involute profile</span></div></div>
      </section>

      <Comparison inputs={inputs} />

      <section style={panelStyle}>
        <details>
          <summary style={{ color: "#b6c5d0", fontSize: 13, cursor: "pointer" }}>Shigley Calculation Details</summary>
          <p style={{ color: "#91a2af", fontSize: 11, lineHeight: 1.55, margin: "10px 0" }}>USER INPUT values are directly entered design targets/candidate dimensions. DERIVED values come from those inputs and the shared project calculation functions. ASSUMED values are editable placeholders until confirmed. MANUFACTURER DATA tags appear only after you mark an assumed gear property as confirmed against the selected gear documentation.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 18, marginTop: 12 }}>
            <table style={tableStyle}><tbody>
              <OutputRow label="Ko overload · ASSUMED" value={format(result.factors.Ko, 3)} /><OutputRow label="Kv dynamic · DERIVED" value={format(result.factors.Kv, 4)} />
              <OutputRow label="Ks size · DERIVED" value={format(result.factors.Ks, 4)} /><OutputRow label="Km load distribution · DERIVED" value={format(result.factors.Km, 4)} />
              <OutputRow label="KB rim thickness · ASSUMED" value={format(result.factors.KB, 3)} /><OutputRow label="J pinion / gear · DERIVED" value={`${format(result.factors.JPinion, 4)} / ${format(result.factors.JGear, 4)}`} />
              <OutputRow label="I contact geometry · DERIVED" value={format(result.factors.I, 5)} />
            </tbody></table>
            <table style={tableStyle}><tbody>
              <OutputRow label="KL bending life · DERIVED" value={format(result.factors.KL, 4)} /><OutputRow label="KR reliability · DERIVED" value={format(result.factors.KR, 3)} />
              <OutputRow label="KT temperature · DERIVED" value={format(result.factors.KT, 3)} /><OutputRow label="Life cycles · DERIVED" value={`${format(result.shiftCycles, 0)} shifts × ${format(result.pinionRevolutionsPerShift, 2)} rev/shift`} />
              <OutputRow label="Resulting pinion load cycles" value={format(result.lifeCycles, 0)} unit="cycles" /><OutputRow label="Unshifted minimum teeth" value={result.minimumTeeth} />
              <OutputRow label={`Analysis material${result.materialKey === "Unknown / Not Selected" ? " · TEMPORARY ASSUMPTION" : " · SELECTED GRADE"}`} value={result.effectiveMaterialKey} />
              <OutputRow label={`Material σb number · ${verified.materialRatings ? "MANUFACTURER DATA" : "ASSUMED PROJECT LIBRARY"}`} value={format(MATERIALS[result.effectiveMaterialKey].sigma_b, 1)} unit="MPa" />
              <OutputRow label={`Material σc number · ${verified.materialRatings ? "MANUFACTURER DATA" : "ASSUMED PROJECT LIBRARY"}`} value={format(MATERIALS[result.effectiveMaterialKey].sigma_c, 1)} unit="MPa" />
              <OutputRow label="Material library hardness" value={MATERIALS[result.effectiveMaterialKey].HB} unit="HB" />
              <OutputRow label="Geometry applicability" value={result.geometrySupported ? "Within basic limit" : "Undercut risk / unsupported"} bad={!result.geometrySupported} />
            </tbody></table>
          </div>
          <div style={{ color: "#91a2af", fontSize: 11, lineHeight: 1.55, marginTop: 10 }}>
            <p>Existing project forms: Wt = 2T/d; σb = WtKoKvKsKmKB / (mFJ); σc = Cp√[WtKoKvKsKm / (FdI)]. Allowables: σb,allow = σb,number KL / (KTKR); σc,allow = σc,number√KL / (KT√KR).</p>
            <p>Output torque = motor torque × actual ratio × mesh efficiency; no bending/contact safety factor is applied to the torque target.</p>
          </div>
          <p style={{ color: "#91a2af", fontSize: 11, lineHeight: 1.55 }}>Allowable stress values come from the project's material library, not an entered manufacturer certificate. Face width and the same-material-for-both-gears selection are only manufacturer data after confirmation. KB remains an assumed solid-rim factor unless actual rim geometry establishes another value. Loaded pinion cycles are derived from shift count × loaded pinion revolutions per shift; motion data is not available to derive revolutions per shift automatically.</p>
          <ul style={{ paddingLeft: 18, color: "#a9bac7", fontSize: 11, lineHeight: 1.6 }}>{analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <p style={{ borderTop: "1px solid #283c4d", paddingTop: 10, color: "#91a2af", fontSize: 11, lineHeight: 1.6 }}>Stress calculations reuse the existing app factor equations and material library; they are a screening analysis, not a certified gear rating. In particular, the existing J fit is not valid for an undercut 12T tooth, the cycle-life curve is inherited from the project, and mesh shock, profile shift, shaft/bearing deflection, lubrication, surface finish, and detailed material/process certification require engineering confirmation. A FAIL reflects unmet torque/safety requirements or unsupported standard geometry; do not use this result as a release approval.</p>
        </details>
      </section>
    </>}
  </main>;
}
