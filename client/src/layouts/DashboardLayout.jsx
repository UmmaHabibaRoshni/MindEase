import { Navigate, Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Sidebar from "../components/common/Sidebar";
import "../styles/experience.css";
import "../styles/tw-compat.css";
import "../styles/theme.css";

// Signed-in shell.
//
// Same experience layer as the public side, with `me-app-dashboard` pulling
// the background back a little (see experience.css) so dense tables stay
// readable. No intro overlay here - it belongs to arriving at the site, not
// to every dashboard navigation.

export default function DashboardLayout() {
  const token = localStorage.getItem("token");
  const { pathname } = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-layout me-app me-app-dashboard">

      <Navbar />
      <div className="dashboard-body">
        <Sidebar />
        <main key={pathname} className="dashboard-content me-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
