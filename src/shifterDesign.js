import {
  Cp, getI, getJ, getKL, getKm, getKR, getKs, getKv, KT, MATERIALS,
} from "./gearCalculations.js";

export const SHIFTER_DEFAULTS = {
  motorTorqueNm: 1.99,
  motorSpeedRpm: 6480,
  pinionTeeth: 12,
  gearTeeth: 60,
  diametralPitch: 20,
  pressureAngleDeg: 20,
  faceWidthMm: 12.7,
  materialKey: "Carburized & Hardened (Grade 2)",
  qualityNumber: 6,
  overloadFactor: 1.5,
  requiredOutputTorqueNm: 9.8,
  bendingSafetyFactorRequired: 1.5,
  contactSafetyFactorRequired: 1.5,
  meshEfficiency: 0.97,
  shiftCycles: 10000,
  pinionRevolutionsPerShift: 1,
  reliability: 0.99,
  temperatureC: 80,
  rimThicknessFactor: 1,
};

const numericInputs = [
  "motorTorqueNm", "motorSpeedRpm", "pinionTeeth", "gearTeeth", "diametralPitch",
  "pressureAngleDeg", "faceWidthMm", "qualityNumber", "overloadFactor",
  "requiredOutputTorqueNm", "bendingSafetyFactorRequired", "contactSafetyFactorRequired",
  "meshEfficiency", "shiftCycles", "pinionRevolutionsPerShift", "reliability",
  "temperatureC", "rimThicknessFactor",
];

