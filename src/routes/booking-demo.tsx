/**
 * Route demonstrating the transaction‑safe booking model.
 */
import { createFileRoute } from "@tanstack/react-router";

import { BookingDemo } from "@/components/booking-demo";

export const Route = createFileRoute("/booking-demo")({
  head: () => ({
    meta: [
      { title: "Booking Model Demo — QuickWork" },
      {
        name: "description",
        content: "Demo of transaction‑safe booking with slots, locks, and expiration.",
      },
    ],
  }),
  component: BookingDemoPage,
});

function BookingDemoPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="mb-10">
        <h1 className="text-4xl sm:text-5xl">Booking Data Model Demo</h1>
        <p className="mt-3 text-muted-foreground">
          This demonstrates the transaction‑safe booking system with:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>• Job → Categories → Slots hierarchy</li>
          <li>• Slot states: available, locked (2‑min), booked, expired</li>
          <li>• Transaction safety: two users can't claim the same slot</li>
          <li>• Automatic lock expiration and cleanup</li>
        </ul>
      </div>
      
      <BookingDemo />
      
      <div className="mt-10 rounded-xl border border-border bg-surface/50 p-6">
        <h3 className="font-display text-lg font-bold">How to Test Transaction Safety</h3>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. Open this page in two browser tabs</li>
          <li>2. In Tab 1, book a slot → it will lock for 2 minutes</li>
          <li>3. In Tab 2, try to book the same slot → it will fail</li>
          <li>4. Wait 2+ minutes → the lock expires</li>
          <li>5. In Tab 2, try again → now it can book</li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Note: This demo uses in‑memory state. In production, this would be backed by a database with row‑level locking.
        </p>
      </div>
    </div>
  );
}