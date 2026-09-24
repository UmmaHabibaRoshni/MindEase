
import DashboardPlaceholder from "./DashboardPlaceholder";

export default function VolunteerDashboard() {
  return (
    <DashboardPlaceholder
      role="Volunteer"
      greeting="Thanks for being here for others."
      note="Your account must be approved by an admin before you can accept support requests."
      plannedFeatures={[
        "See open support requests",
        "Chat with seekers you're supporting",
        "Set your availability",
        "Escalate a conversation to a psychologist",
      ]}
    />
  );
}