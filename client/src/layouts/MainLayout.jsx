import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import "../styles/experience.css";
import "../styles/tw-compat.css";
import "../styles/theme.css";

// Public shell: the full experience layer.
//
// `me-app` turns on the site-wide float and pointer behaviour; `me-public`
// adds the treatments that only suit the marketing pages (the bigger ambient,
// the hero spacing).

export default function MainLayout() {
  const { pathname } = useLocation();

  return (
    <div className="main-layout me-app me-public">

      <Navbar />
      {/* keyed on the path so the entrance animation replays on every
          navigation rather than only on first mount */}
      <main key={pathname} className="main-content me-page">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
