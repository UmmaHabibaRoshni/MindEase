import { Link, NavLink, useNavigate } from "react-router-dom";
import "./Navbar.css";

function getStoredUser() {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export default function Navbar() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    isActive ? "navbar-link active" : "navbar-link";

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        🌿 MindEase
      </Link>

      <div className="navbar-links">
        <NavLink to="/" end className={linkClass}>
          Home
        </NavLink>
        <NavLink to="/about" className={linkClass}>
          About
        </NavLink>

        {user ? (
          <>
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            <span className="navbar-user">Hi, {user.name}</span>
            <button onClick={handleLogout} className="navbar-btn">
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={linkClass}>
              Login
            </NavLink>
            <Link to="/register" className="navbar-btn">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}