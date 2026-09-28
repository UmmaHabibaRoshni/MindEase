
import DashboardPlaceholder from "../../components/common/DashboardPlaceholder";

export default function AdminDashboard() {
  return (
    <DashboardPlaceholder
      role="Admin"
      greeting="Keep MindEase safe and running."
      plannedFeatures={[
        "Approve or reject pending accounts",
        "Manage all users and roles",
        "Review reported content",
        "View platform activity",
      ]}
    />
  );
}
