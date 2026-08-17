/**
 * Seat-grid booking demo — cinema-style slot selection.
 */
import { createFileRoute } from "@tanstack/react-router";

import { SeatGridDemo } from "@/components/seat-grid";

export const Route = createFileRoute("/booking-demo")({
  head: () => ({
    meta: [
      { title: "Book Slots — QuickWork" },
      {
        name: "description",
        content: "Cinema-style seat grid for booking job slots with live holds and countdown timers.",
      },
    ],
  }),
  component: BookingDemoPage,
});

function BookingDemoPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
      <div className="mb-10">
        <h1 className="text-4xl sm:text-5xl">Select Your Slots</h1>
        <p className="mt-3 text-muted-foreground">
          Pick from available openings below. Each selection holds your spot for 2 minutes — confirm before time runs out.
        </p>
      </div>

      <SeatGridDemo />
    </div>
  );
}