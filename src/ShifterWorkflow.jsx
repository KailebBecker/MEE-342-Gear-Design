import { useRef, useState } from "react";
import { MATERIALS } from "./gearCalculations.js";
import { calculateShifterDesign, SHIFTER_DEFAULTS } from "./shifterDesign.js";

const PAIRS = [[12, 60], [14, 70], [15, 75], [16, 80], [18, 90]];
const INPUT_STYLE = { width: "100%", boxSizing: "border-box", padding: "8px 9px", border: "1px solid #314a5c", borderRadius: 4, background: "#071622", color: "#e6edf3", fontSize: 13 };
const PANEL_STYLE = { border: "1px solid #293f50", borderRadius: 6, padding: 15, marginBottom: 11, background: "#061321" };
const GRID_STYLE = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: "12px 16px" };
const TABLE_STYLE = { width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left" };
const HELP = {
  diametralPitch: "Number of gear teeth per inch of pitch diameter. Both meshing gears must use the same DP.",
  pressureAngleDeg: "Tooth-flank angle that affects tooth shape and separating force. Use the specified gear standard.",
  faceWidthMm: "Axial width of the gear tooth face. Use the manufacturer's value when the gear is selected.",
  qualityNumber: "AGMA Qv grade used by the dynamic factor calculation. Confirm it from the gear specification.",
  overloadFactor: "Ko accounts for application overload beyond nominal transmitted load. Select for actual shock/service conditions.",
  rimThicknessFactor: "KB accounts for a thin gear rim. The current value assumes a solid gear blank unless geometry shows otherwise.",
  bendingSafetyFactorRequired: "Required ratio of allowable bending stress to calculated bending stress.",
  contactSafetyFactorRequired: "Required ratio of allowable contact stress to calculated contact stress.",
};
const ASSUMED_KEYS = [
  "motorKv", "operatingVoltageV", "faceWidthMm", "materialKey", "assumedMaterialKey", "shiftCycles", "qualityNumber",
  "overloadFactor", "meshEfficiency", "bendingSafetyFactorRequired", "contactSafetyFactorRequired", "reliability",
  "temperatureC", "rimThicknessFactor", "pinionRevolutionsPerShift", "sameMaterialForPair", "materialRatings", "kmBasis",
];
const ASSUMPTION_LABELS = {
  motorKv: "Motor Kv", operatingVoltageV: "Operating voltage", faceWidthMm: "Face width", materialKey: "Gear material",
  assumedMaterialKey: "Temporary analysis material", shiftCycles: "Design shift count", qualityNumber: "Gear quality Qv",
  overloadFactor: "Shock/loading factor Ko", meshEfficiency: "Mesh efficiency", bendingSafetyFactorRequired: "Bending safety target",
  contactSafetyFactorRequired: "Contact safety target", reliability: "Reliability", temperatureC: "Gear temperature",
  rimThicknessFactor: "Rim factor KB", pinionRevolutionsPerShift: "Loaded revolutions per shift",
  sameMaterialForPair: "Same material for both gears", materialRatings: "Material strength ratings", kmBasis: "Gear alignment/Km basis",
};

function Provenance({ basis, confirmed = false }) {
  const label = confirmed ? "Confirmed" : ({ "USER INPUT": "Input", DERIVED: "Derived", ASSUMED: "Assumed", "MANUFACTURER DATA": "Manufacturer" }[basis] || basis);
  const description = confirmed ? "Reviewed by the user; not an independent engineering certification." : ({ "USER INPUT": "Entered design value", DERIVED: "Calculated from other inputs", ASSUMED: "Preliminary assumption; replace with verified data when available", "MANUFACTURER DATA": "Manufacturer specification or selected component data" }[basis]);
  const color = confirmed ? "#83d2a7" : basis === "ASSUMED" ? "#dfb66b" : basis === "DERIVED" ? "#a9b6ce" : basis === "MANUFACTURER DATA" ? "#80d3aa" : "#78c6e8";
  return <span title={description} style={{ color, border: `1px solid ${color}55`, borderRadius: 10, padding: "1px 6px", fontSize: 9, whiteSpace: "nowrap" }}>{label}</span>;
}

function Help({ name }) {
  return <span title={HELP[name]} aria-label={`${name} help`} style={{ display: "inline-grid", placeItems: "center", width: 15, height: 15, border: "1px solid #607486", borderRadius: "50%", color: "#b9c9d4", fontSize: 10, cursor: "help", marginLeft: 4 }}>?</span>;
}

function Field({ id, label, value, onChange, unit, min, max, step = "any", basis = "USER INPUT", confirmed, onConfirm, canConfirm = true, help, error, readOnly = false }) {
  return <label style={{ display: "grid", gap: 5, color: "#c0ccd5", fontSize: 11 }}>
    <span style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span>{label}{help && <Help name={help} />}</span>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        {basis && <Provenance basis={basis} confirmed={confirmed} />}
        {basis === "ASSUMED" && <button type="button" onClick={onConfirm} disabled={!canConfirm || confirmed} style={{ border: 0, background: "transparent", color: confirmed ? "#83d2a7" : "#dfb66b", fontSize: 9, padding: 1, cursor: "pointer" }}>{confirmed ? "Confirmed" : "Confirm"}</button>}
      </span>
    </span>
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input id={id} aria-label={label} type="number" min={min} max={max} step={step} value={value} onChange={onChange} readOnly={readOnly} aria-invalid={Boolean(error)} style={{ ...INPUT_STYLE, borderColor: error ? "#ca695d" : undefined, opacity: readOnly ? .85 : 1 }} />
      {unit && <span style={{ color: "#8294a3", fontSize: 10, whiteSpace: "nowrap" }}>{unit}</span>}
    </span>
    {error && <small style={{ color: "#ff958a", fontSize: 10 }}>{error}</small>}
  </label>;
}

function SelectField({ id, label, value, onChange, options, basis = "USER INPUT", confirmed, onConfirm, canConfirm = true }) {
  return <label style={{ display: "grid", gap: 5, color: "#c0ccd5", fontSize: 11 }}>
    <span style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
      <span>{label}</span><span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        {basis && <Provenance basis={basis} confirmed={confirmed} />}
        {basis === "ASSUMED" && <button type="button" onClick={onConfirm} disabled={!canConfirm || confirmed} style={{ border: 0, background: "transparent", color: confirmed ? "#83d2a7" : "#dfb66b", fontSize: 9, padding: 1, cursor: "pointer" }}>{confirmed ? "Confirmed" : "Confirm"}</button>}
      </span>
    </span>
    <select id={id} aria-label={label} value={value} onChange={onChange} style={INPUT_STYLE}>{options.map((option) => typeof option === "object" ? <option key={option.value} value={option.value}>{option.label}</option> : <option key={option}>{option}</option>)}</select>
  </label>;
}

function SectionTitle({ number, title, note, children }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 13 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><strong style={{ color: "#65bda8", fontSize: 11 }}>{number}</strong><h2 style={{ color: "#e5edf1", fontSize: 15, margin: 0 }}>{title}</h2></div>
    {note && <span style={{ color: "#8496a4", fontSize: 10 }}>{note}</span>}{children}
  </div>;
}

function Metric({ label, value, warning = false, preliminary = false }) {
  return <div style={{ display: "grid", gap: 2 }}><span style={{ color: "#8194a2", fontSize: 10 }}>{label}{preliminary && <span style={{ color: "#c89d54" }}> · prelim.</span>}</span><strong style={{ color: warning ? "#e5b567" : "#dce6eb", fontSize: 11, fontWeight: 600 }}>{value}</strong></div>;
}

function Stepper({ id, label, value, onChange }) {
  const changeBy = (amount) => onChange({ target: { value: String(Math.max(1, Number(value) + amount)) } });
  return <div style={{ display: "grid", gap: 5 }}>
    <label htmlFor={id} style={{ color: "#bac8d1", fontSize: 11 }}>{label}</label>
    <span style={{ display: "grid", gridTemplateColumns: "34px minmax(55px, 90px) 34px auto", gap: 5, alignItems: "center" }}>
      <button type="button" onClick={() => changeBy(-1)} aria-label={`Decrease ${label}`} style={STEP_STYLE}>−</button>
      <input id={id} aria-label={label} type="number" min="12" max="200" step="1" value={value} onChange={onChange} style={{ ...INPUT_STYLE, textAlign: "center" }} />
      <button type="button" onClick={() => changeBy(1)} aria-label={`Increase ${label}`} style={STEP_STYLE}>+</button>
      <span style={{ color: "#8496a4", fontSize: 10 }}>teeth</span>
    </span>
  </div>;
}
const STEP_STYLE = { height: 34, border: "1px solid #375368", borderRadius: 4, background: "#102332", color: "#dbe7ed", fontSize: 18, cursor: "pointer" };

function GearShape({ teeth, outerRadius, rootRadius, centerX, centerY, color }) {
  const points = [];
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const base = tooth * Math.PI * 2 / teeth - Math.PI / 2;
    for (const [fraction, radius] of [[0, rootRadius], [.18, outerRadius], [.52, outerRadius], [.7, rootRadius]]) {
      const angle = base + fraction * Math.PI * 2 / teeth;
      points.push(`${centerX + radius * Math.cos(angle)},${centerY + radius * Math.sin(angle)}`);
    }
  }
  return <polygon points={points.join(" ")} fill={`${color}24`} stroke={color} strokeWidth="1.5" />;
}

