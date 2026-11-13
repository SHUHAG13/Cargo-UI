import { BookingStatus, InstallmentState, Payment } from '../core/models';

/** Visual treatment per booking status (icon tile, badge, status chip, paid-amount colour). */
export const STATUS_UI: Record<BookingStatus, { icon: string; tile: string; badge: string; chip: string; label: string; dot: string }> = {
  pending: { icon: 'fa-regular fa-clock', tile: 'bg-orange-50 text-orange-400', badge: 'bg-orange-100 text-orange-600', chip: 'bg-orange-50 text-orange-600', label: 'Pending', dot: 'bg-orange-500' },
  confirmed: { icon: 'fa-regular fa-circle-check', tile: 'bg-green-50 text-emerald-600', badge: 'bg-green-100 text-green-600', chip: 'bg-green-50 text-emerald-600', label: 'Confirmed', dot: 'bg-emerald-500' },
  'in-progress': { icon: 'fa-regular fa-user', tile: 'bg-blue-50 text-blue-400', badge: 'bg-blue-100 text-blue-600', chip: 'bg-blue-50 text-blue-600', label: 'In Progress', dot: 'bg-blue-500' },
  completed: { icon: 'fa-regular fa-circle-check', tile: 'bg-green-50 text-emerald-600', badge: 'bg-green-100 text-green-600', chip: 'bg-green-50 text-emerald-600', label: 'Completed', dot: 'bg-emerald-500' },
  cancelled: { icon: 'fa-regular fa-circle-xmark', tile: 'bg-red-50 text-red-400', badge: 'bg-red-100 text-red-600', chip: 'bg-red-50 text-red-500', label: 'Cancelled', dot: 'bg-red-500' },
};

export const INSTALLMENT_UI: Record<InstallmentState, { label: string; dot: string; text: string; chip: string }> = {
  paid: { label: 'Paid', dot: 'bg-emerald-600', text: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-700' },
  'pending-verification': { label: 'Pending verification', dot: 'bg-amber-500', text: 'text-amber-600', chip: 'bg-amber-50 text-amber-700' },
  due: { label: 'Due now', dot: 'bg-orange-500', text: 'text-orange-500', chip: 'bg-orange-50 text-orange-600' },
  overdue: { label: 'Overdue', dot: 'bg-red-500', text: 'text-red-500', chip: 'bg-red-50 text-red-600' },
  upcoming: { label: 'Upcoming', dot: 'bg-slate-400', text: 'text-slate-600', chip: 'bg-slate-100 text-slate-600' },
};

export const PAYMENT_UI: Record<Payment['status'], { label: string; chip: string }> = {
  success: { label: 'Success', chip: 'bg-green-100 text-green-700' },
  'pending-verification': { label: 'Pending Verification', chip: 'bg-amber-100 text-amber-700' },
  failed: { label: 'Failed / Disputed', chip: 'bg-red-100 text-red-600' },
};

export const DEMO_ACCOUNTS = [
  { role: 'Customer', identifier: 'customer@carego.demo', password: 'demo1234', note: 'Books care, pays, manages patients' },
  { role: 'Caregiver', identifier: 'caregiver@carego.demo', password: 'demo1234', note: 'Shifts, cash, earnings and ledger' },
  { role: 'Admin', identifier: 'admin@carego.demo', password: 'demo1234', note: 'Confirms, assigns, verifies, pays out' },
];
