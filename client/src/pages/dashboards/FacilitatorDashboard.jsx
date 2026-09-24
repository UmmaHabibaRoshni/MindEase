
import DashboardPlaceholder from "./DashboardPlaceholder";

export default function FacilitatorDashboard() {
  return (
    <DashboardPlaceholder
      role="Facilitator"
      greeting="Plan and run your support groups."
      note="Your account must be approved by an admin before you can host groups."
      plannedFeatures={[
        "Create a support group",
        "Schedule group sessions",
        "Manage group members",
      ]}
    />
  );
}