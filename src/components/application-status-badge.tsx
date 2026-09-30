/**
 * Application Status Badge Component
 * Displays application status with appropriate colors and labels
 */

import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, type ApplicationStatusValue } from '@/lib/application-model';

interface ApplicationStatusBadgeProps {
  status: ApplicationStatusValue;
  className?: string;
}

export function ApplicationStatusBadge({ status, className = '' }: ApplicationStatusBadgeProps) {
  const colors = APPLICATION_STATUS_COLORS[status];
  const label = APPLICATION_STATUS_LABELS[status];
  
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} ${className}`}
    >
      {label}
    </span>
  );
}
