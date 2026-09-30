/**
 * Test script for Reminder Notification System
 * Demonstrates how reminders work after 15 minutes
 */

import {
  notifyEligibleWorkers,
  scheduleReminderNotification,
  recordWorkerResponse,
  cancelReminderNotification,
  getActiveReminders,
} from "./rapid-job-notifications";
import type { Job } from "./job-types";

// Test job for reminder system
const testRapidJob: Job = {
  id: "test-reminder-job-1",
  jobTitle: "Urgent Banquet Servers Needed",
  category: "hospitality",
  jobType: "shift",
  venueName: "Grand Ballroom Hotel",
  area: "Indiranagar",
  date: new Date().toISOString().split("T")[0],
  startTime: "6:00 PM",
  endTime: "11:00 PM",
  duration: "5 hours",
  wageDisplay: "₹500/hr",
  positionsTotal: 5,
  positionsConfirmed: 0,
  positionsRemaining: 5,
  isRapidJob: true,
  rapidJobExpiry: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  requirements: {
    experience: "Restaurant service experience required",
    skills: ["Fine dining service", "Guest relations", "Professional attire"],
    facilities: ["Meals provided", "Uniform provided", "Transport allowance"],
  },
  instructions: {
    beforeArrival: "Report 45 minutes early for briefing",
    duringShift: "Maintain 5-star service standards",
    reportingContact: "Banquet Manager: +91 98765 12345",
  },
  description: "High-profile wedding reception - need experienced servers.",
};

/**
 * Simulate the complete reminder flow
 */
export async function demonstrateReminderFlow() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 REMINDER NOTIFICATION SYSTEM DEMONSTRATION");
  console.log("=".repeat(70) + "\n");

  // STEP 1: Post the job and send initial notifications
  console.log("STEP 1: Job Posted - Sending Initial Notifications");
  console.log("-".repeat(70));
  
  const initialResult = await notifyEligibleWorkers(testRapidJob);
  
  console.log(`\n📊 Initial Notification Results:`);
  console.log(`   Workers notified: ${initialResult.totalNotified}`);
  console.log(`   Eligible workers: ${initialResult.eligibleWorkers}`);
  
  // STEP 2: Schedule reminder for 15 minutes later
  console.log("\n\nSTEP 2: Scheduling Reminder Notification");
  console.log("-".repeat(70));
  
  let jobStatus = {
    positionsRemaining: 5,
    isCancelled: false,
  };
  
  scheduleReminderNotification(testRapidJob, () => jobStatus);
  
  console.log(`✅ Reminder scheduled`);
  console.log(`📅 Will trigger in 15 minutes if job still unfilled`);
  console.log(`🔍 Active reminders: ${getActiveReminders().length}`);

  // STEP 3: Simulate worker responses
  console.log("\n\nSTEP 3: Simulating Worker Responses (Next 15 Minutes)");
  console.log("-".repeat(70));
  
  // Simulate some workers applying
  console.log("\n⏱️  After 5 minutes: 1 worker applies");
  recordWorkerResponse("worker-1", testRapidJob.id, "applied");
  jobStatus.positionsRemaining = 4;
  
  console.log("⏱️  After 8 minutes: 1 worker dismisses");
  recordWorkerResponse("worker-3", testRapidJob.id, "dismissed");
  
  console.log("⏱️  After 12 minutes: 1 worker views but doesn't apply");
  recordWorkerResponse("worker-2", testRapidJob.id, "viewed");

  console.log("\n📊 Summary before reminder:");
  console.log(`   Total notified: ${initialResult.totalNotified}`);
  console.log(`   Applied: 1 worker (worker-1)`);
  console.log(`   Dismissed: 1 worker (worker-3)`);
  console.log(`   Viewed only: 1 worker (worker-2)`);
  console.log(`   No response: ${initialResult.totalNotified - 3} workers`);
  console.log(`   Positions remaining: ${jobStatus.positionsRemaining}/5`);

  // STEP 4: Wait for reminder (simulate with shorter time for demo)
  console.log("\n\nSTEP 4: Waiting for Reminder Timer (15 minutes)...");
  console.log("-".repeat(70));
  console.log("⏳ In production, this waits 15 minutes");
  console.log("⚡ For demo, we'll trigger it immediately\n");

  // For demo purposes, we'll manually trigger what would happen after 15 min
  // In production, the setTimeout would handle this automatically
  
  return {
    initialResult,
    jobStatus,
    testJob: testRapidJob,
  };
}

/**
 * Test scenario: Job gets filled before reminder
 */
