
import React, { useState } from "react";
import { createWorkshop, errorMessage } from "../../api/workshopApi";

const MODES = ["Online", "In-Person", "Hybrid"];

// <input type="time"> gives "14:30"; the server wants "02:30 PM"
export const to12Hour = (value) => {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
};

// today as YYYY-MM-DD in the local time zone, for the date input's min
const todayLocal = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const EMPTY = {
  title: "",
  description: "",
  date: "",
  time: "",
  durationMinutes: 60,
  mode: "Online",
  locationOrLink: "",
  capacity: 20,
  price: "",
};

const labelStyle = { display: "block", fontSize: "13px", fontWeight: "600", color: "#2d3748", marginBottom: "6px" };
const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" };
const fieldStyle = { marginBottom: "16px" };

export default function CreateWorkshop() {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim()) return setError("Enter a workshop title.");
    if (!form.date) return setError("Choose a date.");
    if (!form.time) return setError("Choose a start time.");

    // T17.7 - price is optional. Blank means free, so it is left out of the
    // request entirely rather than sent as an empty string.
    const priceEntered = String(form.price).trim();
    if (priceEntered !== "") {
      const price = Number(priceEntered);
      if (!Number.isFinite(price) || price < 0) {
        return setError("Price must be a number, 0 or more. Leave it blank for a free workshop.");
      }
    }

    setSaving(true);
    try {
      await createWorkshop({
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date,
        time: to12Hour(form.time),
        durationMinutes: Number(form.durationMinutes),
        mode: form.mode,
        locationOrLink: form.locationOrLink.trim(),
        capacity: Number(form.capacity),
        ...(priceEntered === "" ? {} : { price: Number(priceEntered) }),
      });
      setSuccess(
        Number(priceEntered) > 0
          ? `Workshop created at ${Number(priceEntered)} BDT. Seekers can pay and enroll now.`
          : "Workshop created. Seekers can enroll now."
      );
      setForm(EMPTY);
    } catch (err) {
      setError(errorMessage(err, "Could not create the workshop. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <h2 style={{ margin: 0, color: "#2d3748", fontSize: "24px", fontWeight: "600" }}>Create a workshop</h2>
      <p style={{ margin: "4px 0 24px", color: "#718096", fontSize: "14px" }}>
        Seekers see the workshop in their list as soon as you save it.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
      >
        <div style={fieldStyle}>
          <label htmlFor="title" style={labelStyle}>Title</label>
          <input id="title" style={inputStyle} value={form.title} onChange={set("title")} maxLength={150} />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="description" style={labelStyle}>Description</label>
          <textarea
            id="description"
            style={{ ...inputStyle, minHeight: "96px", resize: "vertical" }}
            value={form.description}
            onChange={set("description")}
            maxLength={2000}
          />
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: "160px" }}>
            <label htmlFor="date" style={labelStyle}>Date</label>
            <input id="date" type="date" min={todayLocal()} style={inputStyle} value={form.date} onChange={set("date")} />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: "160px" }}>
            <label htmlFor="time" style={labelStyle}>Start time</label>
            <input id="time" type="time" style={inputStyle} value={form.time} onChange={set("time")} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ ...fieldStyle, flex: 1, minWidth: "160px" }}>
            <label htmlFor="durationMinutes" style={labelStyle}>Duration (minutes)</label>
            <input
              id="durationMinutes"
              type="number"
              min={15}
              max={480}
              style={inputStyle}
              value={form.durationMinutes}
              onChange={set("durationMinutes")}
            />
          </div>
          <div style={{ ...fieldStyle, flex: 1, minWidth: "160px" }}>
            <label htmlFor="capacity" style={labelStyle}>Seats</label>
            <input
              id="capacity"
              type="number"
              min={1}
              max={500}
              style={inputStyle}
              value={form.capacity}
              onChange={set("capacity")}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="price" style={labelStyle}>Price (BDT)</label>
          <input
            id="price"
            type="number"
            min={0}
            step="1"
            placeholder="Leave blank for a free workshop"
            style={inputStyle}
            value={form.price}
            onChange={set("price")}
          />
          <p style={{ color: "#718096", fontSize: "12px", margin: "6px 0 0" }}>
            Blank or 0 keeps the workshop free. Any amount above 0 means seekers
            pay before they are enrolled.
          </p>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="mode" style={labelStyle}>Mode</label>
          <select id="mode" style={inputStyle} value={form.mode} onChange={set("mode")}>
            {MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="locationOrLink" style={labelStyle}>Meeting link or address</label>
          <input id="locationOrLink" style={inputStyle} value={form.locationOrLink} onChange={set("locationOrLink")} />
        </div>

        {error && (
          <p role="alert" style={{ color: "crimson", fontSize: "14px", margin: "0 0 16px" }}>{error}</p>
        )}
        {success && (
          <p role="status" style={{ color: "#22543d", fontSize: "14px", margin: "0 0 16px" }}>{success}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            backgroundColor: saving ? "#9ae6b4" : "#2f855a",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: saving ? "default" : "pointer",
            fontWeight: "600",
          }}
        >
          {saving ? "Saving..." : "Create workshop"}
        </button>
      </form>
    </div>
  );
}