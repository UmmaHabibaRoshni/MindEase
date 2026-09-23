import { NavLink } from "react-router-dom";

const linksByRole = {
  user: [
    { to: "/dashboard/mood", label: "Mood Tracker" },
    { to: "/dashboard/journal", label: "Journal" },
    { to: "/dashboard/sessions", label: "Book a Session" },
  ],
  counselor: [
    { to: "/dashboard/appointments", label: "My Appointments" },
    { to: "/dashboard/clients", label: "My Clients" },
  ],
  admin: [
    { to: "/dashboard/users", label: "Manage Users" },
    { to: "/dashboard/reports", label: "Reports" },
  ],
};

function getStoredUser() {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export default function Sidebar() {
  const user = getStoredUser();
  const role = user?.role || "user";

  const links = [
    { to: "/dashboard", label: "Overview", end: true },
    ...(linksByRole[role] || []),
    { to: "/dashboard/profile", label: "Profile" },
  ];

  return (
    <aside className="sidebar">
      <p className="sidebar-title">{role} menu</p>
      <nav>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}