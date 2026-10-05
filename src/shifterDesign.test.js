import test from "node:test";
import assert from "node:assert/strict";
import { calculateShifterDesign, SHIFTER_DEFAULTS } from "./shifterDesign.js";

test("candidate geometry reports the 5:1 ratio and 20 DP dimensions", () => {
  const { result, errors } = calculateShifterDesign();
  assert.deepEqual(errors, []);
  assert.equal(result.ratio, 5);
  assert.equal(result.pitchDiameterPinionMm, 15.24);
  assert.equal(result.pitchDiameterGearMm, 76.2);
  assert.equal(result.centerDistanceMm, 45.72);
  assert.ok(Math.abs(result.outsideDiameterPinionMm - 17.78) < 1e-10);
  assert.ok(Math.abs(result.outsideDiameterGearMm - 78.74) < 1e-10);
});

test("output torque includes reduction and mesh efficiency", () => {
  const { result } = calculateShifterDesign();
  assert.ok(Math.abs(result.outputTorqueNm - 9.6515) < 1e-10);
  assert.ok(Math.abs(result.torqueMarginNm - (9.6515 - 9.8)) < 1e-10);
  assert.equal(result.torquePass, false);
});

test("12-tooth pinion remains calculable but cannot receive geometry PASS", () => {
  const { result, warnings } = calculateShifterDesign();
  assert.equal(result.geometrySupported, false);
  assert.equal(result.minimumTeeth, 18);
  assert.equal(result.pass, false);
  assert.ok(warnings.some((warning) => warning.includes("undercut limit")));
});

test("cycle life uses shifts times loaded pinion revolutions per shift", () => {
  const { result } = calculateShifterDesign({ shiftCycles: 2500, pinionRevolutionsPerShift: 0.5 });
  assert.equal(result.lifeCycles, 1250);
});

test("requested 5:1 comparison pairs preserve ratio and trade size for lower tooth load", () => {
  const small = calculateShifterDesign({ pinionTeeth: 12, gearTeeth: 60 }).result;
  const medium = calculateShifterDesign({ pinionTeeth: 14, gearTeeth: 70 }).result;
  const large = calculateShifterDesign({ pinionTeeth: 16, gearTeeth: 80 }).result;
  assert.equal(small.ratio, 5);
  assert.equal(medium.ratio, 5);
  assert.equal(large.ratio, 5);
  assert.ok(small.centerDistanceMm < medium.centerDistanceMm);
  assert.ok(medium.centerDistanceMm < large.centerDistanceMm);
  assert.ok(small.tangentialForceN > medium.tangentialForceN);
  assert.ok(medium.tangentialForceN > large.tangentialForceN);
});

test("unsupported pressure angle and invalid physical inputs are rejected", () => {
  const { result, errors } = calculateShifterDesign({ pressureAngleDeg: 25, faceWidthMm: 0 });
  assert.equal(result, null);
  assert.ok(errors.some((error) => error.includes("20° full-depth")));
  assert.ok(errors.some((error) => error.includes("faceWidthMm")));
});

test("fractional gear quality grade is rejected", () => {
  const { result, errors } = calculateShifterDesign({ qualityNumber: 6.5 });
  assert.equal(result, null);
  assert.ok(errors.some((error) => error.includes("integer from 5 to 12")));
});

test("defaults retain the requested candidate values", () => {
  assert.equal(SHIFTER_DEFAULTS.motorTorqueNm, 1.99);
  assert.equal(SHIFTER_DEFAULTS.pinionTeeth, 12);
  assert.equal(SHIFTER_DEFAULTS.gearTeeth, 60);
  assert.equal(SHIFTER_DEFAULTS.diametralPitch, 20);
});
