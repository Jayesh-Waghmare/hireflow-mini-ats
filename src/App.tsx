import { useEffect, useState, FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Toaster, toast } from "sonner";
import { CandidateTable } from "./CandidateTable";
import {
  Users,
  LayoutDashboard,
  Columns,
  Search,
  Plus,
  Briefcase,
  Check,
  ChevronRight,
  Download,
  X,
  Trash2,
  Menu,
  Loader2,
  SlidersHorizontal,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Candidate, stages, summarize, filterCandidates } from "../lib/model";
const blank = {
  name: "",
  email: "",
  role: "Frontend Developer",
  stage: "Applied",
  location: "",
  skills: "",
  experience: 0,
  notes: "",
  source: "EarlyJobs",
};
const sample = [
  [
    "Aarav Sharma",
    "aarav@example.com",
    "Frontend Developer",
    "Interview",
    "Bengaluru",
    "React, TypeScript",
    "LinkedIn",
    3,
  ],
  [
    "Priya Patel",
    "priya@example.com",
    "Product Designer",
    "Screening",
    "Mumbai",
    "Figma, UX research",
    "Referral",
    2,
  ],
  [
    "Rohan Mehta",
    "rohan@example.com",
    "Backend Developer",
    "Applied",
    "Pune",
    "Node.js, PostgreSQL",
    "EarlyJobs",
    1,
  ],
  [
    "Ananya Rao",
    "ananya@example.com",
    "Frontend Developer",
    "Offer",
    "Hyderabad",
    "React, CSS",
    "Careers page",
    4,
  ],
  [
    "Kabir Singh",
    "kabir@example.com",
    "Backend Developer",
    "Hired",
    "Delhi",
    "Python, APIs",
    "Referral",
    3,
  ],
  [
    "Ishita Shah",
    "ishita@example.com",
    "Product Designer",
    "Interview",
    "Remote",
    "Figma, Prototyping",
    "LinkedIn",
    2,
  ],
  [
    "Dev Joshi",
    "dev@example.com",
    "Frontend Developer",
    "Screening",
    "Pune",
    "JavaScript, React",
    "EarlyJobs",
    1,
  ],
  [
    "Meera Iyer",
    "meera@example.com",
    "Backend Developer",
    "Rejected",
    "Chennai",
    "Java, SQL",
    "Careers page",
    2,
  ],
  [
    "Arjun Verma",
    "arjun@example.com",
    "Product Designer",
    "Applied",
    "Bengaluru",
    "UI design, Figma",
    "EarlyJobs",
    0,
  ],
] as const;
const initials = (n: string) =>
  n
    .split(" ")
    .map((v) => v[0])
    .slice(0, 2)
    .join("");