function GearVisualization({ result, dimension }) {
  const scale = 166 / Math.max(result.outsideDiameterPinionMm, result.outsideDiameterGearMm);
  const x1 = 120;
  const y = 112;
  const x2 = x1 + result.centerDistanceMm * scale;
  const radius = (diameter) => diameter * scale / 2;
  return <svg viewBox="0 0 540 235" role="img" aria-label={`Scaled side view of ${result.pinionTeeth}-tooth pinion and ${result.gearTeeth}-tooth driven gear`} style={{ width: "100%", display: "block", background: "#071622", border: "1px solid #263e4f", borderRadius: 4 }}>
    <line x1="24" y1={y} x2="516" y2={y} stroke="#263b4a" strokeDasharray="4 5" />
    <GearShape teeth={result.pinionTeeth} outerRadius={radius(result.outsideDiameterPinionMm)} rootRadius={radius(result.rootDiameterPinionMm)} centerX={x1} centerY={y} color="#5dc8b1" />
    <GearShape teeth={result.gearTeeth} outerRadius={radius(result.outsideDiameterGearMm)} rootRadius={radius(result.rootDiameterGearMm)} centerX={x2} centerY={y} color="#e7ad59" />
    <circle cx={x1} cy={y} r={radius(result.pitchDiameterPinionMm)} fill="none" stroke="#5dc8b1" strokeDasharray="5 4" />
    <circle cx={x2} cy={y} r={radius(result.pitchDiameterGearMm)} fill="none" stroke="#e7ad59" strokeDasharray="5 4" />
    <circle cx={x1} cy={y} r="3" fill="#e0e8ed" /><circle cx={x2} cy={y} r="3" fill="#e0e8ed" />
    <line x1={x1} y1="207" x2={x2} y2="207" stroke="#a2b2c1" /><line x1={x1} y1="201" x2={x1} y2="214" stroke="#a2b2c1" /><line x1={x2} y1="201" x2={x2} y2="214" stroke="#a2b2c1" />
    <text x={x1} y="229" fill="#c5d2dc" fontSize="10" textAnchor="middle">Center {dimension(result.centerDistanceMm)}</text>
    <text x={x1} y="20" fill="#5dc8b1" fontSize="10" textAnchor="middle">Driver {result.pinionTeeth}T · OD {dimension(result.outsideDiameterPinionMm)}</text>
    <text x={x2} y="20" fill="#e7ad59" fontSize="10" textAnchor="middle">Driven {result.gearTeeth}T · OD {dimension(result.outsideDiameterGearMm)}</text>
  </svg>;
}

