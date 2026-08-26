import { useCallback, useEffect, useState } from "react";
import { fetchEmployees, inviteEmployee, resendEmployeeInvitation, revokeEmployeeInvitation, updateEmployeeStatus } from "../lib/api";

export function Employees() {
  const [data, setData] = useState({ employees: [], invitations: [] });
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ busy: false, error: "", message: "" });
  const load = useCallback(() => fetchEmployees().then(setData).catch((error) => setStatus({ busy: false, error: error.message, message: "" })), []);
  useEffect(() => { load(); }, [load]);
  const run = async (action, message) => {
    setStatus({ busy: true, error: "", message: "" });
    try { await action(); await load(); setStatus({ busy: false, error: "", message }); return true; } catch (error) { setStatus({ busy: false, error: error.message, message: "" }); return false; }
  };
  return <section className="configuration-page access-page">
    <div className="configuration-page__heading"><div><p className="eyebrow">Team access</p><h2>Employees</h2><p>Send a secure one-time invitation. The employee chooses their own password and receives Home and session access only.</p></div></div>
    <form className="inline-access-form" onSubmit={async (event) => { event.preventDefault(); const sent = await run(() => inviteEmployee(email), "Invitation sent"); if (sent) setEmail(""); }}>
      <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="employee@example.com" aria-label="Employee email" />
      <button className="button button--primary" disabled={status.busy}>Send invitation</button>
    </form>
    {status.error && <p className="auth-feedback auth-feedback--error">{status.error}</p>}{status.message && <p className="auth-feedback">{status.message}</p>}
    <div className="access-list"><h3>Active team</h3>{data.employees.length === 0 ? <p>No employees yet.</p> : data.employees.map((item) => <article key={item.userId}><div><strong>{item.fullName || item.email}</strong><span>{item.email} · {item.status}</span></div><div>{item.status === "active" ? <button onClick={() => run(() => updateEmployeeStatus(item.userId, "disable"), "Employee disabled")}>Disable</button> : <button onClick={() => run(() => updateEmployeeStatus(item.userId, "reactivate"), "Employee reactivated")}>Reactivate</button>}<button className="danger-link" onClick={() => run(() => updateEmployeeStatus(item.userId, "remove"), "Employee removed")}>Remove</button></div></article>)}</div>
    <div className="access-list"><h3>Invitations</h3>{data.invitations.filter((item) => item.status === "pending").length === 0 ? <p>No pending invitations.</p> : data.invitations.filter((item) => item.status === "pending").map((item) => <article key={item.id}><div><strong>{item.email}</strong><span>Expires {new Date(item.expires_at).toLocaleString()}</span></div><div><button onClick={() => run(() => resendEmployeeInvitation(item.id), "Invitation resent")}>Resend</button><button className="danger-link" onClick={() => run(() => revokeEmployeeInvitation(item.id), "Invitation revoked")}>Revoke</button></div></article>)}</div>
  </section>;
}