const setToast = (message: string) => toast.success(message);
export default function App() {
  const [items, setItems] = useState<Candidate[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [view, setView] = useState("Overview"),
    [query, setQuery] = useState(""),
    [stage, setStage] = useState(""),
    [role, setRole] = useState("");
  const [error, setError] = useState(""),
    [edit, setEdit] = useState<any>(null),
    [selected, setSelected] = useState<Candidate | null>(null),
    [confirmDelete, setConfirmDelete] = useState(false),
    [mobile, setMobile] = useState(false);
  async function refresh() {
    const r = await fetch("/api/candidates");
    const d: any = await r.json();
    if (!r.ok) throw Error(d.error);
    setItems(
      d.sort((a: Candidate, b: Candidate) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    );
    return d;
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function request(data: any) {
    const r = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const d: any = await r.json();
    if (!r.ok) throw Error(d.error);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(edit);
      await refresh();
      setEdit(null);
      setSelected(null);
      setToast("Candidate saved successfully");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function move(c: Candidate, to: string) {
    if (c.stage === to) return;
    setBusy(true);
    setError("");
    try {
      await request({ ...c, stage: to });
      const d = await refresh();
      if (selected?.id === c.id)
        setSelected(d.find((v: Candidate) => v.id === c.id));
      setToast(`${c.name} moved to ${to}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/candidates?id=${selected.id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw Error(((await r.json()) as { error: string }).error);
      await refresh();
      setSelected(null);
      setConfirmDelete(false);
      setToast("Candidate deleted");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function seed() {
    setBusy(true);
    setError("");
    try {
      for (const [
        name,
        email,
        role,
        stage,
        location,
        skills,
        source,
        experience,
      ] of sample) {
        if (!items.some((c) => c.email === email))
          await request({
            name,
            email,
            role,
            stage,
            location,
            skills,
            source,
            experience,
            notes: "Sample candidate for exploring Hireflow.",
          });
      }
      await refresh();
      setToast("Sample workspace is ready");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const data = [
      [
        "Name",
        "Email",
        "Role",
        "Stage",
        "Location",
        "Skills",
        "Experience",
        "Source",
        "Applied",
      ],
      ...filtered.map((c) => [
        c.name,
        c.email,
        c.role,
        c.stage,
        c.location,
        c.skills,
        c.experience,
        c.source,
        c.createdAt,
      ]),
    ];
    const csv = data
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const u = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = "hireflow-candidates.csv";
    a.click();
    URL.revokeObjectURL(u);
    setToast("Candidate export downloaded");
  }
  const metrics = summarize(items),
    roles = [...new Set(items.map((c) => c.role))].sort(),
    filtered = filterCandidates(items, query, stage, role);
  const activities = items
    .flatMap((c) => {
      try {
        return JSON.parse(c.history).map((h: any) => ({
          ...h,
          name: c.name,
          id: c.id,
        }));
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);
  const activeStages = stages.filter((s) => s !== "Rejected");
  function nav(v: string) {
    setView(v);
    setMobile(false);
    setQuery("");
    setStage("");
    setRole("");
  }
  const table = (list: Candidate[], compact = false) => (
    <CandidateTable
      data={list}
      compact={compact}
      onSelect={(candidate) => {
        setSelected(candidate);
        setConfirmDelete(false);
      }}
      empty={
        <div className="empty">
          <Users size={30} />
          <h3>
            {items.length ? "No matching candidates" : "No candidates yet"}
          </h3>
          <p>
            {items.length
              ? "Try a different search or clear your filters."
              : "Add your first candidate or explore with sample data."}
          </p>
          {items.length ? (
            <button
              onClick={() => {
                setQuery("");
                setStage("");
                setRole("");
              }}
            >
              Clear filters
            </button>
          ) : (
            <button disabled={busy} onClick={seed}>
              Load sample candidates
            </button>
          )}
        </div>
      }
    />
  );
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a className="brand" href="/" aria-label="Hireflow home">
          <span className="brand-icon">
            <Columns size={19} />
          </span>
          hireflow
        </a>
        <div className="workspace">
          <span className="workspace-logo">H</span>
          <div>
            <strong>Personal workspace</strong>
            <small>Recruiting</small>
          </div>
        </div>
        <div className="nav-label">Recruiting</div>
        <nav>
          {[
            ["Overview", LayoutDashboard],
            ["Candidates", Users],
            ["Pipeline", Columns],
          ].map(([name, Icon]: any) => (
            <button
              key={name}
              className={view === name ? "nav-item active" : "nav-item"}
              aria-current={view === name ? "page" : undefined}
              onClick={() => nav(name)}
            >
              <Icon size={19} />
              {name}
              {name === "Candidates" && <span>{items.length}</span>}
            </button>
          ))}
        </nav>
        <div className="workspace-info">
          <strong>Demo workspace</strong>
          <p>Your records are private to this browser.</p>
        </div>
        <div className="profile">
          <span className="avatar color2">JW</span>
          <div>
            <strong>Jayesh Waghmare</strong>
            <small>Workspace owner</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-toggle icon-button"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} />
              <strong>{view}</strong>
            </span>
          </div>
          <div className="header-meta">
            <span className="date-note">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <span className="live-label">
              <span />
              {loading
                ? "Connecting…"
                : busy
                  ? "Saving…"
                  : error
                    ? "Needs attention"
                    : "Saved"}
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">RECRUITING WORKSPACE</span>
              <h1>
                {view === "Overview"
                  ? "Overview"
                  : view === "Candidates"
                    ? "Candidates"
                    : "Hiring pipeline"}
              </h1>
              <p>
                {view === "Overview"
                  ? "Candidate totals and recent hiring activity."
                  : view === "Candidates"
                    ? "Manage candidate details, notes and hiring stages."
                    : "Drag candidates between stages, or open a profile to update their status."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setError("");
                setEdit({ ...blank });
              }}
              disabled={loading || busy}
            >
              <Plus size={17} />
              Add candidate
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">
              <Loader2 className="spin" />
              Loading your workspace…
            </div>
          ) : (
            <>
              {view === "Overview" && (
                <section className="workspace-brief">
                  <div>
                    <span className="brief-mark">
                      <Briefcase size={20} />
                    </span>
                    <div>
                      <h2>Your hiring, at a glance.</h2>
                      <p>
                        {items.length
                          ? `${metrics.active} active candidates across ${roles.length} positions. ${metrics.interviews} currently in the interview stage.`
                          : "A clear view of every candidate, from first application to the final offer."}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setView("Candidates");
                      setStage("Interview");
                    }}
                    disabled={!metrics.interviews}
                  >
                    Review interviews <ChevronRight size={16} />
                  </button>
                </section>
              )}
              {view === "Overview" && (
                <div className="stats">
                  {[
                    [
                      Users,
                      "Total candidates",
                      metrics.total,
                      "Across all positions",
                      "purple",
                    ],
                    [
                      Briefcase,
                      "Active in pipeline",
                      metrics.active,
                      "Applied through Offer",
                      "blue",
                    ],
                    [
                      Columns,
                      "In interviews",
                      metrics.interviews,
                      "Currently in Interview stage",
                      "amber",
                    ],
                    [
                      CheckCircle2,
                      "Hired",
                      metrics.hired,
                      "Completed hires",
                      "green",
                    ],
                  ].map(([Icon, label, value, sub, color]: any) => (
                    <article className="stat" key={label}>
                      <div className="stat-top">
                        <span>{label}</span>
                        <span className={"stat-icon " + color}>
                          <Icon size={18} />
                        </span>
                      </div>
                      <div className="stat-number">{value}</div>
                      <small>{sub}</small>
                    </article>
                  ))}
                </div>
              )}
              {view === "Overview" ? (
                <>
                  <div className="overview-grid">
                    <section className="panel pipeline-summary">
                      <div className="panel-heading">
                        <div>
                          <h2>Hiring pipeline</h2>
                          <p>Current candidates at each stage.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => nav("Pipeline")}
                        >
                          View pipeline <ChevronRight size={15} />
                        </button>
                      </div>
                      <div className="stage-list">
                        {activeStages.map((s, i) => (
                          <button
                            key={s}
                            onClick={() => {
                              setView("Candidates");
                              setStage(s);
                            }}
                          >
                            <span className="stage-name">
                              <span className={"stage-dot dot" + i} />
                              {s}
                            </span>
                            <span className="stage-track">
                              <span
                                className={"stage-fill fill" + i}
                                style={{
                                  width: `${items.length ? (metrics.counts[s] / items.length) * 100 : 0}%`,
                                }}
                              />
                            </span>
                            <strong>{metrics.counts[s]}</strong>
                            <span className="stage-share">
                              {items.length
                                ? Math.round(
                                    (metrics.counts[s] / items.length) * 100,
                                  )
                                : 0}
                              %
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="panel-footer">
                        <span className="stage-dot rejected-dot" />
                        {metrics.counts.Rejected} rejected
                        <span className="footer-right">
                          {items.length} candidates in total
                        </span>
                      </div>
                    </section>
                    <section className="panel activity">
                      <div className="panel-heading">
                        <div>
                          <h2>Recent activity</h2>
                          <p>Candidate additions and stage changes.</p>
                        </div>
                        <Clock size={17} />
                      </div>
                      {activities.length ? (
                        <div className="activity-list">
                          {activities.map((a, i) => (
                            <button
                              key={i}
                              onClick={() =>
                                setSelected(
                                  items.find((c) => c.id === a.id) || null,
                                )
                              }
                            >
                              <span className="activity-dot">
                                <Check size={13} />
                              </span>
                              <span>
                                <strong>{a.name}</strong>
                                <small>{a.text}</small>
                                <time>
                                  {new Date(a.at).toLocaleString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </time>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="activity-empty">
                          <Clock size={26} />
                          <p>
                            No activity yet.
                            <br />
                            Add a candidate to get started.
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Latest candidates{" "}
                          <span className="count-pill">{items.length}</span>
                        </h2>
                        <p>Most recently added candidates.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => nav("Candidates")}
                      >
                        View all candidates <ChevronRight size={15} />
                      </button>
                    </div>
                    {table(items.slice(0, 5), true)}
                  </section>
                  {items.length === 0 && (
                    <div className="demo-note">
                      <div>
                        <strong>Need some data to try it out?</strong>
                        <p>
                          Load nine fictional candidates across different roles
                          and stages.
                        </p>
                      </div>
                      <button onClick={seed} disabled={busy}>
                        {busy ? "Loading…" : "Explore sample data"}
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <section className="panel candidates-panel">
                    <div
                      className="stage-tabs"
                      aria-label="Candidate stage shortcuts"
                    >
                      {[
                        "",
                        "Applied",
                        "Screening",
                        "Interview",
                        "Offer",
                        "Hired",
                        "Rejected",
                      ].map((value) => (
                        <button
                          key={value}
                          aria-pressed={stage === value}
                          onClick={() => setStage(value)}
                        >
                          {value || "All candidates"}
                          <span>
                            {value ? metrics.counts[value] : items.length}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="filters">
                      <div className="search">
                        <Search size={18} />
                        <input
                          aria-label="Search candidates"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search name, email, skills…"
                        />
                      </div>
                      <select
                        aria-label="Filter by position"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        <option value="">All positions</option>
                        {roles.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter by stage"
                        value={stage}
                        onChange={(e) => setStage(e.target.value)}
                      >
                        <option value="">All stages</option>
                        {stages.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button className="export" onClick={exportCsv}>
                        <Download size={16} />
                        Export
                      </button>
                    </div>
                    <div className="results-label">
                      <SlidersHorizontal size={14} />
                      {filtered.length}{" "}
                      {filtered.length === 1 ? "candidate" : "candidates"}
                      {(query || stage || role) && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setQuery("");
                            setStage("");
                            setRole("");
                          }}
                        >
                          Clear filters
                        </button>
                      )}
                      <span className="footer-right">
                        {view === "Pipeline"
                          ? "Drag a card or open it to change stage"
                          : "Select a candidate to view their details"}
                      </span>
                    </div>
                    {view === "Candidates" ? (
                      table(filtered)
                    ) : (
                      <div className="board">
                        {stages.map((s, i) => (
                          <section
                            key={s}
                            className="board-column"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const c = items.find(
                                (v) =>
                                  v.id === e.dataTransfer.getData("text/plain"),
                              );
                              if (c && !busy) move(c, s);
                            }}
                          >
                            <h3>
                              <span className={"stage-dot dot" + i} />
                              {s}
                              <span>
                                {filtered.filter((c) => c.stage === s).length}
                              </span>
                            </h3>
                            {filtered
                              .filter((c) => c.stage === s)
                              .map((c, j) => (
                                <button
                                  key={c.id}
                                  draggable={!busy}
                                  onDragStart={(e) =>
                                    e.dataTransfer.setData("text/plain", c.id)
                                  }
                                  className="candidate-card"
                                  onClick={() => setSelected(c)}
                                >
                                  <div className="card-person">
                                    <span className={"avatar color" + (j % 5)}>
                                      {initials(c.name)}
                                    </span>
                                    <span className="card-menu">
                                      <ChevronRight size={14} />
                                    </span>
                                  </div>
                                  <strong>{c.name}</strong>
                                  <small>{c.role}</small>
                                  <div className="skill-chips">
                                    {c.skills
                                      .split(",")
                                      .filter(Boolean)
                                      .slice(0, 2)
                                      .map((t) => (
                                        <span key={t}>{t.trim()}</span>
                                      ))}
                                  </div>
                                  <div className="card-bottom">
                                    <MapPin size={12} />
                                    {c.location || "Location not set"}
                                  </div>
                                </button>
                              ))}
                            {!filtered.some((c) => c.stage === s) && (
                              <div className="drop-hint">
                                No candidates here yet
                              </div>
                            )}
                          </section>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
              <footer className="main-footer">
                <span>Hireflow · Mini ATS</span>
                <span>EarlyJobs assignment</span>
              </footer>
            </>
          )}
        </main>
      </div>
      <Toaster position="bottom-right" closeButton richColors />
      {edit && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open && !busy) setEdit(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-backdrop" />
            <Dialog.Content className="modal">
              <div className="modal-header">
                <div>
                  <Dialog.Title id="edit-title">
                    {edit.id ? "Edit candidate" : "Add candidate"}
                  </Dialog.Title>
                  <Dialog.Description>
                    Contact details, application information and your notes.
                  </Dialog.Description>
                </div>
                <button
                  aria-label="Close form"
                  className="icon-button"
                  onClick={() => setEdit(null)}
                  disabled={busy}
                >
                  <X />
                </button>
              </div>
              <form onSubmit={save}>
                <div className="form-grid">
                  <label>
                    Full name <b>*</b>
                    <input
                      autoFocus
                      required
                      minLength={2}
                      maxLength={100}
                      value={edit.name}
                      onChange={(e) =>
                        setEdit({ ...edit, name: e.target.value })
                      }
                      placeholder="e.g. Aditi Sharma"
                    />
                  </label>
                  <label>
                    Email address <b>*</b>
                    <input
                      type="email"
                      required
                      maxLength={200}
                      value={edit.email}
                      onChange={(e) =>
                        setEdit({ ...edit, email: e.target.value })
                      }
                      placeholder="aditi@example.com"
                    />
                  </label>
                  <label>
                    Position <b>*</b>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      list="positions"
                      value={edit.role}
                      onChange={(e) =>
                        setEdit({ ...edit, role: e.target.value })
                      }
                    />
                    <datalist id="positions">
                      {[
                        "Frontend Developer",
                        "Backend Developer",
                        "Product Designer",
                        ...roles,
                      ]
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                    </datalist>
                  </label>
                  <label>
                    Hiring stage
                    <select
                      value={edit.stage}
                      onChange={(e) =>
                        setEdit({ ...edit, stage: e.target.value })
                      }
                    >
                      {stages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Location
                    <input
                      maxLength={100}
                      value={edit.location}
                      onChange={(e) =>
                        setEdit({ ...edit, location: e.target.value })
                      }
                      placeholder="City or remote"
                    />
                  </label>
                  <label>
                    Experience (years)
                    <input
                      type="number"
                      min={0}
                      max={60}
                      required
                      value={edit.experience}
                      onChange={(e) =>
                        setEdit({ ...edit, experience: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Source
                    <select
                      value={edit.source}
                      onChange={(e) =>
                        setEdit({ ...edit, source: e.target.value })
                      }
                    >
                      {[
                        "EarlyJobs",
                        "LinkedIn",
                        "Referral",
                        "Careers page",
                        "Other",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Skills
                    <input
                      maxLength={300}
                      value={edit.skills}
                      onChange={(e) =>
                        setEdit({ ...edit, skills: e.target.value })
                      }
                      placeholder="React, TypeScript, Figma"
                    />
                  </label>
                  <label className="full-width">
                    Recruiter notes
                    <textarea
                      maxLength={5000}
                      rows={3}
                      value={edit.notes}
                      onChange={(e) =>
                        setEdit({ ...edit, notes: e.target.value })
                      }
                      placeholder="What should the hiring team know?"
                    />
                  </label>
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="modal-footer">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEdit(null)}
                  >
                    Cancel
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Check size={16} />
                    )}{" "}
                    {busy
                      ? "Saving…"
                      : edit.id
                        ? "Save changes"
                        : "Add candidate"}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      {selected && !edit && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setSelected(null);
              setConfirmDelete(false);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-backdrop" />
            <Dialog.Content className="drawer">
              <div className="drawer-top">
                <span>CANDIDATE PROFILE</span>
                <button
                  className="icon-button"
                  aria-label="Close profile"
                  onClick={() => setSelected(null)}
                >
                  <X />
                </button>
              </div>
              <span className="avatar large color0">
                {initials(selected.name)}
              </span>
              <Dialog.Title id="candidate-title">{selected.name}</Dialog.Title>
              <Dialog.Description>{selected.role}</Dialog.Description>
              <span className={"badge " + selected.stage}>
                {selected.stage}
              </span>
              <div className="contact">
                <a href={"mailto:" + selected.email}>
                  <Mail size={16} />
                  {selected.email}
                </a>
                <span>
                  <MapPin size={16} />
                  {selected.location || "Location not provided"}
                </span>
                <span>
                  <Briefcase size={16} />
                  {selected.experience} years of experience · {selected.source}
                </span>
              </div>
              <label className="stage-control">
                Move to stage
                <select
                  disabled={busy}
                  value={selected.stage}
                  onChange={(e) => move(selected, e.target.value)}
                >
                  {stages.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <h3>Skills</h3>
              <div className="skill-chips">
                {selected.skills ? (
                  selected.skills
                    .split(",")
                    .map((t) => <span key={t}>{t.trim()}</span>)
                ) : (
                  <p>No skills added yet.</p>
                )}
              </div>
              <h3>Recruiter notes</h3>
              <p className="notes">
                {selected.notes ||
                  "No notes yet. Edit this profile to add your observations."}
              </p>
              <h3>Stage history</h3>
              <div className="journey">
                {JSON.parse(selected.history).map((h: any, i: number) => (
                  <div key={i}>
                    <span className="journey-dot" />
                    <strong>{h.text}</strong>
                    <small>{new Date(h.at).toLocaleString("en-IN")}</small>
                  </div>
                ))}
              </div>
              <div className="drawer-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setEdit({ ...selected });
                  }}
                >
                  Edit candidate
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
              {confirmDelete && (
                <div className="delete-confirm">
                  <strong>Delete {selected.name}?</strong>
                  <p>
                    This permanently removes this candidate and their history.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep candidate
                  </button>
                  <button className="danger" disabled={busy} onClick={remove}>
                    Yes, delete
                  </button>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