export function calculateShifterDesign(inputs) {
  const values = { ...SHIFTER_DEFAULTS, ...inputs };
  const errors = [];

  for (const key of numericInputs) {
    values[key] = Number(values[key]);
    if (!Number.isFinite(values[key])) errors.push(`${key} must be a finite number.`);
  }
  if (errors.length) return { errors, warnings: [], result: null };

  const positiveInputs = [
    "motorTorqueNm", "motorSpeedRpm", "diametralPitch", "faceWidthMm", "overloadFactor",
    "requiredOutputTorqueNm", "bendingSafetyFactorRequired", "contactSafetyFactorRequired",
    "shiftCycles", "pinionRevolutionsPerShift", "rimThicknessFactor",
  ];
  for (const key of positiveInputs) {
    if (values[key] <= 0) errors.push(`${key} must be greater than zero.`);
  }
  for (const key of ["pinionTeeth", "gearTeeth"]) {
    if (!Number.isInteger(values[key]) || values[key] < 12 || values[key] > 200) {
      errors.push(`${key} must be an integer from 12 to 200.`);
    }
  }
  if (values.diametralPitch < 4 || values.diametralPitch > 80) errors.push("Diametral pitch must be from 4 to 80 teeth/in.");
  if (values.pressureAngleDeg !== 20) errors.push("The shared project bending geometry factor is supported only for 20° full-depth spur gears.");
  if (!Number.isInteger(values.qualityNumber) || values.qualityNumber < 5 || values.qualityNumber > 12) errors.push("Gear quality Qv must be an integer from 5 to 12.");
  if (values.overloadFactor < 1 || values.overloadFactor > 5) errors.push("Overload factor Ko must be from 1 to 5.");
  if (values.meshEfficiency > 1) errors.push("Mesh efficiency must not exceed 1.");
  if (![0.9, 0.99, 0.999, 0.9999].includes(values.reliability)) errors.push("Choose a reliability supported by the project material data.");
  if (values.temperatureC < 0 || values.temperatureC > 120) errors.push("The project temperature factor is only defined as KT = 1 from 0 to 120 °C.");
  if (!MATERIALS[values.materialKey]) errors.push("Select a material from the project material library.");
  if (errors.length) return { errors, warnings: [], result: null };

  const warnings = [
    "J is the existing project's curve-fit to the AGMA/Shigley 20° full-depth geometry chart, not a tooth-specific chart lookup.",
    "Km uses the existing project's precision-enclosed, uncrowned-gear assumption; confirm this matches the shifter housing and alignment.",
    "Material allowable stress values and life/reliability factors are inherited from the existing project library and method; verify the selected gear heat treatment and load-cycle interpretation before release.",
    "Motor speed defaults to 6480 rpm (270 kV × 24 V no-load); replace it with measured or specified loaded speed.",
  ];
  const minimumTeeth = Math.ceil(2 / Math.sin(values.pressureAngleDeg * Math.PI / 180) ** 2);
  const geometrySupported = values.pinionTeeth >= minimumTeeth && values.gearTeeth >= minimumTeeth;
  if (!geometrySupported) {
    warnings.push(`Standard unshifted 20° full-depth teeth need at least ${minimumTeeth} teeth to avoid the basic undercut limit. Profile shift is not modeled; geometry cannot receive PASS.`);
  }

  const ratio = values.gearTeeth / values.pinionTeeth;
  const moduleMm = 25.4 / values.diametralPitch;
  const pitchDiameterPinionMm = moduleMm * values.pinionTeeth;
  const pitchDiameterGearMm = moduleMm * values.gearTeeth;
  const centerDistanceMm = (pitchDiameterPinionMm + pitchDiameterGearMm) / 2;
  const outsideDiameterPinionMm = ((values.pinionTeeth + 2) / values.diametralPitch) * 25.4;
  const outsideDiameterGearMm = ((values.gearTeeth + 2) / values.diametralPitch) * 25.4;
  const rootDiameterPinionMm = ((values.pinionTeeth - 2.5) / values.diametralPitch) * 25.4;
  const rootDiameterGearMm = ((values.gearTeeth - 2.5) / values.diametralPitch) * 25.4;
  const lifeCycles = values.shiftCycles * values.pinionRevolutionsPerShift;
  const KL = getKL(lifeCycles);
  const KR = getKR(values.reliability);
  const material = MATERIALS[values.materialKey];
  const bendingAllowableMPa = (material.sigma_b * KL) / (KT * KR);
  const contactAllowableMPa = (material.sigma_c * Math.sqrt(KL)) / (KT * Math.sqrt(KR));
  const velocityMs = Math.PI * (pitchDiameterPinionMm / 1000) * values.motorSpeedRpm / 60;
  const JPinion = getJ(values.pinionTeeth);
  const JGear = getJ(values.gearTeeth);
  const contactGeometryFactor = getI(values.pressureAngleDeg, ratio);
  const dynamicFactor = getKv(velocityMs, values.qualityNumber);
  const sizeFactor = getKs(values.faceWidthMm, moduleMm, JPinion);
  const loadDistributionFactor = getKm(values.faceWidthMm, pitchDiameterPinionMm);
  const inputTorqueNm = values.motorTorqueNm;
  const tangentialForceN = 2 * inputTorqueNm / (pitchDiameterPinionMm / 1000);
  const radialForceN = tangentialForceN * Math.tan(values.pressureAngleDeg * Math.PI / 180);
  const normalForceN = tangentialForceN / Math.cos(values.pressureAngleDeg * Math.PI / 180);
  const designLoadN = tangentialForceN * values.overloadFactor * dynamicFactor;
  const bendingPinionMPa = (tangentialForceN * values.overloadFactor * dynamicFactor * sizeFactor * (1 / moduleMm) * loadDistributionFactor * values.rimThicknessFactor) / (values.faceWidthMm * JPinion);
  const bendingGearMPa = (tangentialForceN * values.overloadFactor * dynamicFactor * sizeFactor * (1 / moduleMm) * loadDistributionFactor * values.rimThicknessFactor) / (values.faceWidthMm * JGear);
  const contactMPa = Cp * Math.sqrt((tangentialForceN * values.overloadFactor * dynamicFactor * sizeFactor * loadDistributionFactor) / (values.faceWidthMm * pitchDiameterPinionMm * contactGeometryFactor));
  const bendingSafetyPinion = bendingAllowableMPa / bendingPinionMPa;
  const bendingSafetyGear = bendingAllowableMPa / bendingGearMPa;
  const bendingSafety = Math.min(bendingSafetyPinion, bendingSafetyGear);
  const contactSafety = contactAllowableMPa / contactMPa;
  const outputTorqueNm = inputTorqueNm * ratio * values.meshEfficiency;
  const torqueMarginNm = outputTorqueNm - values.requiredOutputTorqueNm;
  const torquePass = torqueMarginNm >= 0;
  const bendingPass = bendingSafety >= values.bendingSafetyFactorRequired;
  const contactPass = contactSafety >= values.contactSafetyFactorRequired;
  const stressPass = bendingPass && contactPass;
  const pass = geometrySupported && torquePass && bendingPass && contactPass;

  return {
    errors,
    warnings,
    result: {
      ...values,
      ratio,
      moduleMm,
      pitchDiameterPinionMm,
      pitchDiameterGearMm,
      outsideDiameterPinionMm,
      outsideDiameterGearMm,
      rootDiameterPinionMm,
      rootDiameterGearMm,
      centerDistanceMm,
      outputTorqueNm,
      torqueMarginNm,
      torquePass,
      bendingPass,
      contactPass,
      outputSpeedRpm: values.motorSpeedRpm / ratio,
      velocityMs,
      tangentialForceN,
      radialForceN,
      normalForceN,
      designLoadN,
      lifeCycles,
      minimumTeeth,
      geometrySupported,
      factors: { Ko: values.overloadFactor, Kv: dynamicFactor, Ks: sizeFactor, Km: loadDistributionFactor, KB: values.rimThicknessFactor, JPinion, JGear, I: contactGeometryFactor, KL, KR, KT },
      bendingPinionMPa,
      bendingGearMPa,
      contactMPa,
      bendingAllowableMPa,
      contactAllowableMPa,
      bendingSafetyPinion,
      bendingSafetyGear,
      bendingSafety,
      contactSafety,
      stressPass,
      pass,
    },
  };
}