function StatusCard({ title, value, required, status, explanation, preliminary = false, warning = false }) {
  const color = warning ? "#e1b75e" : status === "PASS" ? "#72d6a0" : "#ff8a7a";
  return <article style={{ border: `1px solid ${color}66`, borderTop: `3px solid ${color}`, borderRadius: 5, padding: 12, background: "#081722", minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 5, alignItems: "center" }}><strong style={{ color: "#c8d5dd", fontSize: 10, letterSpacing: ".05em" }}>{title}</strong>{preliminary && <Provenance basis="ASSUMED" />}</div>
    <strong style={{ display: "block", color: "#f0f4f6", fontSize: 18, margin: "8px 0 3px" }}>{value}</strong>
    {required && <div style={{ color: "#99aab6", fontSize: 10 }}>{required}</div>}
    <div style={{ color, fontSize: 10, fontWeight: 750, marginTop: 7 }}>{status}</div>
    <p style={{ color: "#93a4b0", fontSize: 10, lineHeight: 1.45, margin: "5px 0 0" }}>{explanation}</p>
  </article>;
}

function ResultCards({ result, preliminary }) {
  const geometryWarning = !result.geometrySupported;
  const torqueText = result.torquePass ? "Meets the current output torque requirement." : `Output is ${Math.abs(result.torqueMarginNm).toFixed(2)} N·m below the current requirement.`;
  const bendText = result.bendingPass ? "Calculated bending SF meets the selected target." : `Calculated pinion bending safety factor is below ${result.bendingSafetyFactorRequired.toFixed(2)}.`;
  const contactText = result.contactPass ? "Calculated contact SF meets the selected target." : `Calculated contact safety factor is below ${result.contactSafetyFactorRequired.toFixed(2)}.`;
  const geometryText = geometryWarning ? "Below the standard minimum tooth count used by this analysis. Consider a larger pinion or investigate profile modification; none is assumed." : "Meets the standard full-depth tooth-count minimum used by this analysis.";
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 205px), 1fr))", gap: 9 }}>
    <StatusCard title="OUTPUT TORQUE" value={`${result.outputTorqueNm.toFixed(2)} N·m`} required={`Required: ${result.requiredOutputTorqueNm.toFixed(2)} N·m`} status={result.torquePass ? "PASS" : "FAIL"} explanation={torqueText} />
    <StatusCard title="BENDING" value={`SF ${result.bendingSafety.toFixed(2)}`} required={`Required: ${result.bendingSafetyFactorRequired.toFixed(2)}`} status={result.bendingPass ? "PASS" : "FAIL"} explanation={bendText} preliminary={preliminary} />
    <StatusCard title="CONTACT" value={`SF ${result.contactSafety.toFixed(2)}`} required={`Required: ${result.contactSafetyFactorRequired.toFixed(2)}`} status={result.contactPass ? "PASS" : "FAIL"} explanation={contactText} preliminary={preliminary} />
    <StatusCard title="GEOMETRY" value={`${result.pinionTeeth}T pinion`} required={`${result.minimumTeeth}T minimum standard geometry`} status={geometryWarning ? "STANDARD GEOMETRY WARNING" : "SUPPORTED"} explanation={geometryText} warning={geometryWarning} />
  </div>;
}

function QuickCandidates({ inputs, selected, onChoose, dimension }) {
  return <div style={{ marginTop: 18 }}>
    <h3 style={{ color: "#cbd7de", fontSize: 12, margin: "0 0 9px" }}>Quick 5:1 Candidates</h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 145px), 1fr))", gap: 7 }}>
      {PAIRS.map(([pinionTeeth, gearTeeth]) => {
        const result = calculateShifterDesign({ ...inputs, pinionTeeth, gearTeeth }).result;
        const active = pinionTeeth === selected.pinionTeeth && gearTeeth === selected.gearTeeth;
        if (!result) return null;
        return <button type="button" key={pinionTeeth} onClick={() => onChoose(pinionTeeth, gearTeeth)} aria-pressed={active} style={{ textAlign: "left", border: `1px solid ${active ? "#66cbb2" : "#2c4252"}`, borderRadius: 4, padding: 9, background: active ? "#0d2523" : "#091722", color: "#e3ebef", cursor: "pointer" }}>
          <strong style={{ fontSize: 11 }}>{pinionTeeth} / {gearTeeth}</strong><div style={{ color: "#9babb6", fontSize: 9, marginTop: 4 }}>5.00:1</div>
          <div style={{ color: "#9babb6", fontSize: 9 }}>Driven OD: {dimension(result.outsideDiameterGearMm)}</div>
          <div style={{ color: "#9babb6", fontSize: 9 }}>Center: {dimension(result.centerDistanceMm)}</div>
          <div style={{ color: result.geometrySupported ? "#82d4a4" : "#e0b863", fontSize: 9, marginTop: 4 }}>{result.geometrySupported ? "Geometry supported" : "⚠ Geometry warning"}</div>
        </button>;
      })}
    </div>
  </div>;
}

