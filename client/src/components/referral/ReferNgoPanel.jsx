import { useEffect, useState } from "react";
import axios from "axios";
import { CATEGORIES } from "../../constants/requestOptions";
import ConsentConfirm from "../common/ConsentConfirm";

// Props:
//   requestId       - the crisis request being referred
//   defaultCategory - optional, pre-selects the request's category
//   onReferred()    - called after a successful referral
//
// Assumes: GET /api/ngos?category=<value> returns verified NGOs only
// and POST /api/referrals takes { requestId, ngoId, consent: true } (T6.3).
export default function ReferNgoPanel({ requestId, defaultCategory = "", onReferred }) {
  const [category, setCategory] = useState(defaultCategory);
  const [ngos, setNgos] = useState([]);
  const [selectedNgo, setSelectedNgo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (!category) {
      setNgos([]);
      return;
    }
    setLoading(true);
    setError("");
    setSelectedNgo(null);
    axios
      .get(`/api/ngos?category=${category}`, authHeader)
      .then((res) => setNgos(res.data.ngos || res.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load NGOs."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const confirmReferral = async () => {
    setError("");
    try {
      await axios.post(
        "/api/referrals",
        { requestId, ngoId: selectedNgo._id, consent: true },
        authHeader
      );
      setSelectedNgo(null);
      onReferred && onReferred();
    } catch (err) {
      setError(err.response?.data?.message || "Referral failed. Try again.");
    }
  };

  return (
    <div style={{ maxWidth: "520px" }}>
      <h3>Refer to an NGO</h3>

      <label>
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ display: "block", marginTop: "4px", marginBottom: "12px" }}
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={{ color: "#B91C1C" }}>{error}</p>}
      {loading && <p>Loading verified NGOs...</p>}
      {!loading && category && ngos.length === 0 && !error && (
        <p>No verified NGOs found for this category.</p>
      )}

      {!selectedNgo && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {ngos.map((ngo) => (
            <li
              key={ngo._id}
              style={{
                border: "1px solid #D1D5DB",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "8px",
              }}
            >
              <strong>{ngo.name}</strong>
              <p style={{ margin: "4px 0 8px" }}>{ngo.description}</p>
              <button type="button" onClick={() => setSelectedNgo(ngo)}>
                Select
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedNgo && (
        <ConsentConfirm
          ngoName={selectedNgo.name}
          onConfirm={confirmReferral}
          onCancel={() => setSelectedNgo(null)}
        />
      )}
    </div>
  );
}