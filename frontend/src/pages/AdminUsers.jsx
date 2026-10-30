// =============================================================
// frontend/src/pages/AdminUsers.jsx  —  the "Users" tab  (owner: Euden, stretch)
// =============================================================
// Lists every account and lets an admin change a role. This is also the way
// to create more admins: someone registers normally, then an admin promotes them.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../utils/api';

const ROLES = ['student', 'faculty', 'outsider', 'admin'];

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState(null);

  function load() {
    apiCall('/admin/users')
      .then(setUsers)
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  }
  useEffect(load, []);

  async function changeRole(id, role) {
    try {
      await apiCall(`/admin/users/${id}/role`, 'PATCH', { role });
      setMessage({ type: 'success', text: 'Role updated.' });
      load();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  }

  async function toggleSuspend(u) {
    const suspending = u.is_active !== false;
    const ok = window.confirm(suspending
      ? `Suspend ${u.full_name}? They will not be able to sign in or book until reactivated.`
      : `Reactivate ${u.full_name}?`);
    if (!ok) return;
    try {
      await apiCall(`/admin/users/${u.id}`, 'PATCH', { is_active: !suspending });
      setMessage({ type: 'success', text: suspending ? 'Account suspended.' : 'Account reactivated.' });
      load();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  }

  const q = search.trim().toLowerCase();
  const shown = users.filter((u) => !q || `${u.full_name} ${u.email} ${u.student_staff_id || ''}`.toLowerCase().includes(q));

  return (
    <>
      {message && <div className={message.type === 'error' ? 'error' : 'success-box'}>{message.text}</div>}
      <div className="filter-row">
        <input placeholder="Search name, email or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <table className="availability-table">
        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Student / Staff ID</th><th>Phone</th><th>Joined</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          {shown.map((u) => (
            <tr key={u.id} className={u.is_active === false ? 'usr-row-suspended' : undefined}>
              <td>{u.id}</td>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td>{u.student_staff_id || '—'}</td>
              <td>{u.contact_number || '—'}</td>
              <td>{u.joined}</td>
              <td>
                <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td className="usr-actions">
                <Link to={`/admin/users/${u.id}`} className="usr-edit-btn">Edit</Link>
                <button
                  type="button"
                  className={u.is_active === false ? 'usr-activate-btn' : 'usr-suspend-btn'}
                  onClick={() => toggleSuspend(u)}
                >
                  {u.is_active === false ? 'Activate' : 'Suspend'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p>No users found.</p>}
    </>
  );
}

export default AdminUsers;