function Comparison({ inputs, selected, onChoose, dimension, preliminary }) {
  return <section style={PANEL_STYLE}>
    <SectionTitle number="5" title="Compare Gear Pairs" note="Select “Use this gear pair” to load a candidate." />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: 8 }}>
      {PAIRS.map(([pinionTeeth, gearTeeth]) => {
        const result = calculateShifterDesign({ ...inputs, pinionTeeth, gearTeeth }).result;
        if (!result) return null;
        const active = pinionTeeth === selected.pinionTeeth && gearTeeth === selected.gearTeeth;
        return <CandidateCard key={pinionTeeth} result={result} selected={active} onChoose={onChoose} dimension={dimension} preliminary={preliminary} />;
      })}
    </div>
  </section>;
}

function CandidateCard({ result, selected, onChoose, dimension, preliminary }) {
  return <article style={{ border: `1px solid ${selected ? "#63cbb1" : "#2a4051"}`, borderRadius: 5, padding: 11, background: selected ? "#0b201f" : "#081723" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><strong style={{ color: "#e1eaf0", fontSize: 12 }}>{result.pinionTeeth}T / {result.gearTeeth}T</strong>{selected && <Provenance basis="DERIVED" />}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, margin: "10px 0", fontSize: 10 }}>
      <Metric label="Driven OD" value={dimension(result.outsideDiameterGearMm)} />
      <Metric label="Center distance" value={dimension(result.centerDistanceMm)} />
      <Metric label="Bending SF" value={result.bendingSafety.toFixed(2)} preliminary={preliminary} />
      <Metric label="Contact SF" value={result.contactSafety.toFixed(2)} preliminary={preliminary} />
      <Metric label="Geometry" value={result.geometrySupported ? "Supported" : "Warning"} warning={!result.geometrySupported} />
      <Metric label="Torque margin" value={`${result.torqueMarginNm.toFixed(2)} N·m`} warning={!result.torquePass} />
      <Metric label="Strength / torque status" value={result.pass ? "PASS" : "FAIL"} warning={!result.pass} />
    </div>
    <details>
      <summary style={{ color: "#91a4b2", fontSize: 10, cursor: "pointer" }}>Details: forces and stress</summary>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, margin: "8px 0", fontSize: 10 }}>
        <Metric label="Tangential force" value={`${result.tangentialForceN.toFixed(1)} N`} />
        <Metric label="Max bending stress" value={`${Math.max(result.bendingPinionMPa, result.bendingGearMPa).toFixed(1)} MPa`} preliminary={preliminary} />
        <Metric label="Contact stress" value={`${result.contactMPa.toFixed(1)} MPa`} preliminary={preliminary} />
        <Metric label="Actual ratio" value={`${result.ratio.toFixed(2)}:1`} />
      </div>
    </details>
    <button type="button" onClick={() => onChoose(result.pinionTeeth, result.gearTeeth)} style={{ width: "100%", marginTop: 9, border: "1px solid #426376", borderRadius: 4, padding: "7px 8px", background: "#102433", color: "#c9d8e1", cursor: "pointer", fontSize: 10 }}>{selected ? "Selected gear pair" : "Use this gear pair"}</button>
  </article>;
}

function OutputRow({ label, value, unit = "", good, bad }) {
  const color = good ? "#72d6a0" : bad ? "#ff8a7a" : "#dce5eb";
  return <tr style={{ borderBottom: "1px solid #203342" }}><td style={{ padding: "6px 4px", color: "#91a2b1", fontSize: 10 }}>{label}</td><td style={{ padding: "6px 4px", color, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 10 }}>{value}{unit && <span style={{ color: "#758899", marginLeft: 4 }}>{unit}</span>}</td></tr>;
}