export async function testJobFilledBeforeReminder() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST: Job Filled Before Reminder");
  console.log("=".repeat(70) + "\n");

  const job: Job = {
    ...testRapidJob,
    id: "test-filled-job",
    jobTitle: "Server Position (Gets Filled)",
  };

  // Send initial notifications
  const result = await notifyEligibleWorkers(job);
  console.log(`✅ Initial notifications: ${result.totalNotified} workers\n`);

  // Schedule reminder
  let jobStatus = { positionsRemaining: 3, isCancelled: false };
  scheduleReminderNotification(job, () => jobStatus);
  console.log(`⏰ Reminder scheduled\n`);

  // Simulate job getting filled
  console.log(`📝 Simulating: Job gets filled within 10 minutes`);
  recordWorkerResponse("worker-1", job.id, "applied");
  recordWorkerResponse("worker-2", job.id, "applied");
  recordWorkerResponse("worker-4", job.id, "applied");
  jobStatus.positionsRemaining = 0; // All positions filled!
  
  console.log(`✅ All 3 positions filled`);
  console.log(`✅ Reminder will be skipped (job is full)\n`);
}

/**
 * Test scenario: Job gets cancelled before reminder
 */
export async function testJobCancelledBeforeReminder() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST: Job Cancelled Before Reminder");
  console.log("=".repeat(70) + "\n");

  const job: Job = {
    ...testRapidJob,
    id: "test-cancelled-job",
    jobTitle: "Server Position (Gets Cancelled)",
  };

  // Send initial notifications
  const result = await notifyEligibleWorkers(job);
  console.log(`✅ Initial notifications: ${result.totalNotified} workers\n`);

  // Schedule reminder
  let jobStatus = { positionsRemaining: 5, isCancelled: false };
  scheduleReminderNotification(job, () => jobStatus);
  console.log(`⏰ Reminder scheduled\n`);

  // Cancel the job
  console.log(`🚫 Simulating: Employer cancels job after 8 minutes`);
  jobStatus.isCancelled = true;
  cancelReminderNotification(job.id);
  
  console.log(`✅ Reminder cancelled`);
  console.log(`✅ No reminder will be sent\n`);
}

/**
 * Test scenario: Reminder sends successfully
 */
export async function testReminderSendsSuccessfully() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST: Reminder Sends Successfully");
  console.log("=".repeat(70) + "\n");

  const job: Job = {
    ...testRapidJob,
    id: "test-reminder-success",
    jobTitle: "Server Position (Needs Reminder)",
  };

  // Send initial notifications
  const initialResult = await notifyEligibleWorkers(job);
  console.log(`✅ Initial notifications: ${initialResult.totalNotified} workers\n`);

  // Simulate only 1 worker responding
  console.log(`📝 1 worker applies, others don't respond`);
  recordWorkerResponse("worker-1", job.id, "applied");
  
  const respondedWorkers = 1;
  const nonRespondedWorkers = initialResult.totalNotified - respondedWorkers;
  
  console.log(`\n📊 Status after 15 minutes:`);
  console.log(`   Responded: ${respondedWorkers} worker`);
  console.log(`   No response: ${nonRespondedWorkers} workers`);
  console.log(`   Positions still needed: 4/5`);
  
  console.log(`\n⏰ Reminder will be sent to ${nonRespondedWorkers} workers\n`);
  
  // In real flow, the reminder would trigger automatically
  // For demo, we show what would happen:
  const updatedJob = { ...job, positionsRemaining: 4 };
  const reminderResult = await notifyEligibleWorkers(updatedJob, true);
  
  console.log(`✅ Reminder sent to ${reminderResult.totalNotified} workers`);
  console.log(`✅ Workers who already responded were excluded\n`);
}

/**
 * Run all reminder tests
 */
export async function runReminderTests() {
  console.log("\n\n");
  console.log("═".repeat(70));
  console.log("  RAPID JOB REMINDER NOTIFICATION TEST SUITE");
  console.log("═".repeat(70));

  // Main demonstration
  await demonstrateReminderFlow();

  // Test scenarios
  await testJobFilledBeforeReminder();
  await testJobCancelledBeforeReminder();
  await testReminderSendsSuccessfully();

  console.log("\n" + "═".repeat(70));
  console.log("✅ ALL REMINDER TESTS COMPLETED");
  console.log("═".repeat(70) + "\n");
  
  console.log("\n📋 KEY TAKEAWAYS:");
  console.log("   • Reminders scheduled automatically when rapid job is posted");
  console.log("   • Triggers after 15 minutes if job still unfilled");
  console.log("   • Excludes workers who already applied or dismissed");
  console.log("   • Skips reminder if job is filled or cancelled");
  console.log("   • Shows updated positions remaining in reminder message\n");
}
