
import DashboardPlaceholder from "./DashboardPlaceholder";

export default function NgoDashboard() {
  return (
    <DashboardPlaceholder
      role="NGO"
      greeting="Reach the people who need your programs."
      note="Your organization must be approved by an admin before your programs go live."
      plannedFeatures={[
        "Publish awareness programs and events",
        "Share mental health resources",
        "See how many people your programs reached",
      ]}
    />
  );
}