export default function ShifterWorkflow() {
  const [inputs, setInputs] = useState({ ...SHIFTER_DEFAULTS });
  const [verified, setVerified] = useState(() => Object.fromEntries(ASSUMED_KEYS.map((key) => [key, false])));
  const [dimensionUnit, setDimensionUnit] = useState("mm");
  const assumptionsRef = useRef(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const analysis = calculateShifterDesign(inputs);
  const result = analysis.result;
  const setValue = (key, value) => {
    setInputs((current) => ({ ...current, [key]: value }));
    if (ASSUMED_KEYS.includes(key)) setVerified((current) => ({ ...current, [key]: false }));
    if (key === "materialKey") setVerified((current) => ({ ...current, materialRatings: false }));
  };
  const update = (key) => (event) => setValue(key, event.target.value);
  const confirm = (key) => () => setVerified((current) => ({ ...current, [key]: true }));
  const selectPair = (pinionTeeth, gearTeeth) => setInputs((current) => ({ ...current, pinionTeeth, gearTeeth }));
  const fieldProps = (key) => ({ basis: "ASSUMED", confirmed: verified[key], onConfirm: confirm(key), canConfirm: key !== "assumedMaterialKey" && (key !== "materialKey" || inputs.materialKey !== "Unknown / Not Selected") });
  const dimension = (mm, digits = 1) => dimensionUnit === "in" ? `${(mm / 25.4).toFixed(digits)} in` : `${mm.toFixed(digits)} mm`;
  const formatDimension = (mm, digits = 1) => dimensionUnit === "in" ? (mm / 25.4).toFixed(digits) : mm.toFixed(digits);
  const inputError = (key) => analysis.errors.find((error) => error.includes(key));
  const activeAssumptions = ASSUMED_KEYS.filter((key) => {
    if (inputs.motorSpeedMode === "direct" && ["motorKv", "operatingVoltageV"].includes(key)) return false;
    if (inputs.materialKey !== "Unknown / Not Selected" && key === "assumedMaterialKey") return false;
    return true;
  });
  const pending = activeAssumptions.filter((key) => !verified[key]);
  const importantPending = ["materialKey", "faceWidthMm", "qualityNumber", "overloadFactor", "pinionRevolutionsPerShift"].filter((key) => pending.includes(key)).map((key) => ASSUMPTION_LABELS[key]);
  return <main style={{ maxWidth: 1000, margin: "0 auto", color: "#e2eaf0", textAlign: "left" }}>
    <header style={{ margin: "0 0 13px" }}><div style={{ color: "#65bda8", fontSize: 10, letterSpacing: ".15em" }}>FORMULA SAE · SHIFTER REDUCTION</div><h1 style={{ color: "#f1f5f7", fontSize: 23, margin: "3px 0" }}>Sequential Shifter Gear Design</h1><p style={{ color: "#899aa7", fontSize: 10, margin: 0 }}>ODrive D5065 270 kV · preliminary spur-gear sizing and comparison</p></header>

    <section style={PANEL_STYLE}>
      <SectionTitle number="1" title="Motor & Requirement" note="Set the motor operating point and target output torque." />
      <div style={GRID_STYLE}>
        <Field id="motorTorqueNm" label="Motor torque" value={inputs.motorTorqueNm} onChange={update("motorTorqueNm")} unit="N·m" min="0.01" error={inputError("motorTorqueNm")} />
        <div style={{ display: "grid", gap: 7, color: "#bfccd4", fontSize: 11 }}><strong style={{ fontSize: 11 }}>Motor Speed</strong>
          <label><input type="radio" name="motorSpeedMode" value="estimated" checked={inputs.motorSpeedMode === "estimated"} onChange={update("motorSpeedMode")} /> Calculate from Kv & Voltage</label>
          <label><input type="radio" name="motorSpeedMode" value="direct" checked={inputs.motorSpeedMode === "direct"} onChange={update("motorSpeedMode")} /> Enter RPM manually</label>
          {inputs.motorSpeedMode === "estimated" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            <Field id="motorKv" label="Motor Kv" value={inputs.motorKv} onChange={update("motorKv")} unit="rpm/V" min="1" {...fieldProps("motorKv")} error={inputError("motorKv")} />
            <Field id="operatingVoltageV" label="Operating voltage" value={inputs.operatingVoltageV} onChange={update("operatingVoltageV")} unit="V" min="1" {...fieldProps("operatingVoltageV")} error={inputError("operatingVoltageV")} />
            <strong style={{ gridColumn: "1 / -1", color: "#d7e5e9", fontSize: 11 }}>Estimated no-load speed: {(Number(inputs.motorKv) * Number(inputs.operatingVoltageV)).toLocaleString()} rpm</strong>
          </div> : <Field id="motorSpeedRpm" label="Motor RPM" value={inputs.motorSpeedRpm} onChange={update("motorSpeedRpm")} unit="rpm" min="1" error={inputError("motorSpeedRpm")} />}
        </div>
        <Field id="requiredOutputTorqueNm" label="Required output torque" value={inputs.requiredOutputTorqueNm} onChange={update("requiredOutputTorqueNm")} unit="N·m" min="0.01" error={inputError("requiredOutputTorqueNm")} />
      </div>
      {inputs.motorSpeedMode === "estimated" && <p style={{ color: "#8698a5", fontSize: 9, margin: "8px 0 0" }}>Kv × voltage estimates no-load RPM; loaded speed depends on the motor/controller operating point. Defaults: 270 Kv, 12 V.</p>}
    </section>

    <section style={PANEL_STYLE}>
      <SectionTitle number="2" title="Gear Selection" note="Choose a pair; ratio and package dimensions update immediately.">
        <div role="group" aria-label="Dimension units" style={{ display: "inline-flex", border: "1px solid #344c5e", borderRadius: 4, overflow: "hidden" }}>{["mm", "in"].map((unit) => <button type="button" key={unit} onClick={() => setDimensionUnit(unit)} aria-pressed={dimensionUnit === unit} style={{ border: 0, padding: "5px 10px", background: dimensionUnit === unit ? "#1c3c48" : "#091722", color: "#dce6eb", cursor: "pointer", fontSize: 10 }}>{unit}</button>)}</div>
      </SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 185px), 1fr))", gap: "14px 22px", alignItems: "end" }}>
        <Stepper id="pinionTeeth" label="Driver / Pinion" value={inputs.pinionTeeth} onChange={update("pinionTeeth")} />
        <Stepper id="gearTeeth" label="Driven Gear" value={inputs.gearTeeth} onChange={update("gearTeeth")} />
        {result && <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}><span style={{ color: "#91a3af", fontSize: 10 }}>Reduction</span><strong style={{ color: "#83d5bd", fontSize: 21 }}>{result.ratio.toFixed(2)} : 1</strong><Provenance basis="DERIVED" /></div>}
      </div>
      {result && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", gap: 8, margin: "13px 0" }}><Metric label="Pinion OD" value={dimension(result.outsideDiameterPinionMm)} /><Metric label="Driven OD" value={dimension(result.outsideDiameterGearMm)} /><Metric label="Center distance" value={dimension(result.centerDistanceMm)} /></div>
        <GearVisualization result={result} dimension={dimension} />
        <p style={{ color: "#8596a3", fontSize: 9, margin: "5px 0 0" }}>Dashed circles show pitch diameters. Tooth profile is schematic, not an involute drawing. Driver {result.pinionTeeth}T · driven {result.gearTeeth}T · {result.ratio.toFixed(2)}:1.</p>
      </>}
      <QuickCandidates inputs={inputs} selected={inputs} onChoose={selectPair} dimension={dimension} />
    </section>

    <section style={PANEL_STYLE}>
      <SectionTitle number="3" title="Gear Specification" note="Enter known geometry; confirm physical properties from the selected gear." />
      <div style={GRID_STYLE}>
        <Field id="diametralPitch" label="Diametral pitch" value={inputs.diametralPitch} onChange={update("diametralPitch")} unit="teeth/in" min="4" max="80" help="diametralPitch" error={inputError("diametralPitch")} />
        <Field id="pressureAngleDeg" label="Pressure angle" value={inputs.pressureAngleDeg} onChange={update("pressureAngleDeg")} unit="degrees" min="14.5" max="30" help="pressureAngleDeg" error={inputError("pressureAngleDeg")} />
        <Field id="faceWidthMm" label="Face width" value={dimensionUnit === "in" ? (Number(inputs.faceWidthMm) / 25.4).toFixed(3) : inputs.faceWidthMm} onChange={(event) => setValue("faceWidthMm", String(Number(event.target.value) * (dimensionUnit === "in" ? 25.4 : 1)))} unit={dimensionUnit} min="0.1" help="faceWidthMm" {...fieldProps("faceWidthMm")} error={inputError("faceWidthMm")} />
        <SelectField id="materialKey" label="Actual gear material" value={inputs.materialKey} onChange={update("materialKey")} options={["Unknown / Not Selected", ...Object.keys(MATERIALS)]} {...fieldProps("materialKey")} canConfirm={inputs.materialKey !== "Unknown / Not Selected"} />
      </div>
      <p style={{ color: "#8799a6", fontSize: 9, lineHeight: 1.5, margin: "9px 0 0" }}>Face width and material remain assumed until confirmed from manufacturer specifications. Diametral pitch and pressure angle apply to both gears.</p>
      {analysis.errors.length > 0 && <div role="alert" style={{ marginTop: 10, padding: 9, border: "1px solid #8e4843", borderRadius: 4, background: "#281819", color: "#ffb0a7", fontSize: 10 }}><strong>Correct invalid inputs:</strong>{analysis.errors.map((error) => <div key={error} style={{ marginTop: 3 }}>{error}</div>)}</div>}
    </section>

    {result && <>
      <section style={PANEL_STYLE}>
        <SectionTitle number="4" title="Results" note="Understand each requirement independently." />
        {pending.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 11, marginBottom: 10, background: "#282116", border: "1px solid #765b2e", borderRadius: 4 }}>
          <div><strong style={{ display: "block", color: "#f0c878", fontSize: 11 }}>PRELIMINARY DESIGN</strong><span style={{ color: "#bdad8e", fontSize: 9 }}>{pending.length} assumptions still need confirmation{importantPending.length ? ` · Priority: ${importantPending.join(", ")}` : ""}</span></div>
          <button type="button" onClick={() => { setAssumptionsOpen(true); requestAnimationFrame(() => assumptionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} style={{ border: "1px solid #93733a", borderRadius: 4, background: "#3a2d17", color: "#f2d698", padding: "7px 10px", cursor: "pointer", fontSize: 9 }}>Review assumptions</button>
        </div>}
        <ResultCards result={result} preliminary={pending.length > 0} />
        <p style={{ color: "#8c9da8", fontSize: 9, margin: "9px 0 0" }}>Overall structural result: <strong style={{ color: result.pass ? "#85d5a8" : "#ff9386" }}>{result.pass ? "PASS" : "FAIL"}</strong>{result.pass && !result.geometrySupported ? " · Standard geometry warning remains separate." : ""} Strength values are preliminary while assumptions remain.</p>
      </section>

      <Comparison inputs={inputs} selected={inputs} onChoose={selectPair} dimension={dimension} preliminary={pending.length > 0} />

      <DetailedAnalysis result={result} inputs={inputs} verified={verified} warnings={analysis.warnings} formatDimension={formatDimension} unit={dimensionUnit} ref={assumptionsRef} assumptionsOpen={assumptionsOpen} setAssumptionsOpen={setAssumptionsOpen} importantPending={importantPending} update={update} confirm={confirm} fieldProps={fieldProps} inputError={inputError} />
    </>}
    {!result && analysis.errors.length > 0 && <div role="alert" style={{ ...PANEL_STYLE, borderColor: "#8e4843", color: "#ffb0a7", fontSize: 10 }}>Results paused until invalid inputs are corrected.</div>}
  </main>;
}

