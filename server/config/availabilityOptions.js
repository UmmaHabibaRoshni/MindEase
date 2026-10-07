// T10.2 - availability constants (BL-10)
// enum values must match client/src/constants/availabilityOptions.js

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// "09:00" / "17:30" - 24 hour, zero padded
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Minutes since midnight, so two "HH:MM" strings can be compared.
function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

module.exports = { DAYS_OF_WEEK, TIME_PATTERN, toMinutes };
