/**
 * Demo component showing the transaction‑safe booking model in action.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Clock, Lock, User, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useBookingStore, useBookingTransaction, type SlotStatus, seedMockData } from '@/lib/booking-model';

// ─── Slot Status Badge ───────────────────────────────────────────────────────

function SlotStatusBadge({ status }: { status: SlotStatus | 'not_found' }) {
  const config: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    available: {
      label: 'Available',
      color: 'bg-success/15 text-success border-success/30',
      icon: <Check className="size-3" />,
    },
    locked: {
      label: 'Locked',
      color: 'bg-warning/15 text-warning border-warning/30',
      icon: <Lock className="size-3" />,
    },
    booked: {
      label: 'Booked',
      color: 'bg-destructive/15 text-destructive border-destructive/30',
      icon: <User className="size-3" />,
    },
    expired: {
      label: 'Expired',
      color: 'bg-muted text-muted-foreground border-muted',
      icon: <X className="size-3" />,
    },
    not_found: {
      label: 'Not Found',
      color: 'bg-muted text-muted-foreground border-muted',
      icon: <X className="size-3" />,
    },
  };

  const cfg = config[status] || config.not_found;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Booking Demo Component ─────────────────────────────────────────────────

export function BookingDemo() {
  const { user, isLoggedIn } = useAuth();
  const { attemptBooking, isSlotBookable } = useBookingTransaction();
  const { jobs, getJobWithSlots, expireLocks } = useBookingStore();
  
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Seed mock data on first load
  useEffect(() => {
    if (Object.keys(jobs).length === 0) {
      seedMockData();
    }
    
    // Clean up expired locks every 10 seconds
    const interval = setInterval(() => {
      const expired = expireLocks();
      if (expired > 0) {
        setRefreshTrigger(prev => prev + 1);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [jobs, expireLocks, refreshTrigger]);

  const sampleJobs = Object.values(jobs).slice(0, 2); // Show first 2 jobs

  async function handleBookSlot(slotId: string) {
    if (!isLoggedIn || !user) {
      toast.error('Please log in to book a slot');
      return;
    }

    setBookingInProgress(true);
    setSelectedSlot(slotId);

    const result = await attemptBooking(slotId, user.id);

    if (result.success) {
      toast.success('Slot booked successfully!');
    } else {
      toast.error(result.error || 'Booking failed');
    }

    setBookingInProgress(false);
    setRefreshTrigger(prev => prev + 1);
  }

  if (sampleJobs.length === 0) {
    return (
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>Booking System</CardTitle>
          <CardDescription>Loading booking data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface/50 p-6">
        <h3 className="font-display text-2xl font-bold">Transaction‑Safe Booking Demo</h3>
        <p className="mt-2 text-muted-foreground">
          Each category generates slots equal to its headcount. Slots have 4 states: available, locked (2‑min hold), booked, expired.
          Try booking slots simultaneously in multiple tabs to see transaction safety.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          <span>Locks expire automatically after 2 minutes</span>
        </div>
      </div>

      {sampleJobs.map(job => {
        const jobWithSlots = getJobWithSlots(job.id);
        
        return (
          <Card key={job.id} className="animate-rise">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{job.title}</CardTitle>
                  <CardDescription>
                    {job.location} • {new Date(job.date).toLocaleDateString()} • {job.startTime}‑{job.endTime}
                  </CardDescription>
                </div>
                {jobWithSlots && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-success">{jobWithSlots.availableSlots}</div>
                    <div className="text-xs text-muted-foreground">slots available</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">{job.description}</p>
              
              {job.categories.map(category => (
                <div key={category.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{category.name}</h4>
                      <p className="text-sm text-muted-foreground">₹{category.wage} / shift • {category.headcount} slots</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {category.slots.map(slot => (
                        <SlotStatusBadge key={slot.id} status={slot.status} />
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {category.slots.map(slot => {
                      const bookable = isSlotBookable(slot.id);
                      const isSelected = selectedSlot === slot.id;
                      
                      return (
                        <div
                          key={slot.id}
                          className={`rounded-lg border p-3 transition-all duration-200 ${
                            slot.status === 'booked'
                              ? 'border-destructive/30 bg-destructive/5'
                              : slot.status === 'locked'
                              ? 'border-warning/30 bg-warning/5'
                              : slot.status === 'available'
                              ? 'border-success/30 bg-success/5 hover:border-success/50'
                              : 'border-muted bg-muted'
                          } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">Slot #{slot.id.slice(-4)}</div>
                            <SlotStatusBadge status={slot.status} />
                          </div>
                          
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {slot.lockedAt && (
                              <div className="flex items-center gap-1">
                                <Lock className="size-3" />
                                Locked at {new Date(slot.lockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                            {slot.bookedBy && (
                              <div className="flex items-center gap-1">
                                <User className="size-3" />
                                Booked by user
                              </div>
                            )}
                          </div>
                          
                          <Button
                            variant={slot.status === 'available' ? 'hero' : 'outline'}
                            size="sm"
                            className="mt-3 w-full"
                            disabled={
                              !bookable.bookable ||
                              bookingInProgress ||
                              !isLoggedIn ||
                              slot.status === 'booked'
                            }
                            onClick={() => handleBookSlot(slot.id)}
                          >
                            {slot.status === 'available' && 'Book Slot'}
                            {slot.status === 'locked' && 'Locked'}
                            {slot.status === 'booked' && 'Booked'}
                            {slot.status === 'expired' && 'Expired'}
                          </Button>
                          
                          {!isLoggedIn && slot.status === 'available' && (
                            <p className="mt-2 text-xs text-warning">
                              Log in to book this slot
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
      
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm font-normal">How Transaction Safety Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-success/15 text-success">1</div>
            <span>User attempts to book a slot → system locks it for 2 minutes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-success/15 text-success">2</div>
            <span>During lock period, no other user can book the same slot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-success/15 text-success">3</div>
            <span>If booking completes within 2 min, slot changes to 'booked'</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-warning/15 text-warning">4</div>
            <span>If lock expires, slot becomes 'expired' then 'available' again</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}