
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import DashboardLayout from "./layouts/DashboardLayout";

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import About from "./pages/public/About";
import ResourceLibrary from "./pages/public/ResourceLibrary"; 
import ManageResources from "./pages/admin/ManageResources";
import Verifications from "./pages/admin/Verifications";
import ManageUsers from "./pages/admin/ManageUsers";

import SeekerDashboard from "./pages/seeker/SeekerDashboard";
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";
import PsychologistDashboard from "./pages/psychologist/PsychologistDashboard";
import NgoDashboard from "./pages/ngo/NgoDashboard";
import ReferralDetail from "./pages/ngo/ReferralDetail";
import FacilitatorDashboard from "./pages/facilitator/FacilitatorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CrisisRequestForm from "./pages/seeker/CrisisRequestForm";
import Workshops from "./pages/seeker/Workshops";
import CreateWorkshop from "./pages/facilitator/CreateWorkshop";
import VideoRoom from "./components/video/VideoRoom";
import CaseDetailPage from "./pages/psychologist/CaseDetailPage";
import PaymentSuccess from "./pages/payment/PaymentSuccess";
import PaymentFailed from "./pages/payment/PaymentFailed";
import PaymentCancelled from "./pages/payment/PaymentCancelled";

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

        {/* T17.9 - SSLCommerz redirects the seeker's browser back to these.
            They sit outside /dashboard and outside RequireRole on purpose: the
            gateway hands us a plain browser navigation, and a seeker who lands
            here should always be told what happened to their money rather than
            be bounced to the login page. */}
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/fail" element={<PaymentFailed />} />
        <Route path="/payment/cancel" element={<PaymentCancelled />} />
      </Route>

      {/* Logged-in pages: Navbar + Sidebar + content */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardIndex />} />

        <Route path="seeker" element={<RequireRole role="seeker"><SeekerDashboard /></RequireRole>} />
        <Route path="volunteer" element={<RequireRole role="volunteer"><VolunteerDashboard /></RequireRole>} />
        <Route path="psychologist" element={<RequireRole role="psychologist"><PsychologistDashboard /></RequireRole>} />
        <Route path="ngo" element={<RequireRole role="ngo"><NgoDashboard /></RequireRole>} />
        <Route path="ngo/referrals/:id" element={<RequireRole role="ngo"><ReferralDetail /></RequireRole>} />
        <Route path="facilitator" element={<RequireRole role="facilitator"><FacilitatorDashboard /></RequireRole>} />
        <Route path="admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
        <Route path="new-request" element={<RequireRole role="seeker"><CrisisRequestForm /></RequireRole>} />

        {/* T12.8 - seeker workshops list with enroll / cancel */}
        <Route path="workshops" element={<RequireRole role="seeker"><Workshops /></RequireRole>} />

        {/* T12.7 - facilitator create workshop form */}
        <Route path="workshops/new" element={<RequireRole role="facilitator"><CreateWorkshop /></RequireRole>} />

        {/* Admin Manage Resources Route */}
        <Route path="resources" element={<RequireRole role="admin"><ManageResources /></RequireRole>} />

        {/* T8.8 - admin account verification queue */}
        <Route path="verifications" element={<RequireRole role="admin"><Verifications /></RequireRole>} />

        {/* T18.6 - video room landing page. kind is workshop, case or request;
            who may open which room is decided by the API, not by this route. */}
        <Route path="video/:kind/:id" element={<VideoRoom />} />

        {/* T18.8 - the psychologist case page. It existed but was never
            routed, so the Join video consultation button had nowhere to live. */}
        <Route
          path="psychologist/cases/:caseId"
          element={<RequireRole role="psychologist"><CaseDetailPage /></RequireRole>}
        />

        {/* T16.9 - admin user management */}
        <Route path="users" element={<RequireRole role="admin"><ManageUsers /></RequireRole>} />

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