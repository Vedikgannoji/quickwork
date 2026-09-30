/**
 * Test script for Rapid Job Notification System
 * Run this to see how the notification logic works
 */

import { testRapidJobNotifications, notifyEligibleWorkers } from "./rapid-job-notifications";
import type { Job } from "./job-types";

// Test Job 1: Hospitality job in Indiranagar (should match multiple workers)
const testJob1: Job = {
  id: "test-job-1",
  jobTitle: "Banquet Server Needed",
  category: "hospitality",
  jobType: "shift",
  venueName: "Grand Palace Hotel",
  area: "Indiranagar",
  date: new Date().toISOString().split('T')[0], // Today
  startTime: "2:00 PM",
  endTime: "10:00 PM",
  duration: "8 hours",
  wageDisplay: "₹450/hr",
  positionsTotal: 5,
  positionsConfirmed: 0,
  positionsRemaining: 5,
  isRapidJob: true,
  rapidJobExpiry: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours
  requirements: {
    experience: "Previous restaurant service experience required",
    skills: ["Guest service", "Food serving", "Professional presentation"],
    facilities: ["Changing room", "Meals provided", "Uniform provided"],
  },
  instructions: {
    beforeArrival: "Arrive 30 minutes early for briefing",
    duringShift: "Maintain professional demeanor at all times",
    reportingContact: "Manager: +91 98765 00001",
  },
  description: "Need experienced servers for a wedding banquet.",
};

// Test Job 2: Warehouse job (should match different workers)
const testJob2: Job = {
  id: "test-job-2",
  jobTitle: "Warehouse Helper",
  category: "warehouse",
  jobType: "shift",
  venueName: "ABC Logistics Hub",
  area: "Electronic City",
  date: new Date().toISOString().split('T')[0],
  startTime: "8:00 AM",
  endTime: "4:00 PM",
  duration: "8 hours",
  wageDisplay: "₹350/shift",
  positionsTotal: 10,
  positionsConfirmed: 0,
  positionsRemaining: 10,
  isRapidJob: true,
  rapidJobExpiry: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  requirements: {
    experience: "No experience required, training provided",
    skills: ["Physical fitness", "Loading/Unloading"],
    facilities: ["Water", "Restrooms"],
  },
  instructions: {
    beforeArrival: "Bring ID proof",
    duringShift: "Follow safety protocols",
    reportingContact: "Supervisor: +91 98765 00002",
  },
  description: "Urgent need for warehouse helpers for inventory management.",
};

// Test Job 3: Regular job (NOT rapid, should not notify)
const testJob3: Job = {
  id: "test-job-3",
  jobTitle: "Event Coordinator",
  category: "events",
  jobType: "contract",
  venueName: "City Convention Center",
  area: "MG Road",
  date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
  startTime: "10:00 AM",
  endTime: "6:00 PM",
  duration: "8 hours",
  wageDisplay: "₹500/hr",
  positionsTotal: 2,
  positionsConfirmed: 0,
  positionsRemaining: 2,
  isRapidJob: false,
  requirements: {
    experience: "Event management experience preferred",
    skills: ["Coordination", "Communication", "Problem solving"],
    facilities: ["Lunch", "AC workspace"],
  },
  instructions: {
    beforeArrival: "Arrive 1 hour early for setup",
    duringShift: "Coordinate with vendors",
    reportingContact: "Manager: +91 98765 00003",
  },
  description: "Looking for event coordinators for upcoming conference.",
};

/**
 * Run all tests
 */
export async function runNotificationTests() {
  console.log("\n🧪 RAPID JOB NOTIFICATION SYSTEM TESTS\n");
  console.log("=" .repeat(70) + "\n");

  // Test 1: Hospitality Rapid Job
  console.log("TEST 1: Hospitality Rapid Job in Indiranagar");
  console.log("-".repeat(70));
  testRapidJobNotifications(testJob1);

  // Simulate actual notifications
  console.log("\n📤 Sending actual notifications...\n");
  const result1 = await notifyEligibleWorkers(testJob1);
  console.log(`\n✅ Test 1 Result: ${result1.totalNotified} workers notified\n\n`);

  // Test 2: Warehouse Rapid Job
  console.log("\nTEST 2: Warehouse Rapid Job in Electronic City");
  console.log("-".repeat(70));
  testRapidJobNotifications(testJob2);

  console.log("\n📤 Sending actual notifications...\n");
  const result2 = await notifyEligibleWorkers(testJob2);
  console.log(`\n✅ Test 2 Result: ${result2.totalNotified} workers notified\n\n`);

  // Test 3: Regular (non-rapid) job
  console.log("\nTEST 3: Regular Job (NOT Rapid)");
  console.log("-".repeat(70));
  testRapidJobNotifications(testJob3);

  console.log("\n📤 Attempting to send notifications...\n");
  const result3 = await notifyEligibleWorkers(testJob3);
  console.log(`\n✅ Test 3 Result: ${result3.totalNotified} workers notified (should be 0)\n\n`);

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(70));
  console.log(`Test 1 (Hospitality): ${result1.totalNotified} notifications sent`);
  console.log(`Test 2 (Warehouse): ${result2.totalNotified} notifications sent`);
  console.log(`Test 3 (Regular Job): ${result3.totalNotified} notifications sent`);
  console.log("\n✅ All tests completed!\n");
}

// Export for use in other files
export { testJob1, testJob2, testJob3 };
