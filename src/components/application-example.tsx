/**
 * Example: Application Model Usage in Components
 * 
 * This file demonstrates how to use the Application model in real components.
 * Copy these patterns into your actual pages/components.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, XCircle, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  useApplications,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  canConfirmApplication,
  canRejectApplication,
  canWaitlistApplication,
  type Application,
} from '@/lib/application-model';

// ─── Example 1: Worker Applies to Job ─────────────────────────────────────────

export function ApplyToJobButton({ jobId, workerId }: { jobId: string; workerId: string }) {
  const { submitApplication, hasApplied } = useApplications();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');
  
  const alreadyApplied = hasApplied(workerId, jobId);
  
  const handleApply = async () => {
    setIsSubmitting(true);
    
    const result = submitApplication({
      workerId,
      jobId,
      workerNote: note || undefined,
    });
    
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success('Application submitted successfully!');
      setNote('');
    } else if (result.reason === 'duplicate_application') {
      toast.error('You have already applied to this job.');
    } else {
      toast.error('Failed to submit application. Please try again.');
    }
  };
  
  if (alreadyApplied) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Already Applied</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your application is being reviewed by the employer.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: Add a note about your experience or availability..."
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        rows={3}
      />
      <Button
        onClick={handleApply}
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Submitting...' : 'Apply to This Job'}
      </Button>
    </div>
  );
}

// ─── Example 2: Worker Views Their Applications ───────────────────────────────

export function MyApplicationsList({ workerId }: { workerId: string }) {
  const { getApplicationsByWorker } = useApplications();
  const applications = getApplicationsByWorker(workerId);
  
  if (applications.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No Applications Yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse available jobs and apply to get started.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Applications</h2>
        <span className="text-sm text-muted-foreground">
          {applications.length} total
        </span>
      </div>
      
      {applications.map((app) => (
        <ApplicationCard key={app.id} application={app} />
      ))}
    </div>
  );
}

// ─── Example 3: Poster Reviews Applications ───────────────────────────────────

export function ReviewApplicationsPage({ jobId }: { jobId: string }) {
  const {
    getApplicationsForJob,
    getJobApplicationStats,
    confirmApplication,
    rejectApplication,
    waitlistApplication,
  } = useApplications();
  
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'waitlisted'>('all');
  
  const allApplications = getApplicationsForJob(jobId);
  const stats = getJobApplicationStats(jobId);
  
  const filteredApplications = filter === 'all'
    ? allApplications
    : allApplications.filter(app => {
        if (filter === 'pending') return app.status === 'Pending';
        if (filter === 'confirmed') return app.status === 'Confirmed';
        if (filter === 'waitlisted') return app.status === 'Waitlisted';
        return true;
      });
  
  const handleConfirm = (appId: string) => {
    const result = confirmApplication(appId, 'Welcome! Looking forward to working with you.');
    if (result.success) {
      toast.success('Application confirmed!');
    }
  };
  
  const handleReject = (appId: string) => {
    const result = rejectApplication(appId, 'Position filled. Thank you for your interest.');
    if (result.success) {
      toast.success('Application rejected.');
    }
  };
  
  const handleWaitlist = (appId: string) => {
    const result = waitlistApplication(appId, 'Great profile! Backup option.');
    if (result.success) {
      toast.success('Moved to waitlist.');
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={Users}
          color="text-foreground"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock}
          color="text-amber-600"
        />
        <StatCard
          label="Confirmed"
          value={stats.confirmed}
          icon={CheckCircle2}
          color="text-green-600"
        />
        <StatCard
          label="Waitlisted"
          value={stats.waitlisted}
          icon={Users}
          color="text-blue-600"
        />
      </div>
      
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <TabButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`All (${stats.total})`}
        />
        <TabButton
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
          label={`Pending (${stats.pending})`}
        />
        <TabButton
          active={filter === 'confirmed'}
          onClick={() => setFilter('confirmed')}
          label={`Confirmed (${stats.confirmed})`}
        />
        <TabButton
          active={filter === 'waitlisted'}
          onClick={() => setFilter('waitlisted')}
          label={`Waitlisted (${stats.waitlisted})`}
        />
      </div>
      
      {/* Applications List */}
      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No {filter === 'all' ? '' : filter} applications yet.
          </p>
        ) : (
          filteredApplications.map((app) => (
            <ApplicationCardWithActions
              key={app.id}
              application={app}
              onConfirm={() => handleConfirm(app.id)}
              onReject={() => handleReject(app.id)}
              onWaitlist={() => handleWaitlist(app.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Supporting Components ─────────────────────────────────────────────────────

function ApplicationCard({ application }: { application: Application }) {
  const colors = APPLICATION_STATUS_COLORS[application.status];
  const label = APPLICATION_STATUS_LABELS[application.status];
  
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-medium">Job: {application.jobId}</p>
          <p className="text-sm text-muted-foreground">
            Applied: {new Date(application.appliedAt).toLocaleDateString()}
          </p>
          {application.confirmedAt && (
            <p className="text-sm text-muted-foreground">
              Confirmed: {new Date(application.confirmedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}
        >
          {label}
        </span>
      </div>
      
      {application.workerNote && (
        <div className="mt-3 rounded bg-muted/50 p-2">
          <p className="text-sm italic text-muted-foreground">
            "{application.workerNote}"
          </p>
        </div>
      )}
      
      {application.posterNote && (
        <div className="mt-3 rounded border border-primary/20 bg-primary/5 p-2">
          <p className="text-xs font-medium text-primary">Employer note:</p>
          <p className="mt-1 text-sm">{application.posterNote}</p>
        </div>
      )}
    </div>
  );
}

function ApplicationCardWithActions({
  application,
  onConfirm,
  onReject,
  onWaitlist,
}: {
  application: Application;
  onConfirm: () => void;
  onReject: () => void;
  onWaitlist: () => void;
}) {
  const colors = APPLICATION_STATUS_COLORS[application.status];
  const label = APPLICATION_STATUS_LABELS[application.status];
  
  const showActions = application.status === 'Pending' || application.status === 'Waitlisted';
  
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-medium">Worker: {application.workerId}</p>
          <p className="text-sm text-muted-foreground">
            Applied: {new Date(application.appliedAt).toLocaleDateString()}
          </p>
        </div>
        
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}
        >
          {label}
        </span>
      </div>
      
      {application.workerNote && (
        <div className="mt-3 rounded bg-muted/50 p-2">
          <p className="text-xs font-medium text-muted-foreground">Worker note:</p>
          <p className="mt-1 text-sm">{application.workerNote}</p>
        </div>
      )}
      
      {showActions && (
        <div className="mt-4 flex gap-2">
          {canConfirmApplication(application.status) && (
            <Button onClick={onConfirm} size="sm" className="flex-1">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm
            </Button>
          )}
          
          {canWaitlistApplication(application.status) && (
            <Button onClick={onWaitlist} size="sm" variant="outline" className="flex-1">
              <Clock className="mr-2 h-4 w-4" />
              Waitlist
            </Button>
          )}
          
          {canRejectApplication(application.status) && (
            <Button onClick={onReject} size="sm" variant="ghost" className="flex-1">
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Example 4: Bulk Actions ──────────────────────────────────────────────────

export function BulkApplicationActions({
  selectedApplicationIds,
  onComplete,
}: {
  selectedApplicationIds: string[];
  onComplete: () => void;
}) {
  const { confirmApplication, rejectApplication } = useApplications();
  
  const handleBulkConfirm = () => {
    let successCount = 0;
    let failCount = 0;
    
    selectedApplicationIds.forEach((id) => {
      const result = confirmApplication(id, 'Batch confirmed - welcome!');
      if (result.success) successCount++;
      else failCount++;
    });
    
    toast.success(`Confirmed ${successCount} applications`);
    if (failCount > 0) {
      toast.error(`Failed to confirm ${failCount} applications`);
    }
    
    onComplete();
  };
  
  const handleBulkReject = () => {
    let successCount = 0;
    let failCount = 0;
    
    selectedApplicationIds.forEach((id) => {
      const result = rejectApplication(id, 'Position filled. Thank you for applying.');
      if (result.success) successCount++;
      else failCount++;
    });
    
    toast.success(`Rejected ${successCount} applications`);
    if (failCount > 0) {
      toast.error(`Failed to reject ${failCount} applications`);
    }
    
    onComplete();
  };
  
  if (selectedApplicationIds.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg border bg-card p-4 shadow-lg">
      <p className="mb-3 text-sm font-medium">
        {selectedApplicationIds.length} application(s) selected
      </p>
      <div className="flex gap-2">
        <Button onClick={handleBulkConfirm} size="sm">
          Confirm All
        </Button>
        <Button onClick={handleBulkReject} size="sm" variant="outline">
          Reject All
        </Button>
        <Button onClick={onComplete} size="sm" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}
