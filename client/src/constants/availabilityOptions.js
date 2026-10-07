// T10.2 - availability constants (BL-10)
// Must stay in sync with server/config/availabilityOptions.js

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// "09:00" / "17:30" - 24 hour, zero padded
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
