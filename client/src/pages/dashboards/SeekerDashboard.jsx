
import DashboardPlaceholder from "./DashboardPlaceholder";

export default function SeekerDashboard() {
  return (
    <DashboardPlaceholder
      role="Seeker"
      greeting="Welcome back. How are you feeling today?"
      plannedFeatures={[
        "Log your daily mood",
        "Talk to a peer volunteer",
        "Book a session with a psychologist",
        "Join a support group",
      ]}
    />
  );
}