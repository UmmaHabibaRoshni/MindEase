import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import DashboardLayout from "./layouts/DashboardLayout";

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import About from "./pages/public/About";
import ResourceLibrary from "./pages/public/ResourceLibrary"; 
import ManageResources from "./pages/admin/ManageResources"; 

import SeekerDashboard from "./pages/seeker/SeekerDashboard";
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";
import PsychologistDashboard from "./pages/psychologist/PsychologistDashboard";
import NgoDashboard from "./pages/ngo/NgoDashboard";
import FacilitatorDashboard from "./pages/facilitator/FacilitatorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CrisisRequestForm from "./pages/seeker/CrisisRequestForm";

function Placeholder({ title }) {
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1 style={{ fontSize: "24px", color: "#2d3748" }}>{title}</h1>
      <p style={{ color: "#718096" }}>This page is coming soon.</p>
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


function DashboardIndex() {
  const user = getUser();
  return <Navigate to={user ? `/dashboard/${user.role}` : "/login"} replace />;
}


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
        <Route path="/about" element={<About />} />
        <Route path="/resources" element={<ResourceLibrary />} /> 
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
        <Route path="new-request" element={<RequireRole role="seeker"><CrisisRequestForm /></RequireRole>} />

        {/* Admin Specific Route */}
        <Route path="resources" element={<RequireRole role="admin"><ManageResources /></RequireRole>} /> {/* 👈 Admin Manage Resources */}

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