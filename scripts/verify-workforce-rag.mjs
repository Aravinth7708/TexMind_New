import {
  STAGES,
  STAGE_WORKFORCE_CONFIGS,
  initialEmployees,
  FACTORY_COMMUNITY_PROFILE,
} from "../src/lib/data.ts";

import {
  evaluateStageStaffing,
  dispatchWhatsAppCommunity,
  formatWhatsAppSosMessage,
  calculateEmployeeWageSlip,
  calculateStageShiftPayroll,
  calculateFactoryWidePayroll,
  getCachedPrediction,
  getStoredDispatchLogs,
} from "../src/lib/workforce-prediction.ts";

import { generateClientRAGResponse } from "../src/lib/ai-client.ts";

console.log("\n🧪 STARTING COMPREHENSIVE WORKFORCE & RAG VERIFICATION SUITE\n" + "=".repeat(65));

let passCount = 0;
let failCount = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${detail ? `(${detail})` : ""}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failCount++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STAGE CONFIGURATION & 50-CAPACITY CEILINGS
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📋 [Test Group 1] 9-Stage Configurations & Maximum Capacities");
assert(STAGES.length === 9, "9 Stages Configured", `Found ${STAGES.length} stages`);
assert(STAGE_WORKFORCE_CONFIGS.yarn.maxCapacity === 50, "Yarn Maximum Capacity", `maxCapacity = ${STAGE_WORKFORCE_CONFIGS.yarn.maxCapacity}`);
assert(STAGE_WORKFORCE_CONFIGS.sewing.maxCapacity === 120, "Sewing Maximum Capacity", `maxCapacity = ${STAGE_WORKFORCE_CONFIGS.sewing.maxCapacity}`);
assert(STAGE_WORKFORCE_CONFIGS.dyeing.maxCapacity === 40, "Dyeing Maximum Capacity", `maxCapacity = ${STAGE_WORKFORCE_CONFIGS.dyeing.maxCapacity}`);
assert(STAGE_WORKFORCE_CONFIGS.knitting.maxCapacity === 32, "Knitting Maximum Capacity", `maxCapacity = ${STAGE_WORKFORCE_CONFIGS.knitting.maxCapacity}`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. WORKFORCE EVALUATION & DEFICIT CALCULATION
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🧠 [Test Group 2] AI / ML Staffing Assessment & Deficit Detection");
const yarnAssessment = evaluateStageStaffing("yarn", initialEmployees);
assert(yarnAssessment.stage === "yarn", "Stage Key", yarnAssessment.stage);
assert(yarnAssessment.maxCapacity === 50, "Engineered Capacity Ceiling", `${yarnAssessment.maxCapacity} ops`);
assert(yarnAssessment.presentCount >= 6, "Present Operators in Yarn", `${yarnAssessment.presentCount} present`);
assert(yarnAssessment.deficit > 0, "Deficit Calculation", `Deficit = ${yarnAssessment.deficit} operators needed`);
assert(yarnAssessment.criticality === "CRITICAL", "Criticality Detection", `Status = ${yarnAssessment.criticality}`);
assert(yarnAssessment.actionRequired === "WHATSAPP_BROADCAST_NOW", "Action Required", yarnAssessment.actionRequired);
assert(yarnAssessment.aiConfidence > 85, "AI Confidence Score", `${yarnAssessment.aiConfidence}%`);

// Verify Caching
console.log("\n⚡ [Test Group 3] Prediction Cache / Memoization");
const cachedAssessment = evaluateStageStaffing("yarn", initialEmployees);
assert(cachedAssessment.evaluatedAt === yarnAssessment.evaluatedAt, "Cache Hit / Memoized Return", "Returned identical memoized instance");

// ─────────────────────────────────────────────────────────────────────────────
// 4. WHATSAPP COMMUNITY DISPATCH & CONSOLE STATEMENT
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📢 [Test Group 4] WhatsApp Community Message Formatting & Console Dispatch");
const formattedMessage = formatWhatsAppSosMessage({
  stage: "yarn",
  workersNeeded: 10,
  reason: "Critical backlog clearance",
});

assert(formattedMessage.includes("TEXMIND KNITS"), "Message Header", "Contains factory branding");
assert(formattedMessage.includes("SF No. 342/1, Angeripalayam Main Road"), "Tiruppur Address Included", FACTORY_COMMUNITY_PROFILE.address);
assert(formattedMessage.includes("+91 98421 77201"), "Contact Phone Included", FACTORY_COMMUNITY_PROFILE.contactPhone);
assert(formattedMessage.includes("https://maps.google.com/?q=11.1085,77.3411"), "Google Maps Link Included", FACTORY_COMMUNITY_PROFILE.googleMapsUrl);
assert(formattedMessage.includes("10 Workers"), "Worker Count in Message", "10 Workers");

console.log("\nExecuting live dispatchWhatsAppCommunity to verify console statement:");
const dispatchLog = dispatchWhatsAppCommunity({
  stage: "yarn",
  workersNeeded: 10,
  reason: "10 Ring Frame Operators Needed for Day Shift",
  triggerType: "MANUAL",
  actorName: "Operations Lead",
});

assert(dispatchLog.workersRequested === 10, "Dispatch Log Workers Count", `${dispatchLog.workersRequested} workers`);
assert(dispatchLog.status === "SENT_TO_COMMUNITY", "Dispatch Status", dispatchLog.status);
assert(dispatchLog.destinationCommunity === FACTORY_COMMUNITY_PROFILE.whatsappCommunityName, "Target Community", dispatchLog.destinationCommunity);

// ─────────────────────────────────────────────────────────────────────────────
// 5. PIECE-RATE WAGE & SHIFT PAYROLL CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n💰 [Test Group 5] Piece-Rate Wage & Shift Payroll Engine");
const yarnEmp = initialEmployees.find((e) => e.stage === "yarn" && e.attendance === "Present");
if (yarnEmp) {
  const wageSlip = calculateEmployeeWageSlip(yarnEmp, STAGE_WORKFORCE_CONFIGS.yarn);
  assert(wageSlip.grossDailyPay > 0, "Gross Pay Calculation", `₹${wageSlip.grossDailyPay} for ${yarnEmp.name}`);
  assert(wageSlip.pieceRateEarnings === Math.round(yarnEmp.todayOutput * STAGE_WORKFORCE_CONFIGS.yarn.pieceRate), "Piece Earnings Calculated", `Output: ${yarnEmp.todayOutput} kg @ ₹${STAGE_WORKFORCE_CONFIGS.yarn.pieceRate}/kg = ₹${wageSlip.pieceRateEarnings}`);
}

const factoryPayroll = calculateFactoryWidePayroll(initialEmployees);
assert(factoryPayroll.length === 9, "9 Stages in Factory Payroll", `Computed for ${factoryPayroll.length} stages`);
const totalDailyPayroll = factoryPayroll.reduce((acc, p) => acc + p.totalPayrollPayable, 0);
assert(totalDailyPayroll > 0, "Total Factory Shift Payroll", `₹${totalDailyPayroll.toLocaleString("en-IN")}`);

// ─────────────────────────────────────────────────────────────────────────────
// 6. AUTONOMOUS CLIENT-SIDE RAG COPILOT
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🤖 [Test Group 6] Autonomous Client-Side RAG Copilot");
const ragResponse = generateClientRAGResponse("What is the employee count and deficit in Yarn stage?", null);
assert(ragResponse.text.includes("Yarn & Raw Material"), "RAG Cites Yarn Stage", "Contains Yarn breakdown");
assert(ragResponse.text.includes("50 Operators"), "RAG Cites 50 Capacity", "Mentions 50 operator capacity");
assert(ragResponse.text.includes("WhatsApp Community"), "RAG Cites WhatsApp Community", "Mentions Tiruppur community hub");
assert(ragResponse.sources.length >= 2, "RAG Knowledge Sources Grounding", `Cites ${ragResponse.sources.join(", ")}`);

console.log("\n" + "=".repeat(65));
console.log(`📊 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
if (failCount === 0) {
  console.log("🎉 ALL TESTS PASSED PERFECTLY!\n");
} else {
  console.error("⚠️ SOME TESTS FAILED.\n");
  process.exit(1);
}
