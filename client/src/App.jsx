
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import DashboardLayout from "./layouts/DashboardLayout";

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";

import SeekerDashboard from "./pages/seeker/SeekerDashboard";
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";
import PsychologistDashboard from "./pages/psychologist/PsychologistDashboard";
import NgoDashboard from "./pages/ngo/NgoDashboard";
import FacilitatorDashboard from "./pages/facilitator/FacilitatorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

function Placeholder({ title }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>This page is coming soon.</p>
    </div>
  );
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

// /dashboard -> নিজের role-এর dashboard-এ পাঠায়
function DashboardIndex() {
  const user = getUser();
  return <Navigate to={user ? `/dashboard/${user.role}` : "/login"} replace />;
}

// ভুল role হলে নিজের dashboard-এ ফেরত পাঠায়
function RequireRole({ role, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={`/dashboard/${user.role}`} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public pages: Navbar + content + Footer */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<Placeholder title="About" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Logged-in pages: Navbar + Sidebar + content */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardIndex />} />

        <Route path="seeker" element={<RequireRole role="seeker"><SeekerDashboard /></RequireRole>} />
        <Route path="volunteer" element={<RequireRole role="volunteer"><VolunteerDashboard /></RequireRole>} />
        <Route path="psychologist" element={<RequireRole role="psychologist"><PsychologistDashboard /></RequireRole>} />
        <Route path="ngo" element={<RequireRole role="ngo"><NgoDashboard /></RequireRole>} />
        <Route path="facilitator" element={<RequireRole role="facilitator"><FacilitatorDashboard /></RequireRole>} />
        <Route path="admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />

        <Route path="mood" element={<Placeholder title="Mood Tracker" />} />
        <Route path="journal" element={<Placeholder title="Journal" />} />
        <Route path="sessions" element={<Placeholder title="Book a Session" />} />
        <Route path="appointments" element={<Placeholder title="My Appointments" />} />
        <Route path="clients" element={<Placeholder title="My Clients" />} />
        <Route path="users" element={<Placeholder title="Manage Users" />} />
        <Route path="reports" element={<Placeholder title="Reports" />} />
        <Route path="profile" element={<Placeholder title="Profile" />} />
      </Route>

      <Route path="*" element={<Placeholder title="Page Not Found" />} />
    </Routes>
  );
}