function DetailedAnalysis({ result, inputs, verified, warnings, formatDimension, unit, ref: assumptionsRef, assumptionsOpen, setAssumptionsOpen, importantPending, update, confirm, fieldProps, inputError }) {
  const material = MATERIALS[result.effectiveMaterialKey];
  return <section style={PANEL_STYLE} ref={assumptionsRef}>
    <SectionTitle number="6" title="Detailed Shigley Analysis" note="Review input assumptions, stress results, and intermediate factors." />
    <details open={assumptionsOpen} onToggle={(event) => setAssumptionsOpen(event.currentTarget.open)}>
      <summary style={{ color: "#c5d2da", fontSize: 10, cursor: "pointer" }}>Assumptions and specifications</summary>
      <p style={{ color: "#91a2af", fontSize: 9, margin: "8px 0" }}>Confirm actions record review only. They do not independently verify the calculation model or gear rating.</p>
      <div style={GRID_STYLE}>
        <Field id="shiftCycles" label="Design shift count" value={inputs.shiftCycles} onChange={update("shiftCycles")} unit="shifts" min="1" step="1" {...fieldProps("shiftCycles")} error={inputError("shiftCycles")} />
        <Field id="qualityNumber" label="Gear quality Qv" value={inputs.qualityNumber} onChange={update("qualityNumber")} unit="AGMA" min="5" max="12" help="qualityNumber" {...fieldProps("qualityNumber")} error={inputError("qualityNumber")} />
        <SelectField id="assumedMaterialKey" label="Temporary assumed analysis material" value={inputs.assumedMaterialKey} onChange={update("assumedMaterialKey")} options={Object.keys(MATERIALS)} {...fieldProps("assumedMaterialKey")} canConfirm={false} />
        <Field id="pinionRevolutionsPerShift" label="Loaded pinion revolutions / shift" value={inputs.pinionRevolutionsPerShift} onChange={update("pinionRevolutionsPerShift")} unit="rev/shift" min="0.01" {...fieldProps("pinionRevolutionsPerShift")} error={inputError("pinionRevolutionsPerShift")} />
        <Field id="overloadFactor" label="Overload factor Ko" value={inputs.overloadFactor} onChange={update("overloadFactor")} unit="-" min="1" max="5" help="overloadFactor" {...fieldProps("overloadFactor")} error={inputError("overloadFactor")} />
        <Field id="rimThicknessFactor" label="Rim thickness factor KB" value={inputs.rimThicknessFactor} onChange={update("rimThicknessFactor")} unit="-" min="1" help="rimThicknessFactor" {...fieldProps("rimThicknessFactor")} error={inputError("rimThicknessFactor")} />
        <Field id="meshEfficiency" label="Mesh efficiency" value={inputs.meshEfficiency} onChange={update("meshEfficiency")} unit="0–1" min="0.01" max="1" step="0.01" {...fieldProps("meshEfficiency")} error={inputError("meshEfficiency")} />
        <Field id="bendingSafetyFactorRequired" label="Required bending safety factor" value={inputs.bendingSafetyFactorRequired} onChange={update("bendingSafetyFactorRequired")} unit="-" min="0.1" help="bendingSafetyFactorRequired" {...fieldProps("bendingSafetyFactorRequired")} />
        <Field id="contactSafetyFactorRequired" label="Required contact safety factor" value={inputs.contactSafetyFactorRequired} onChange={update("contactSafetyFactorRequired")} unit="-" min="0.1" help="contactSafetyFactorRequired" {...fieldProps("contactSafetyFactorRequired")} />
        <SelectField id="reliability" label="Reliability" value={inputs.reliability} onChange={update("reliability")} options={[0.9, 0.99, 0.999, 0.9999].map((value) => ({ value, label: `${(value * 100).toFixed(value === 0.9999 ? 2 : value === 0.999 ? 1 : 0)}%` }))} {...fieldProps("reliability")} />
        <Field id="temperatureC" label="Gear temperature" value={inputs.temperatureC} onChange={update("temperatureC")} unit="°C" min="0" max="120" {...fieldProps("temperatureC")} />
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: 10, paddingTop: 9, borderTop: "1px solid #243846" }}>
        <Confirmation label="Both gears use the selected material" checked={verified.sameMaterialForPair} onConfirm={confirm("sameMaterialForPair")} disabled={inputs.materialKey === "Unknown / Not Selected"} />
        <Confirmation label="Project-library allowable ratings match gear manufacturer data" checked={verified.materialRatings} onConfirm={confirm("materialRatings")} disabled={inputs.materialKey === "Unknown / Not Selected"} />
        <Confirmation label="Housing/alignment supports the precision-enclosed Km basis" checked={verified.kmBasis} onConfirm={confirm("kmBasis")} />
      </div>
      {importantPending.length > 0 && <p style={{ color: "#e3b964", fontSize: 9 }}>Priority assumptions pending: {importantPending.join(", ")}.</p>}
      <ul style={{ paddingLeft: 16, color: "#9baab4", fontSize: 9, lineHeight: 1.5 }}>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </details>
    <details style={{ marginTop: 10 }}>
      <summary style={{ color: "#c5d2da", fontSize: 10, cursor: "pointer" }}>Detailed Results</summary>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 285px), 1fr))", gap: 12, marginTop: 9 }}>
        <table style={TABLE_STYLE}><tbody>
          <OutputRow label="Pitch diameters (pinion / gear)" value={`${formatDimension(result.pitchDiameterPinionMm)} / ${formatDimension(result.pitchDiameterGearMm)}`} unit={unit} />
          <OutputRow label="Outside diameters (pinion / gear)" value={`${formatDimension(result.outsideDiameterPinionMm)} / ${formatDimension(result.outsideDiameterGearMm)}`} unit={unit} />
          <OutputRow label="Root diameters (pinion / gear)" value={`${formatDimension(result.rootDiameterPinionMm)} / ${formatDimension(result.rootDiameterGearMm)}`} unit={unit} />
          <OutputRow label="Center distance" value={formatDimension(result.centerDistanceMm)} unit={unit} />
          <OutputRow label="Pitch-line velocity" value={result.velocityMs.toFixed(3)} unit="m/s" />
          <OutputRow label="Tangential / radial / normal force" value={`${result.tangentialForceN.toFixed(1)} / ${result.radialForceN.toFixed(1)} / ${result.normalForceN.toFixed(1)}`} unit="N" />
          <OutputRow label="Design tangential load Ko·Kv·Wt" value={result.designLoadN.toFixed(1)} unit="N" />
        </tbody></table>
        <table style={TABLE_STYLE}><tbody>
          <OutputRow label="Bending stress (pinion / gear) · PRELIMINARY" value={`${result.bendingPinionMPa.toFixed(1)} / ${result.bendingGearMPa.toFixed(1)}`} unit="MPa" />
          <OutputRow label="Contact stress · PRELIMINARY" value={result.contactMPa.toFixed(1)} unit="MPa" />
          <OutputRow label="Allowable bending / contact" value={`${result.bendingAllowableMPa.toFixed(1)} / ${result.contactAllowableMPa.toFixed(1)}`} unit="MPa" />
          <OutputRow label="Bending SF (pinion / gear)" value={`${result.bendingSafetyPinion.toFixed(2)} / ${result.bendingSafetyGear.toFixed(2)}`} good={result.bendingPass} bad={!result.bendingPass} />
          <OutputRow label="Contact safety factor" value={result.contactSafety.toFixed(2)} good={result.contactPass} bad={!result.contactPass} />
          <OutputRow label="Life cycles" value={`${result.shiftCycles} × ${result.pinionRevolutionsPerShift} = ${result.lifeCycles}`} unit="pinion rev" />
          <OutputRow label="Material strength numbers σb / σc" value={`${material.sigma_b} / ${material.sigma_c}`} unit="MPa" />
        </tbody></table>
      </div>
    </details>
    <details style={{ marginTop: 10 }}>
      <summary style={{ color: "#c5d2da", fontSize: 10, cursor: "pointer" }}>Shigley Calculation Details</summary>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: 12, marginTop: 9 }}>
        <table style={TABLE_STYLE}><tbody>
          <OutputRow label="Ko overload · ASSUMED" value={result.factors.Ko.toFixed(3)} /><OutputRow label="Kv dynamic · DERIVED" value={result.factors.Kv.toFixed(4)} />
          <OutputRow label="Ks size · DERIVED" value={result.factors.Ks.toFixed(4)} /><OutputRow label="Km load distribution · DERIVED" value={result.factors.Km.toFixed(4)} />
          <OutputRow label="KB rim thickness · ASSUMED" value={result.factors.KB.toFixed(3)} /><OutputRow label="J pinion / gear · DERIVED" value={`${result.factors.JPinion.toFixed(4)} / ${result.factors.JGear.toFixed(4)}`} />
          <OutputRow label="I contact geometry · DERIVED" value={result.factors.I.toFixed(5)} />
        </tbody></table>
        <table style={TABLE_STYLE}><tbody>
          <OutputRow label="KL bending life · DERIVED" value={result.factors.KL.toFixed(4)} /><OutputRow label="KR reliability · DERIVED" value={result.factors.KR.toFixed(3)} />
          <OutputRow label="KT temperature · DERIVED" value={result.factors.KT.toFixed(3)} /><OutputRow label="Minimum standard pinion teeth" value={result.minimumTeeth} />
          <OutputRow label="Analysis material · ASSUMED" value={result.effectiveMaterialKey} /><OutputRow label="Material hardness · library" value={material.HB} unit="HB" />
          <OutputRow label="Geometry status" value={result.geometrySupported ? "Supported" : "Standard geometry warning"} bad={!result.geometrySupported} />
        </tbody></table>
      </div>
      <p style={{ color: "#9baab4", fontSize: 9, lineHeight: 1.5, marginTop: 9 }}>Project calculation forms: Wt = 2T/d; σb = WtKoKvKsKmKB/(mFJ); σc = Cp√[WtKoKvKsKm/(FdI)]. Allowables: σb,allow = σb,numberKL/(KTKR); σc,allow = σc,number√KL/(KT√KR). Output torque is compared directly with its requirement; no strength safety factor is applied to it. Existing factor fits, material library, and precision-enclosed Km assumption remain screening limitations; profile shift is not modeled.</p>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}><Provenance basis="USER INPUT" /><Provenance basis="DERIVED" /><Provenance basis="ASSUMED" /><Provenance basis="MANUFACTURER DATA" /><Provenance basis="ASSUMED" confirmed /></div>
    </details>
  </section>;
}

function Confirmation({ label, checked, onConfirm, disabled = false }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#aebdc7", fontSize: 10 }}><span>{label}</span><Provenance basis="ASSUMED" confirmed={checked} /><button type="button" disabled={disabled || checked} onClick={onConfirm} style={{ border: 0, background: "transparent", color: checked ? "#83d2a7" : "#dfb66b", cursor: "pointer", fontSize: 9 }}>{checked ? "Confirmed" : "Confirm"}</button></div>;
}
