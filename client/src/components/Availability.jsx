import { useEffect, useState } from "react";
import { getMyAvailability, updateAvailability, readError } from "../api/volunteerApi";
import { DAYS_OF_WEEK, TIME_PATTERN, toMinutes } from "../constants/availabilityOptions";

const card = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
  background: "#fff",
};

const row = { marginBottom: "0.75rem" };

export default function Availability() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const a = await getMyAvailability();
        setIsAvailable(Boolean(a?.isAvailable));
        setDayOfWeek(a?.dayOfWeek || "");
        setStartTime(a?.startTime || "");
        setEndTime(a?.endTime || "");
      } catch (err) {
        setError(readError(err, "Could not load your availability."));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const validate = () => {
    if (isAvailable && (!dayOfWeek || !startTime || !endTime)) {
      return "Choose a day, start time and end time before marking yourself available.";
    }
    if (startTime && !TIME_PATTERN.test(startTime)) return "Start time is not valid.";
    if (endTime && !TIME_PATTERN.test(endTime)) return "End time is not valid.";
    if (startTime && endTime && toMinutes(endTime) <= toMinutes(startTime)) {
      return "End time must be later than start time.";
    }
    return "";
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const fields = { isAvailable };
    if (dayOfWeek) fields.dayOfWeek = dayOfWeek;
    if (startTime) fields.startTime = startTime;
    if (endTime) fields.endTime = endTime;

    setSaving(true);
    try {
      const a = await updateAvailability(fields);
      setIsAvailable(Boolean(a?.isAvailable));
      setMessage("Availability saved.");
    } catch (err) {
      setError(readError(err, "Could not save your availability."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading your availability...</p>;

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Your availability</h2>
      <p>
        Current status:{" "}
        <strong style={{ color: isAvailable ? "green" : "#666" }}>
          {isAvailable ? "Available" : "Not available"}
        </strong>
      </p>

      <div style={row}>
        <label>
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
          />{" "}
          I am available to take requests
        </label>
      </div>

      <div style={row}>
        <label>
          Day:{" "}
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            <option value="">Choose a day</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={row}>
        <label>
          From:{" "}
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>{" "}
        <label>
          To: <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>

      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save availability"}
      </button>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}