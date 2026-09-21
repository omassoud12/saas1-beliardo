export function handleTabListKeyDown(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')].filter((tab) => !tab.disabled);
  const current = tabs.indexOf(event.target);
  if (current < 0 || !tabs.length) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
      : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
