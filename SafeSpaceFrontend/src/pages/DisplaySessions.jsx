import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";

const API = "https://safespaceadminbackend.onrender.com/api";

function fmt(n) {
  return "Rs " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function StatusBadge({ status }) {
  const map = {
    Pending:   "badge--pending",
    Done:      "badge--done",
    Cancelled: "badge--cancelled",
    Refunded:  "badge--refunded",
  };
  return <span className={`badge ${map[status] || ""}`}>{status}</span>;
}

function PayBadge({ status }) {
  if (status === "Payment Received") return <span className="badge badge--paid">Paid</span>;
  if (status === "Payment Pending")  return <span className="badge badge--pending">Pending</span>;
  return <span className="badge badge--nopay">No Payment</span>;
}

function getRowStyle(s) {
  if (s.status !== "Done") return { borderLeft: "3px solid transparent" };

  // Stage 3 — Done + Paid + Share Received → Green
  if (s.paymentReceived && s.didIReceiveMyShare) {
    return {
      background: "rgba(74, 222, 128, 0.08)",
      borderLeft: "3px solid rgba(74, 222, 128, 0.55)",
    };
  }
  // Stage 2 — Done + Paid (share still pending) → Yellow
  if (s.paymentReceived && !s.didIReceiveMyShare) {
    return {
      background: "rgba(250, 204, 21, 0.08)",
      borderLeft: "3px solid rgba(250, 204, 21, 0.55)",
    };
  }
  // Stage 1 — Done but not paid → Red
  return {
    background: "rgba(248, 113, 113, 0.08)",
    borderLeft: "3px solid rgba(248, 113, 113, 0.55)",
  };
}

export default function DisplaySessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("");
  const [selectedSessionType, setSelectedSessionType] = useState("");

  useEffect(() => {
    axios.get(`${API}/sessions`)
      .then((r) => { setSessions(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Get unique values for filter dropdowns
  const uniqueClients = useMemo(() => {
    const clients = sessions
      .map(s => ({ id: s.clientId?._id, name: s.clientId?.name }))
      .filter(c => c.id && c.name);
    return [...new Map(clients.map(c => [c.id, c])).values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const uniqueTherapists = useMemo(() => {
    const therapists = sessions
      .map(s => ({ id: s.therapistId?._id, name: s.therapistId?.name }))
      .filter(t => t.id && t.name);
    return [...new Map(therapists.map(t => [t.id, t])).values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // Search filter (by session number or client name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSessionNo = s.sessionNo?.toString().includes(query);
        const matchesClient = s.clientId?.name?.toLowerCase().includes(query);
        if (!matchesSessionNo && !matchesClient) return false;
      }

      // Month filter
      if (selectedMonth) {
        const [year, month] = selectedMonth.split("-");
        const sessionDate = new Date(s.sessionDate);
        if (sessionDate.getFullYear() !== parseInt(year) || 
            sessionDate.getMonth() + 1 !== parseInt(month)) {
          return false;
        }
      }

      // Client filter
      if (selectedClient && s.clientId?._id !== selectedClient) return false;

      // Therapist filter
      if (selectedTherapist && s.therapistId?._id !== selectedTherapist) return false;

      // Status filter
      if (selectedStatus && s.status !== selectedStatus) return false;

      // Payment status filter
      if (selectedPaymentStatus) {
        if (selectedPaymentStatus === "paid" && !s.paymentReceived) return false;
        if (selectedPaymentStatus === "pending" && s.paymentReceived) return false;
      }

      // Session type filter
      if (selectedSessionType && s.sessionType !== selectedSessionType) return false;

      return true;
    });
  }, [sessions, searchQuery, selectedMonth, selectedClient, selectedTherapist, selectedStatus, selectedPaymentStatus, selectedSessionType]);

  // Get date range for month dropdown
  const dateRange = useMemo(() => {
    if (sessions.length === 0) return [];
    const dates = sessions.map(s => new Date(s.sessionDate));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    const months = [];
    for (let d = new Date(minDate); d <= maxDate; d.setMonth(d.getMonth() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      months.push({ value: `${year}-${month}`, label: d.toLocaleDateString("en-PK", { month: "long", year: "numeric" }) });
    }
    return months.reverse();
  }, [sessions]);

  const patch = async (id, body) => {
    const res = await axios.put(`${API}/sessions/${id}`, body);
    setSessions((prev) => prev.map((s) => s._id === id ? { ...s, ...res.data.data } : s));
  };

  const updateStatus = (id, status) => patch(id, { status }).catch(() => alert("Update failed."));

  const togglePayment = (session) => {
    patch(session._id, { paymentReceived: !session.paymentReceived }).catch(() => alert("Update failed."));
  };

  const toggleShare = (session) => {
    patch(session._id, { didIReceiveMyShare: !session.didIReceiveMyShare }).catch(() => alert("Update failed."));
  };

  const deleteSession = async (id) => {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s._id !== id));
    } catch {
      alert("Failed to delete session.");
    }
  };

  const hasActiveFilters = searchQuery || selectedMonth || selectedClient || selectedTherapist || selectedStatus || selectedPaymentStatus || selectedSessionType;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMonth("");
    setSelectedClient("");
    setSelectedTherapist("");
    setSelectedStatus("");
    setSelectedPaymentStatus("");
    setSelectedSessionType("");
  };

  // Calculate filtered totals
  const filteredStats = useMemo(() => {
    return filteredSessions.reduce((acc, s) => {
      return {
        totalRevenue: acc.totalRevenue + (s.charges || 0),
        totalMyShare: acc.totalMyShare + (s.myShareAmount || 0),
        totalSessions: acc.totalSessions + 1,
        completedSessions: acc.completedSessions + (s.status === "Done" ? 1 : 0),
        paidSessions: acc.paidSessions + (s.paymentReceived ? 1 : 0),
      };
    }, { totalRevenue: 0, totalMyShare: 0, totalSessions: 0, completedSessions: 0, paidSessions: 0 });
  }, [filteredSessions]);

  return (
    <AdminLayout title="Sessions">
      <div className="page-header">
        <div className="page-header__text">
          <h2 className="page-header__title">Sessions</h2>
          <p className="page-header__sub">
            {filteredSessions.length} of {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate("/addsession")}>
          + Add Session
        </button>
      </div>

      {/* Filtered Statistics Summary */}
      {filteredSessions.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 20
        }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 197, 253, 0.1))",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "8px",
            padding: "14px 16px"
          }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              💰 Total Revenue
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              Rs {fmt(filteredStats.totalRevenue)}
            </div>
          </div>

          <div style={{
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(134, 239, 172, 0.1))",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "8px",
            padding: "14px 16px"
          }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              🏦 My Share
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#22c55e" }}>
              Rs {fmt(filteredStats.totalMyShare)}
            </div>
          </div>

          <div style={{
            background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(196, 181, 253, 0.1))",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: "8px",
            padding: "14px 16px"
          }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              📅 Total Sessions
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {filteredStats.totalSessions}
            </div>
          </div>

          <div style={{
            background: "linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(125, 211, 252, 0.1))",
            border: "1px solid rgba(14, 165, 233, 0.3)",
            borderRadius: "8px",
            padding: "14px 16px"
          }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              ✅ Completed
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {filteredStats.completedSessions}
            </div>
          </div>

          <div style={{
            background: "linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(249, 168, 212, 0.1))",
            border: "1px solid rgba(236, 72, 153, 0.3)",
            borderRadius: "8px",
            padding: "14px 16px"
          }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              ✓ Paid Sessions
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {filteredStats.paidSessions}
            </div>
          </div>
        </div>
      )}

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              🔍 Filters
            </h3>
            {hasActiveFilters && (
              <button 
                className="btn btn--ghost btn--sm" 
                onClick={clearFilters}
                style={{ fontSize: "12px", padding: "4px 12px" }}
              >
                ✕ Clear all
              </button>
            )}
          </div>

          {/* Filter Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12
          }}>
            {/* Search */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Search
              </label>
              <input
                type="text"
                placeholder="Session # or Client name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                  background: "var(--bg-primary)"
                }}
              />
            </div>

            {/* Month */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                  background: "var(--bg-primary)",
                  cursor: "pointer"
                }}
              >
                <option value="">All Months</option>
                {dateRange.map(date => (
                  <option key={date.value} value={date.value}>{date.label}</option>
                ))}
              </select>
            </div>

            {/* Client */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Client
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                  background: "var(--bg-primary)",
                  cursor: "pointer"
                }}
              >
                <option value="">All Clients</option>
                {uniqueClients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            {/* Therapist */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Therapist
              </label>
              <select
                value={selectedTherapist}
                onChange={(e) => setSelectedTherapist(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                  background: "var(--bg-primary)",
                  cursor: "pointer"
                }}
              >
                <option value="">All Therapists</option>
                {uniqueTherapists.map(therapist => (
                  <option key={therapist.id} value={therapist.id}>{therapist.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                  background: "var(--bg-primary)",
                  cursor: "pointer"
                }}
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Done">Done</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Payment
              </label>
              <select
                value={selectedPaymentStatus}
                onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                  background: "var(--bg-primary)",
                  cursor: "pointer"
                }}
              >
                <option value="">All Payment Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Session Type */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
                Session Type
              </label>
              <select
                value={selectedSessionType}
                onChange={(e) => setSelectedSessionType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--text-primary)",
                  background: "var(--bg-primary)",
                  cursor: "pointer"
                }}
              >
                <option value="">All Types</option>
                <option value="Online">🖥 Online</option>
                <option value="Physical">🏥 Physical</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Table Card */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : filteredSessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__title">
              {hasActiveFilters ? "No sessions match your filters" : "No sessions yet"}
            </div>
            <p className="empty-state__text">
              {hasActiveFilters 
                ? "Try adjusting your filters or clear them to see more sessions."
                : "Schedule the first therapy session to get started."
              }
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
              {hasActiveFilters && (
                <button className="btn btn--ghost" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
              <button className="btn btn--primary" onClick={() => navigate("/addsession")}>
                + Add Session
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client</th>
                  <th>Therapist</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Charges</th>
                  <th>Session Pay</th>
                  <th>My Share</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Share</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => (
                  <tr key={s._id} style={getRowStyle(s)}>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                      #{s.sessionNo}
                    </td>
                    <td style={{ fontWeight: 500 }}>{s.clientId?.name || "—"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{s.therapistId?.name || "—"}</td>
                    <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {new Date(s.sessionDate).toLocaleDateString("en-PK", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                      <div style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>{s.sessionTime}</div>
                    </td>
                    <td>
                      <span className={`badge ${s.sessionType === "Online" ? "badge--paid" : "badge--nopay"}`}>
                        {s.sessionType === "Online" ? "🖥 Online" : "🏥 Physical"}
                      </span>
                    </td>
                    <td>{fmt(s.charges)}</td>
                    <td style={{ fontWeight: 600 }}>{s.status === "Done" ? fmt(s.sessionPayment) : <span style={{ opacity: .4 }}>—</span>}</td>
                    <td style={{ color: "var(--mint-400)", fontWeight: 600 }}>
                      {s.status === "Done" ? fmt(s.myShareAmount) : <span style={{ opacity: .4 }}>—</span>}
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td><PayBadge status={s.paymentStatus} /></td>
                    <td>
                      {s.didIReceiveMyShare
                        ? <span className="badge badge--done">✓ Received</span>
                        : <span className="badge badge--nopay">Pending</span>
                      }
                    </td>
                    <td>
                      <div className="btn-row" style={{ flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        {/* Status controls */}
                        {s.status === "Pending" && (
                          <button className="btn btn--ghost btn--sm" onClick={() => updateStatus(s._id, "Done")}>
                            ✓ Done
                          </button>
                        )}
                        {s.status !== "Cancelled" && s.status !== "Done" && (
                          <button className="btn btn--sm" style={{ border: "1.5px solid #fca5a5", color: "#991b1b", background: "transparent" }} onClick={() => updateStatus(s._id, "Cancelled")}>
                            ✕ Cancel
                          </button>
                        )}

                        {/* Payment toggle */}
                        {s.status === "Done" && (
                          <button
                            className={`btn btn--sm ${s.paymentReceived ? "btn--danger" : "btn--ghost"}`}
                            onClick={() => togglePayment(s)}
                          >
                            {s.paymentReceived ? "💰 Unmark Pay" : "💰 Mark Paid"}
                          </button>
                        )}

                        {/* Share toggle */}
                        {s.status === "Done" && s.paymentReceived && (
                          <button
                            className={`btn btn--sm ${s.didIReceiveMyShare ? "btn--danger" : "btn--ghost"}`}
                            onClick={() => toggleShare(s)}
                          >
                            {s.didIReceiveMyShare ? "🏦 Unmark Share" : "🏦 Mark Share"}
                          </button>
                        )}

                        <div className="btn-row" style={{ gap: 6 }}>
                          <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/editsession/${s._id}`)}>
                            ✏️
                          </button>
                          <button className="btn btn--danger btn--sm" onClick={() => deleteSession(s._id)}>
                            🗑
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}