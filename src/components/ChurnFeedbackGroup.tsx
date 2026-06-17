import { ChurnedSection } from "./ChurnedSection";
import { FeedbackSection } from "./FeedbackSection";

export function ChurnFeedbackGroup() {
  return (
    <>
      <ChurnedSection />
      <div className="divider" style={{ marginTop: 24 }}>
        <span className="kicker">Feedback de usuarios</span>
        <span className="alt">/ desde Slack · #feedback_de_usuarios</span>
        <span className="rule" />
      </div>
      <FeedbackSection />
    </>
  );
}
