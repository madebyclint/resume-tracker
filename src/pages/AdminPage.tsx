import { useState, useEffect, useCallback } from 'react';
import {
  AdminUser,
  AuthUser,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getToken,
} from '../utils/authService';
import { useAppState } from '../state/AppStateContext';
import './AdminPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface AnalyticsSummary {
  days: number;
  totalEvents: number;
  uniqueUsers: number;
  topFeatures: { name: string; count: number }[];
  pageViews: { page: string; count: number }[];
  errors: { name: string; count: number }[];
  userSummary: { userId: string; email: string; name: string; sessionCount: number; eventCount: number; lastSeen: string }[];
  eventsByDay: { date: string; count: number }[];
}

interface AdminPageProps {
  currentUser: AuthUser;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

const emptyForm = (): UserFormState => ({
  name: '',
  email: '',
  password: '',
  isAdmin: false,
});

export default function AdminPage({ currentUser }: AdminPageProps) {
  const { devMode, setDevMode } = useAppState();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadError, setLoadError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Analytics state
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const loadAnalytics = useCallback(async (days: number) => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/analytics/admin/summary?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAnalyticsSummary(data);
    } catch (e) {
      setAnalyticsError('Failed to load analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadError('');
    try {
      const result = await listUsers();
      setUsers(result);
    } catch {
      setLoadError('Failed to load users.');
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadAnalytics(analyticsDays);
  }, [loadAnalytics, analyticsDays]);

  function openAdd() {
    setForm(emptyForm());
    setFormError('');
    setEditingUser(null);
    setShowAddModal(true);
  }

  function openEdit(user: AdminUser) {
    setForm({ name: user.name, email: user.email, password: '', isAdmin: user.isAdmin });
    setFormError('');
    setEditingUser(user);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditingUser(null);
    setForm(emptyForm());
    setFormError('');
    setShowPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    if (editingUser) {
      const updates: Parameters<typeof updateUser>[1] = {};
      if (form.name !== editingUser.name) updates.name = form.name;
      if (form.email !== editingUser.email) updates.email = form.email;
      if (form.isAdmin !== editingUser.isAdmin) updates.isAdmin = form.isAdmin;
      if (form.password) updates.password = form.password;

      const result = await updateUser(editingUser.id, updates);
      setFormLoading(false);
      if (!result.success) {
        setFormError(result.error || 'Update failed');
        return;
      }
    } else {
      const result = await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        isAdmin: form.isAdmin,
      });
      setFormLoading(false);
      if (!result.success) {
        setFormError(result.error || 'Create failed');
        return;
      }
    }

    closeModal();
    loadUsers();
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleteError('');
    const result = await deleteUser(deleteConfirm.id);
    if (!result.success) {
      setDeleteError(result.error || 'Delete failed');
      return;
    }
    setDeleteConfirm(null);
    loadUsers();
  }

