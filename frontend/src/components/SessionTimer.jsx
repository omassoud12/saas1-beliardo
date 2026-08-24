import { formatDuration } from "../utils/session";

export function SessionTimer({ seconds }) {
  const [hours, minutes, secs] = formatDuration(seconds).split(":");

  return (
    <div className="session-timer" aria-label={`Session time ${hours} hours, ${minutes} minutes, ${secs} seconds`}>
      <span>{hours}</span>
      <i aria-hidden="true">:</i>
      <span>{minutes}</span>
      <i aria-hidden="true">:</i>
      <span>{secs}</span>
    </div>
  );
}
