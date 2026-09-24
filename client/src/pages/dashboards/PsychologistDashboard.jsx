
import DashboardPlaceholder from "./DashboardPlaceholder";

export default function PsychologistDashboard() {
  return (
    <DashboardPlaceholder
      role="Psychologist"
      greeting="Your sessions and clients, in one place."
      note="Your account must be approved by an admin before seekers can book sessions with you."
      plannedFeatures={[
        "View upcoming sessions",
        "Manage your appointment slots",
        "Review escalated cases from volunteers",
        "Keep private session notes",
      ]}
    />
  );
}