  return (
    <div className="admin-page">
      <h1 className="admin-title">Admin Panel</h1>

      {/* Dev / Prod mode toggle */}
      <section className="admin-section">
        <h2 className="admin-section-title">Mode</h2>
        <div className="admin-mode-row">
          <label className={`admin-mode-toggle ${devMode ? 'dev' : 'prod'}`}>
            <input
              type="checkbox"
              checked={devMode}
              onChange={e => setDevMode(e.target.checked)}
            />
            <span className="admin-mode-label">
              {devMode ? '🧪 DEV mode — DB writes disabled' : '🔒 PROD mode — DB writes enabled'}
            </span>
          </label>
          {devMode && (
            <p className="admin-mode-warning">
              While DEV mode is on, no data is written to the database.
            </p>
          )}
        </div>
      </section>

      {/* User management */}
      <section className="admin-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">Users</h2>
          <button className="admin-btn admin-btn-primary" onClick={openAdd}>
            + Add User
          </button>
        </div>

        {loadError && <div className="admin-error">{loadError}</div>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={u.id === currentUser.id ? 'admin-row-self' : ''}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`admin-badge ${u.isAdmin ? 'admin-badge-admin' : 'admin-badge-user'}`}>
                      {u.isAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="admin-actions">
                    <button
                      className="admin-btn admin-btn-sm"
                      onClick={() => openEdit(u)}
                    >
                      Edit
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => { setDeleteError(''); setDeleteConfirm(u); }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loadError && (
                <tr>
                  <td colSpan={5} className="admin-empty">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit modal */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3 className="admin-modal-title">
              {editingUser ? `Edit ${editingUser.name}` : 'Add User'}
            </h3>
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-field">
                <label>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  disabled={formLoading}
                />
              </div>
              <div className="admin-field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  disabled={formLoading}
                />
              </div>
              <div className="admin-field">
                <label>{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <div className="admin-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required={!editingUser}
                    disabled={formLoading}
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    className="admin-peek-btn"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="admin-field admin-field-check">
                <label>
                  <input
                    type="checkbox"
                    checked={form.isAdmin}
                    onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
                    disabled={formLoading}
                  />
                  <span>Admin role</span>
                </label>
              </div>

              {formError && <div className="admin-error">{formError}</div>}

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn" onClick={closeModal} disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="admin-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="admin-modal admin-modal-sm" onClick={e => e.stopPropagation()}>
            <h3 className="admin-modal-title">Delete User</h3>
            <p className="admin-confirm-text">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?<br />
              This cannot be undone.
            </p>
            {deleteError && <div className="admin-error">{deleteError}</div>}
            <div className="admin-modal-actions">
              <button className="admin-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="admin-btn admin-btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Activity Analytics ─────────────────────────────────── */}
      <section className="admin-section analytics-section">
        <div className="admin-section-header">
          <h2 className="admin-section-title">User Activity</h2>
          <div className="analytics-days-selector">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                className={`admin-btn admin-btn-sm ${analyticsDays === d ? 'admin-btn-primary' : ''}`}
                onClick={() => setAnalyticsDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading && <p className="admin-empty">Loading analytics…</p>}
        {analyticsError && <div className="admin-error">{analyticsError}</div>}

        {analyticsSummary && !analyticsLoading && (
          <>
            {/* Summary cards */}
            <div className="analytics-cards">
              <div className="analytics-card">
                <div className="analytics-card-value">{analyticsSummary.totalEvents.toLocaleString()}</div>
                <div className="analytics-card-label">Total Events</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-card-value">{analyticsSummary.uniqueUsers}</div>
                <div className="analytics-card-label">Active Users</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-card-value">
                  {analyticsSummary.userSummary.reduce((s, u) => s + u.sessionCount, 0)}
                </div>
                <div className="analytics-card-label">Total Sessions</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-card-value">
                  {analyticsSummary.errors.reduce((s, e) => s + e.count, 0)}
                </div>
                <div className="analytics-card-label">Errors</div>
              </div>
            </div>

            <div className="analytics-columns">
              {/* Feature usage */}
              {analyticsSummary.topFeatures.length > 0 && (
                <div className="analytics-column">
                  <h3 className="analytics-col-title">Feature Usage</h3>
                  <table className="admin-table">
                    <thead><tr><th>Feature</th><th>Count</th><th style={{ width: '120px' }}></th></tr></thead>
                    <tbody>
                      {analyticsSummary.topFeatures.map(f => {
                        const max = analyticsSummary.topFeatures[0]?.count || 1;
                        return (
                          <tr key={f.name}>
                            <td>{f.name.replace(/_/g, ' ')}</td>
                            <td>{f.count}</td>
                            <td>
                              <div className="analytics-bar-track">
                                <div className="analytics-bar" style={{ width: `${(f.count / max) * 100}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Page views */}
              {analyticsSummary.pageViews.length > 0 && (
                <div className="analytics-column">
                  <h3 className="analytics-col-title">Page Views</h3>
                  <table className="admin-table">
                    <thead><tr><th>Page</th><th>Views</th></tr></thead>
                    <tbody>
                      {analyticsSummary.pageViews.map(p => (
                        <tr key={p.page}>
                          <td>{p.page}</td>
                          <td>{p.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {analyticsSummary.errors.length > 0 && (
                    <>
                      <h3 className="analytics-col-title" style={{ marginTop: '1.5rem' }}>Errors</h3>
                      <table className="admin-table">
                        <thead><tr><th>Error</th><th>Count</th></tr></thead>
                        <tbody>
                          {analyticsSummary.errors.map(e => (
                            <tr key={e.name}>
                              <td>{e.name.replace(/_/g, ' ')}</td>
                              <td>{e.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Per-user breakdown */}
            {analyticsSummary.userSummary.length > 0 && (
              <>
                <h3 className="analytics-col-title" style={{ marginTop: '1.5rem' }}>User Breakdown</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Sessions</th>
                        <th>Events</th>
                        <th>Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsSummary.userSummary.map(u => (
                        <tr key={u.userId}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td>{u.sessionCount}</td>
                          <td>{u.eventCount}</td>
                          <td>{new Date(u.lastSeen).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {analyticsSummary.totalEvents === 0 && (
              <p className="admin-empty">No events recorded in the last {analyticsDays} days yet.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
