import { requireUser } from "@/lib/auth";

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <div className="stack">
      <section className="card stack">
        <h1>Account settings</h1>
        <div className="row">
          <span className="muted">Email</span>
          <span>{user.email}</span>
        </div>
        <div className="row">
          <span className="muted">User ID</span>
          <span>{user.id}</span>
        </div>
      </section>
    </div>
  );
}
