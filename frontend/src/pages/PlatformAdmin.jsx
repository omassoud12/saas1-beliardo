import { useCallback, useEffect, useState } from "react";
import { fetchPlatformUsers, removePlatformUser, updateOwnerStatus, updatePlatformUserStatus } from "../lib/api";

export function PlatformAdmin({ onSignOut }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => fetchPlatformUsers().then(setUsers).catch((value) => setError(value.message)), []);
  useEffect(() => { load(); }, [load]);
  const run = async (id, operation) => { setBusy(id); setError(""); try { await operation(); await load(); } catch (value) { setError(value.message); } finally { setBusy(""); } };
  return <main className="platform-shell"><header className="platform-header"><div><p className="eyebrow">Platform administration</p><h1>Tenant and user access</h1></div><button className="sign-out-button" onClick={onSignOut}>Sign out</button></header>{error && <p className="auth-feedback auth-feedback--error">{error}</p>}<section className="access-list platform-list">{users.length === 0 ? <p>No managed accounts found.</p> : users.map((user) => <article key={user.id}><div><strong>{user.business?.name || user.fullName || user.email}</strong><span>{user.email} · {user.accountType} · {user.status} · {user.business?.status || "no tenant"}</span></div><div>{user.accountType === "owner" && user.status === "pending_approval" && <><button disabled={busy === user.id} onClick={() => run(user.id, () => updateOwnerStatus(user.id, "approve"))}>Approve</button><button disabled={busy === user.id} onClick={() => run(user.id, () => updateOwnerStatus(user.id, "reject"))}>Reject</button></>}{user.status === "approved" && <button disabled={busy === user.id} onClick={() => run(user.id, () => updatePlatformUserStatus(user.id, "suspend"))}>Suspend</button>}{["suspended", "rejected"].includes(user.status) && <button disabled={busy === user.id} onClick={() => run(user.id, () => updatePlatformUserStatus(user.id, "reactivate"))}>Reactivate</button>}<button className="danger-link" disabled={busy === user.id} onClick={() => window.confirm("Remove this user and revoke access?") && run(user.id, () => removePlatformUser(user.id))}>Remove</button></div></article>)}</section></main>;
}
