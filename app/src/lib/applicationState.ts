export type ApplicationStatus = 'pending' | 'shortlisted' | 'selected' | 'rejected' | 'withdrawn' | 'declined_by_applicant';
export const applicationLabels: Record<ApplicationStatus, string> = {
  pending: 'New', shortlisted: 'Shortlisted', selected: 'Selected', rejected: 'Declined',
  withdrawn: 'Withdrawn', declined_by_applicant: 'Declined by Applicant',
};
/** An applicant stage never grants chat access or mutates property capacity. */
export function assertApplicationTransition(current: ApplicationStatus, next: ApplicationStatus, owner: boolean) {
  if (current === next) return;
  const allowed = owner
    ? ({ pending: ['shortlisted', 'selected', 'rejected'], shortlisted: ['selected', 'rejected'], selected: ['rejected'] } as Partial<Record<ApplicationStatus, ApplicationStatus[]>>)
    : ({ pending: ['withdrawn'], shortlisted: ['withdrawn'], selected: ['withdrawn', 'declined_by_applicant'] } as Partial<Record<ApplicationStatus, ApplicationStatus[]>>);
  if (!allowed[current]?.includes(next)) throw new Error('This application changed or the action is not permitted. Refresh and try again.');
}
