// The stable outbox line contract every alert delivery writes and every
// future reader (see src/alerts/outbox.ts) depends on — exactly these six
// fields, no more, no less (spec §2.1).
export interface AlertLine {
  order_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  channel: string;
  calendar_day: string;
}

const ALERT_CHANNEL = "#order-alerts";

// constitution.md §5: name reduces to first name + last initial.
export function maskName(firstName: string, lastName: string): string {
  const initial = lastName.charAt(0);
  return initial ? `${firstName} ${initial}` : firstName;
}

// constitution.md §5: phone reduces to its last 4 digits; null renders as
// "unknown" rather than throwing (spec AC8).
export function maskPhone(phone: string | null): string {
  if (!phone) {
    return "unknown";
  }
  return phone.slice(-4);
}

export interface BuildAlertPayloadInput {
  orderId: number;
  customerId: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  calendarDay: string;
  includePii: boolean;
}

// Masking is on by default; ALERT_INCLUDE_PII=true is resolved once by the
// caller and threaded in here as `includePii`, never read from process.env
// in this module, so the function stays a pure, directly testable mapping.
export function buildAlertPayload(input: BuildAlertPayloadInput): AlertLine {
  const {
    orderId,
    customerId,
    firstName,
    lastName,
    phone,
    calendarDay,
    includePii,
  } = input;

  const customerName = includePii
    ? `${firstName} ${lastName}`
    : maskName(firstName, lastName);

  const customerPhone = includePii ? (phone ?? "unknown") : maskPhone(phone);

  return {
    order_id: orderId,
    customer_id: customerId,
    customer_name: customerName,
    customer_phone: customerPhone,
    channel: ALERT_CHANNEL,
    calendar_day: calendarDay,
  };
}
