import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";

function Placeholder({ title }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>This page is coming soon.</p>
    </div>
  );
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
        <Route index element={<Placeholder title="Overview" />} />
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