import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  ArrowUpRight,
  Check,
  Heart,
  LogOut,
  MessageCircle,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Star,
  ThumbsDown,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { io } from "socket.io-client";
import { ActivityEvent, api, Product, User, VoteType, Workspace, WS_URL } from "./api";
import { PriceTag } from "./components/PriceTag";
import { ReceiptFeed } from "./components/ReceiptFeed";

type ConnectionState = "connected" | "reconnecting";

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem("cartparty.accessToken"));
  const [authMessage, setAuthMessage] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connected");
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [priceFlashId, setPriceFlashId] = useState<string | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<User[]>([]);

  const sessionUser = useMemo(() => jwtPayload(token), [token]);
  const currentUserId = sessionUser?.sub ?? null;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const selected = products.find((product) => product.id === selectedId) ?? null;
  const currentUser = activeWorkspace?.members?.find((member) => member.user.id === currentUserId)?.user;

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("cartparty.accessToken", data.accessToken);
    localStorage.setItem("cartparty.refreshToken", data.refreshToken);
    setAuthMessage("");
    setToken(data.accessToken);
  }

  async function loadWorkspaces(preferredWorkspaceId?: string) {
    setLoadingWorkspaces(true);
    try {
      const { data } = await api.get<Workspace[]>("/workspaces");
      setWorkspaces(data);
      const currentWorkspace = data.find((workspace) => workspace.id === preferredWorkspaceId)
        ?? data.find((workspace) => workspace.id === workspaceId)
        ?? data[0];
      setWorkspaceId(currentWorkspace?.id ?? "");
      setError(null);
    } catch {
      setError("Could not load this workspace. Check the API and try again.");
    } finally {
      setLoadingWorkspaces(false);
    }
  }

  async function loadWorkspaceProducts(id = workspaceId) {
    if (!id) {
      setProducts([]);
      return;
    }
    setLoadingProducts(true);
    try {
      const { data } = await api.get<Product[]>(`/workspaces/${id}/products`);
      setProducts(data);
      setSelectedId((current) => data.some((product) => product.id === current) ? current : data[0]?.id ?? null);
      setError(null);
    } catch {
      setError("Products did not load. Retry to bring the board back in sync.");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadActivity(id = workspaceId) {
    if (!id) return;
    try {
      const { data } = await api.get<ActivityEvent[]>(`/workspaces/${id}/activity`);
      setActivity(data);
    } catch {
      setError("Activity did not load. Retry to restore the live receipt.");
    }
  }

  function chooseWorkspace(id: string) {
    const workspace = workspaces.find((item) => item.id === id);
    setWorkspaceId(id);
    setSelectedId(null);
    setPresenceUsers([]);
  }

  async function retry() {
    setError(null);
    await Promise.all([loadWorkspaces(), loadWorkspaceProducts(), loadActivity()]);
  }

  useEffect(() => {
    if (token) void loadWorkspaces();
  }, [token]);

  useEffect(() => {
    const handleTokenRefresh = (event: Event) => setToken((event as CustomEvent<string>).detail);
    const handleSessionExpired = () => {
      setToken(null);
      setWorkspaces([]);
      setProducts([]);
      setActivity([]);
      setAuthMessage("Your session expired. Sign in again to keep working.");
    };

    window.addEventListener("cartparty:token-refreshed", handleTokenRefresh);
    window.addEventListener("cartparty:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("cartparty:token-refreshed", handleTokenRefresh);
      window.removeEventListener("cartparty:session-expired", handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    void loadWorkspaceProducts(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) void loadActivity(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !token) return;
    const socket = io(WS_URL, { auth: { token }, reconnection: true });
    socket.emit("join_workspace", { workspaceId });
    socket.on("connect", () => {
      setConnection("connected");
      socket.emit("join_workspace", { workspaceId });
    });
    socket.on("disconnect", () => setConnection("reconnecting"));
    socket.on("connect_error", () => setConnection("reconnecting"));
    socket.on("presence:updated", (users: User[]) => setPresenceUsers(users));
    socket.on("product:added", (product: Product) => {
      setProducts((items) => items.some((item) => item.id === product.id) ? items : [product, ...items]);
      setSelectedId((current) => current ?? product.id);
    });
    socket.on("vote:updated", () => void loadWorkspaceProducts());
    socket.on("comment:added", () => void loadWorkspaceProducts());
    socket.on("price:updated", (payload: { productId: string; currentPrice: number }) => {
      setProducts((items) => items.map((product) => product.id === payload.productId ? { ...product, currentPrice: payload.currentPrice } : product));
      setPriceFlashId(payload.productId);
      window.setTimeout(() => setPriceFlashId(null), 600);
      void loadWorkspaceProducts();
    });
    socket.on("activity:new", (event: ActivityEvent) => {
      setActivity((items) => [event, ...items.filter((item) => item.id !== event.id)].slice(0, 30));
      setNewEventIds((ids) => new Set(ids).add(event.id));
      window.setTimeout(() => setNewEventIds((ids) => {
        const next = new Set(ids);
        next.delete(event.id);
        return next;
      }), 260);
    });
    return () => {
      socket.disconnect();
    };
  }, [workspaceId, token]);

  if (!token) return <LoginScreen onLogin={login} message={authMessage} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#board" aria-label="CartParty board">
          <span className="brand__mark"><ShoppingBag size={18} strokeWidth={2.4} /></span>
          <span>CartParty</span>
        </a>
        <div className="topbar__right">
          <span className={`connection ${connection === "connected" ? "connection--online" : ""}`}>
            <span /> {connection === "connected" ? "Live" : "Reconnecting"}
          </span>
          <span className="topbar__divider" />
          <span className="user-chip"><span className="avatar avatar--maya">{initials(currentUser?.name ?? sessionUser?.email ?? "User")}</span><span>{currentUser?.name ?? sessionUser?.email ?? "Account"}</span></span>
          <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={() => {
            localStorage.clear();
            setToken(null);
          }}><LogOut size={17} /></button>
        </div>
      </header>

      {connection === "reconnecting" ? (
        <div className="connection-banner" role="status">
          <span>Lost connection to the workspace. Reconnecting.</span>
          <button onClick={() => location.reload()}><RefreshCw size={14} /> Retry</button>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onRetry={retry} onClose={() => setError(null)} /> : null}

      <main className="workspace-layout" id="board">
        <WorkspaceSidebar
          workspaces={workspaces}
          activeWorkspaceId={workspaceId}
          loading={loadingWorkspaces}
          onWorkspace={chooseWorkspace}
          onCreated={(id) => loadWorkspaces(id)}
          onError={setError}
        />

        <section className="board">
          <BoardHeader
            workspace={activeWorkspace}
            products={products}
            currentUserId={currentUserId}
            presenceUsers={presenceUsers}
            onCreated={() => loadWorkspaceProducts()}
            onMembersChanged={() => loadWorkspaces(workspaceId)}
            onWorkspaceChanged={() => loadWorkspaces(workspaceId)}
            onWorkspaceDeleted={() => {
              setSelectedId(null);
              void loadWorkspaces();
            }}
            onError={setError}
          />

          {loadingProducts ? <ProductSkeletons /> : products.length ? (
            <div className="product-grid" aria-live="polite">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currentUserId={currentUserId}
                  selected={product.id === selectedId}
                  flashPrice={product.id === priceFlashId}
                  onOpen={() => setSelectedId(product.id)}
                  onVoteError={() => {
                    setError("Your vote did not save. Retry to bring the board back in sync.");
                    void loadWorkspaceProducts();
                  }}
                  onOptimisticVote={(voteType) => {
                    setProducts((items) => items.map((item) => item.id === product.id ? withOptimisticVote(item, currentUserId, voteType) : item));
                  }}
                />
              ))}
            </div>
          ) : <EmptyWorkspace workspace={activeWorkspace} onCreated={() => loadWorkspaceProducts()} onError={setError} />}
        </section>

        <aside className="right-rail" aria-label="Product detail and activity">
          {selected ? (
            <ProductDetail
              product={selected}
              flashPrice={selected.id === priceFlashId}
              canManage={selected.adder.id === currentUserId || activeWorkspace?.members?.some((member) => member.user.id === currentUserId && member.role === "owner") === true}
              onClose={() => setSelectedId(null)}
              onRefresh={() => {
                void loadWorkspaceProducts();
                void loadActivity();
              }}
              onDeleted={() => {
                setSelectedId(null);
                void loadWorkspaceProducts();
                void loadActivity();
              }}
              onError={setError}
            />
          ) : <DecisionSnapshot products={products} onSelect={() => setSelectedId(products[0]?.id ?? null)} />}
          <ReceiptFeed events={activity} newEventIds={newEventIds} />
        </aside>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, message }: { onLogin: (email: string, password: string) => Promise<void>; message?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        const { data } = await api.post("/auth/register", { email, password, name });
        localStorage.setItem("cartparty.accessToken", data.accessToken);
        localStorage.setItem("cartparty.refreshToken", data.refreshToken);
        location.reload();
        return;
      }
      await onLogin(email, password);
    } catch {
      setError(mode === "login" ? "Those credentials do not match an account." : "That account could not be created. Check each field and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand__mark"><ShoppingBag size={20} strokeWidth={2.4} /></span>
          <span>CartParty</span>
        </div>
        <p className="eyebrow">Shared decisions, one cart</p>
        <h1>Make the pick together.</h1>
        <p className="login-panel__copy">Organize the shortlist, see where everyone stands, and catch the right price.</p>

        <div className="mode-switch" aria-label="Account action">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>

        <form onSubmit={submit}>
          {mode === "register" ? <Field label="Name" value={name} onChange={setName} autoComplete="name" /> : null}
          <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {error || message ? <p className="form-error" role="alert">{error || message}</p> : null}
          <button className="primary-button login-panel__submit" disabled={busy} type="submit">
            {busy ? "Opening workspace..." : mode === "login" ? "Open CartParty" : "Create workspace account"}
          </button>
        </form>
      </section>
      <aside className="login-preview" aria-label="A CartParty bag receiving saved products">
        <LoginBagAnimation />
      </aside>
    </main>
  );
}

function LoginBagAnimation() {
  return (
    <div className="bag-scene" aria-hidden="true">
      <span className="bag-scene__line bag-scene__line--one" />
      <span className="bag-scene__line bag-scene__line--two" />
      <span className="bag-item bag-item--one"><PackagePlus size={16} /></span>
      <span className="bag-item bag-item--two"><Star size={15} /></span>
      <span className="bag-item bag-item--three"><Heart size={15} /></span>
      <div className="bag-mark">
        <ShoppingBag size={72} strokeWidth={1.8} />
        <span className="bag-mark__count">+</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} type={type} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function WorkspaceSidebar(props: {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  loading: boolean;
  onWorkspace: (id: string) => void;
  onCreated: (id: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post<Workspace>("/workspaces", { name: name.trim() });
      setName("");
      await props.onCreated(data.id);
    } catch {
      props.onError("The workspace did not save. Keep the name and retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="sidebar" aria-label="Workspaces">
      <div className="sidebar__heading">
        <p className="eyebrow">Workspaces</p>
        <span>{props.workspaces.length.toString().padStart(2, "0")}</span>
      </div>
      <nav className="workspace-list">
        {props.loading && !props.workspaces.length ? <div className="sidebar-skeleton" /> : props.workspaces.map((workspace) => (
          <div className="workspace-group" key={workspace.id}>
            <button
              className={`workspace-button ${workspace.id === props.activeWorkspaceId ? "is-active" : ""}`}
              onClick={() => props.onWorkspace(workspace.id)}
            >
              <span>{initials(workspace.name)}</span>
              <strong>{workspace.name}</strong>
              <small>{workspace.members?.length ?? 1}</small>
            </button>
          </div>
        ))}
      </nav>
      <form className="new-workspace" onSubmit={createWorkspace}>
        <label htmlFor="new-workspace">New workspace</label>
        <div>
          <input id="new-workspace" placeholder="Name the decision" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="icon-button icon-button--accent" title="Create workspace" aria-label="Create workspace" type="submit" disabled={saving}><Plus size={17} /></button>
        </div>
      </form>
    </aside>
  );
}

function BoardHeader({ workspace, products, currentUserId, presenceUsers, onCreated, onMembersChanged, onWorkspaceChanged, onWorkspaceDeleted, onError }: {
  workspace?: Workspace;
  products: Product[];
  currentUserId: string | null;
  presenceUsers: User[];
  onCreated: () => void;
  onMembersChanged: () => Promise<void>;
  onWorkspaceChanged: () => Promise<void>;
  onWorkspaceDeleted: () => void;
  onError: (message: string) => void;
}) {
  const picked = products.filter((product) => voteCounts(product).love >= 2 || voteCounts(product).favorite >= 2).length;
  return (
    <header className="board-header">
      <div className="board-header__copy">
        <p className="eyebrow">Workspace</p>
        <h1>{workspace?.name ?? "Choose a workspace"}</h1>
        <p>{decisionSubtitle(undefined, picked, products.length)}</p>
      </div>
      <div className="board-header__actions">
        <Presence users={presenceUsers} />
        <ManageWorkspace workspace={workspace} currentUserId={currentUserId} onChanged={onWorkspaceChanged} onDeleted={onWorkspaceDeleted} onError={onError} />
        <InviteMembers workspace={workspace} currentUserId={currentUserId} onMembersChanged={onMembersChanged} onError={onError} />
        <CreateProduct workspaceId={workspace?.id ?? ""} onCreated={onCreated} onError={onError} />
      </div>
    </header>
  );
}

function ManageWorkspace({ workspace, currentUserId, onChanged, onDeleted, onError }: {
  workspace?: Workspace;
  currentUserId: string | null;
  onChanged: () => Promise<void>;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(workspace?.name ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const membership = workspace?.members?.find((member) => member.user.id === currentUserId);

  useEffect(() => {
    setName(workspace?.name ?? "");
    setOpen(false);
    setConfirmingDelete(false);
  }, [workspace?.id, workspace?.name]);

  if (!workspace || membership?.role !== "owner") return null;
  const activeWorkspace = workspace;

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await api.patch(`/workspaces/${activeWorkspace.id}`, { name: name.trim() });
      await onChanged();
      setOpen(false);
    } catch {
      onError("The workspace name did not update. Keep the name and retry.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorkspace() {
    if (saving) return;
    setSaving(true);
    try {
      await api.delete(`/workspaces/${activeWorkspace.id}`);
      onDeleted();
    } catch {
      onError("The workspace could not be deleted. Retry when the connection is ready.");
      setSaving(false);
    }
  }

  return (
    <div className="workspace-manage">
      <button className="icon-button" type="button" title="Manage workspace" aria-label="Manage workspace" onClick={() => setOpen((value) => !value)}><Pencil size={16} /></button>
      {open ? (
        <section className="workspace-manage__popover" role="dialog" aria-label={`Manage ${activeWorkspace.name}`}>
          <div className="workspace-manage__header"><div><p className="eyebrow">Workspace settings</p><h2>Manage workspace</h2></div><button className="icon-button" type="button" title="Close" aria-label="Close workspace settings" onClick={() => setOpen(false)}><X size={17} /></button></div>
          <form onSubmit={rename}>
            <Field label="Workspace name" value={name} onChange={setName} />
            <button className="primary-button" type="submit" disabled={saving || !name.trim()}><Check size={16} /> {saving ? "Saving..." : "Save name"}</button>
          </form>
          <div className="workspace-manage__danger">
            {confirmingDelete ? <div className="product-delete-confirm" role="alert"><span>Delete this workspace and all of its products, votes, comments, price history, and activity?</span><div><button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>Keep workspace</button><button className="danger-button" type="button" disabled={saving} onClick={deleteWorkspace}><Trash2 size={15} /> {saving ? "Deleting..." : "Delete workspace"}</button></div></div> : <button className="text-button text-button--danger" type="button" onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> Delete workspace</button>}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function InviteMembers({ workspace, currentUserId, onMembersChanged, onError }: {
  workspace?: Workspace;
  currentUserId: string | null;
  onMembersChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const membership = workspace?.members?.find((member) => member.user.id === currentUserId);

  if (!workspace || membership?.role !== "owner") return null;
  const activeWorkspace = workspace;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const { data } = await api.post<{ user: User }>(`/workspaces/${activeWorkspace.id}/members`, { email: email.trim() });
      setNotice(`${data.user.name} can now see this workspace.`);
      setEmail("");
      await onMembersChanged();
    } catch (error) {
      const status = typeof error === "object" && error && "response" in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
      if (status === 404) {
        setNotice("That email does not have a CartParty account yet.");
      } else if (status === 403) {
        onError("Only workspace owners can invite people.");
      } else {
        setNotice("The invite did not send. Keep the email and retry.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="invite-members">
      <button className="secondary-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <UserPlus size={16} /> Invite people
      </button>
      {open ? (
        <section className="invite-popover" role="dialog" aria-label={`Invite people to ${activeWorkspace.name}`}>
          <div className="invite-popover__header">
            <div><p className="eyebrow">Workspace members</p><h2>Invite people</h2></div>
            <button className="icon-button" title="Close" aria-label="Close invite dialog" type="button" onClick={() => setOpen(false)}><X size={17} /></button>
          </div>
          <p className="invite-popover__copy">Add someone who already has a CartParty account.</p>
          <form className="invite-form" onSubmit={submit}>
            <label className="field">
              <span>Email address</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="name@example.com" />
            </label>
            <button className="primary-button" type="submit" disabled={saving || !email.trim()}><UserPlus size={16} /> {saving ? "Inviting..." : "Invite"}</button>
          </form>
          {notice ? <p className="invite-notice" role="status">{notice}</p> : null}
          <div className="member-list">
            <div className="member-list__heading"><span>Members</span><span>{activeWorkspace.members?.length ?? 0}</span></div>
            {activeWorkspace.members?.map((member, index) => (
              <div className="member-row" key={member.user.id}>
                <i className={`avatar avatar--${index % 4}`}>{initials(member.user.name)}</i>
                <span><strong>{member.user.name}</strong><small>{member.user.email}</small></span>
                <em>{member.role}</em>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Presence({ users }: { users: User[] }) {
  return (
    <div className="presence" title={users.length ? `${users.map((user) => user.name).join(", ")} are in this workspace` : "Connecting to workspace presence"}>
      <span className="presence__avatars">
        {users.slice(0, 4).map((user, index) => <i key={user.id} className={`avatar avatar--${index}`}>{initials(user.name)}</i>)}
      </span>
      <span>{users.length ? `${users.length} here now` : "Connecting..."}</span>
    </div>
  );
}

function CreateProduct({ workspaceId, onCreated, onError, triggerLabel = "Add product" }: { workspaceId: string; onCreated: () => void; onError: (message: string) => void; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", storeName: "", productUrl: "", imageUrl: "", currentPrice: "", notes: "" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !form.title.trim()) return;
    setSaving(true);
    try {
      await api.post(`/workspaces/${workspaceId}/products`, {
        ...form,
        title: form.title.trim(),
        currentPrice: form.currentPrice ? Number(form.currentPrice) : undefined,
        imageUrl: form.imageUrl || undefined,
        productUrl: form.productUrl || undefined,
        storeName: form.storeName || undefined,
        notes: form.notes || undefined
      });
      setForm({ title: "", storeName: "", productUrl: "", imageUrl: "", currentPrice: "", notes: "" });
      setOpen(false);
      onCreated();
    } catch {
      onError("This product did not save. Your details are still here; retry when the connection is ready.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="create-product">
      <button className="primary-button" disabled={!workspaceId} onClick={() => setOpen((value) => !value)}>
        <PackagePlus size={17} /> {triggerLabel}
      </button>
      {open ? (
        <form className="product-form" onSubmit={submit}>
          <div className="product-form__header">
            <div><p className="eyebrow">New shortlist item</p><h2>Add a product</h2></div>
            <button className="icon-button" title="Close" aria-label="Close product form" type="button" onClick={() => setOpen(false)}><X size={17} /></button>
          </div>
          <Field label="Product name" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <div className="form-row">
            <Field label="Brand or store" value={form.storeName} onChange={(value) => setForm({ ...form, storeName: value })} />
            <Field label="Current price" value={form.currentPrice} onChange={(value) => setForm({ ...form, currentPrice: value })} type="number" />
          </div>
          <Field label="Product URL" value={form.productUrl} onChange={(value) => setForm({ ...form, productUrl: value })} type="url" />
          <Field label="Image URL" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} type="url" />
          <Field label="Note for the group" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          <button className="primary-button product-form__submit" disabled={saving} type="submit"><Check size={16} /> {saving ? "Saving..." : "Save to shortlist"}</button>
        </form>
      ) : null}
    </div>
  );
}

function ProductCard({ product, currentUserId, selected, flashPrice, onOpen, onOptimisticVote, onVoteError }: {
  product: Product;
  currentUserId: string | null;
  selected: boolean;
  flashPrice: boolean;
  onOpen: () => void;
  onOptimisticVote: (vote: VoteType) => void;
  onVoteError: () => void;
}) {
  const counts = useMemo(() => voteCounts(product), [product]);
  const myVote = product.votes.find((vote) => vote.userId === currentUserId)?.voteType ?? null;
  const delta = priceDelta(product);

  async function vote(voteType: VoteType) {
    onOptimisticVote(voteType);
    try {
      await api.post(`/products/${product.id}/votes`, { voteType });
    } catch {
      onVoteError();
    }
  }

  return (
    <article className={`product-card ${selected ? "product-card--selected" : ""}`}>
      <button className="product-card__media" onClick={onOpen} aria-label={`Open ${product.title}`}>
        {product.imageUrl ? <img src={product.imageUrl} alt={product.title} loading="lazy" /> : <span className="image-fallback"><ShoppingBag size={26} /> Image pending</span>}
        <PriceTag value={product.currentPrice} currency={product.currency} delta={delta} flash={flashPrice} />
      </button>
      <div className="product-card__body">
        <p className="eyebrow">{product.storeName ?? "Independent seller"}</p>
        <button className="product-card__title" onClick={onOpen}>{product.title}</button>
        <p className="product-card__note">{product.notes ?? "Waiting for a note from the group."}</p>
      </div>
      <div className="vote-row" aria-label={`Vote on ${product.title}`}>
        <VoteButton type="love" count={counts.love} selected={myVote === "love"} onClick={() => vote("love")} />
        <VoteButton type="pass" count={counts.pass} selected={myVote === "pass"} onClick={() => vote("pass")} />
        <VoteButton type="favorite" count={counts.favorite} selected={myVote === "favorite"} onClick={() => vote("favorite")} />
      </div>
    </article>
  );
}

function VoteButton({ type, count, selected, onClick }: { type: VoteType; count: number; selected: boolean; onClick: () => void }) {
  const [pressed, setPressed] = useState(false);
  const icon = type === "love" ? <Heart size={15} /> : type === "pass" ? <ThumbsDown size={15} /> : <Star size={15} />;
  const label = type === "love" ? "Love" : type === "pass" ? "Pass" : "Favorite";

  return (
    <button
      className={`vote-button vote-button--${type} ${selected ? "is-selected" : ""} ${pressed ? "is-pressed" : ""}`}
      aria-pressed={selected}
      title={`${label}: ${count}`}
      onClick={() => {
        setPressed(false);
        window.requestAnimationFrame(() => setPressed(true));
        window.setTimeout(() => setPressed(false), 170);
        onClick();
      }}
    >
      {icon}<span>{label}</span><strong>{count}</strong>
    </button>
  );
}

function ProductDetail({ product, flashPrice, canManage, onClose, onRefresh, onDeleted, onError }: { product: Product; flashPrice: boolean; canManage: boolean; onClose: () => void; onRefresh: () => void; onDeleted: () => void; onError: (message: string) => void }) {
  const [body, setBody] = useState("");
  const [price, setPrice] = useState(String(product.currentPrice ?? ""));
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingProduct, setEditingProduct] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [form, setForm] = useState(productFormValues(product));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(String(product.currentPrice ?? ""));
    setForm(productFormValues(product));
    setEditingProduct(false);
    setConfirmingDelete(false);
  }, [product]);

  async function comment(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.post(`/products/${product.id}/comments`, { body: body.trim() });
      setBody("");
      onRefresh();
    } catch {
      onError("Your comment did not post. Keep the text and retry.");
    } finally {
      setSaving(false);
    }
  }

  async function updatePrice(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.patch(`/products/${product.id}`, { currentPrice: Number(price) });
      setEditingPrice(false);
      onRefresh();
    } catch {
      onError("The price did not update. Check the value and retry.");
    }
  }

  async function updateProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || productSaving) return;
    setProductSaving(true);
    try {
      await api.patch(`/products/${product.id}`, {
        title: form.title.trim(),
        storeName: form.storeName.trim() || undefined,
        productUrl: form.productUrl.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        currentPrice: form.currentPrice ? Number(form.currentPrice) : undefined,
        notes: form.notes.trim() || undefined
      });
      setEditingProduct(false);
      onRefresh();
    } catch {
      onError("This product did not update. Keep your changes and retry.");
    } finally {
      setProductSaving(false);
    }
  }

  async function deleteProduct() {
    if (productSaving) return;
    setProductSaving(true);
    try {
      await api.delete(`/products/${product.id}`);
      onDeleted();
    } catch {
      onError("This product could not be deleted. Retry when the connection is ready.");
      setProductSaving(false);
    }
  }

  return (
    <section className="detail-panel" aria-labelledby="detail-title">
      <header className="detail-panel__header">
        <div>
          <p className="eyebrow">{product.storeName ?? "Product detail"}</p>
          <h2 id="detail-title">{product.title}</h2>
        </div>
        <div className="detail-panel__actions">
          {canManage ? <button className="icon-button" title="Edit product" aria-label="Edit product" onClick={() => setEditingProduct((value) => !value)}><Pencil size={16} /></button> : null}
          <button className="icon-button" title="Close detail" aria-label="Close product detail" onClick={onClose}><X size={17} /></button>
        </div>
      </header>

      {editingProduct ? (
        <form className="product-editor" onSubmit={updateProduct}>
          <div className="product-editor__heading"><span>Edit product</span><button className="text-button" type="button" onClick={() => setEditingProduct(false)}>Cancel</button></div>
          <Field label="Product name" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <div className="form-row">
            <Field label="Brand or store" value={form.storeName} onChange={(value) => setForm({ ...form, storeName: value })} />
            <Field label="Current price" value={form.currentPrice} onChange={(value) => setForm({ ...form, currentPrice: value })} type="number" />
          </div>
          <Field label="Product URL" value={form.productUrl} onChange={(value) => setForm({ ...form, productUrl: value })} type="url" />
          <Field label="Image URL" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} type="url" />
          <Field label="Note for the group" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          <button className="primary-button" disabled={productSaving} type="submit"><Check size={16} /> {productSaving ? "Saving..." : "Save changes"}</button>
        </form>
      ) : null}

      <div className="detail-panel__price">
        <PriceTag value={product.currentPrice} currency={product.currency} delta={priceDelta(product)} flash={flashPrice} />
        <div>
          <button className="text-button" onClick={() => setEditingPrice((value) => !value)}>Edit price</button>
          {product.productUrl ? <a className="icon-button" href={product.productUrl} target="_blank" rel="noreferrer" title="Open product page" aria-label="Open product page"><ArrowUpRight size={16} /></a> : null}
        </div>
      </div>
      {editingPrice ? (
        <form className="price-editor" onSubmit={updatePrice}>
          <label htmlFor="price-edit">Current price</label>
          <input id="price-edit" type="number" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
          <button className="primary-button" type="submit">Save</button>
        </form>
      ) : null}

      {canManage ? (
        <div className="product-danger-zone">
          {confirmingDelete ? (
            <div className="product-delete-confirm" role="alert">
              <span>Delete this product and its votes, comments, and price history?</span>
              <div><button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>Keep product</button><button className="danger-button" type="button" disabled={productSaving} onClick={deleteProduct}><Trash2 size={15} /> {productSaving ? "Deleting..." : "Delete"}</button></div>
            </div>
          ) : <button className="text-button text-button--danger" type="button" onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> Delete product</button>}
        </div>
      ) : null}

      <div className="chart-block">
        <div className="section-heading"><span>Price history</span><small>{product.priceHistory.length} checks</small></div>
        <PriceHistoryChart points={product.priceHistory} currency={product.currency} />
      </div>

      <div className="comments-block">
        <div className="section-heading"><span>Comments</span><small>{product.comments.length.toString().padStart(2, "0")}</small></div>
        <div className="comments-list">
          {product.comments.length ? product.comments.map((comment) => (
            <article className="comment" key={comment.id}>
              <span className="avatar">{initials(comment.user.name)}</span>
              <div><p><strong>{comment.user.name}</strong><time>{relativeTime(comment.createdAt)}</time></p><span>{comment.body}</span></div>
            </article>
          )) : <p className="comments-empty">No comments yet. Put the first opinion on the record.</p>}
        </div>
        <form className="comment-composer" onSubmit={comment}>
          <textarea aria-label="Comment" placeholder="Add your take for the group" value={body} onChange={(event) => setBody(event.target.value)} />
          <button className="primary-button" disabled={saving || !body.trim()} type="submit"><MessageCircle size={15} /> {saving ? "Posting..." : "Comment"}</button>
        </form>
      </div>
    </section>
  );
}

function productFormValues(product: Product) {
  return {
    title: product.title,
    storeName: product.storeName ?? "",
    productUrl: product.productUrl ?? "",
    imageUrl: product.imageUrl ?? "",
    currentPrice: product.currentPrice == null ? "" : String(product.currentPrice),
    notes: product.notes ?? ""
  };
}

function PriceHistoryChart({ points, currency }: { points: Product["priceHistory"]; currency: string }) {
  const data = [...points].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  if (!data.length) return <div className="chart-empty">Tracking begins at the next hourly check.</div>;
  const values = data.map((point) => Number(point.price));
  const firstValue = values[0]!;
  const lastValue = values[values.length - 1]!;
  const firstPoint = data[0]!;
  const lastPoint = data[data.length - 1]!;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const chartWidth = 214;
  const chartHeight = 90;
  const top = 16;
  const path = values.map((value, index) => {
    const x = 16 + (index / Math.max(1, values.length - 1)) * chartWidth;
    const y = top + chartHeight - ((value - min) / Math.max(1, max - min)) * chartHeight;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastY = top + chartHeight - ((lastValue - min) / Math.max(1, max - min)) * chartHeight;

  return (
    <svg viewBox="0 0 340 140" className="price-chart" role="img" aria-label={`Price changed from ${formatCompact(firstValue, currency)} to ${formatCompact(lastValue, currency)}`}>
      <text x="2" y="15">{formatCompact(max, currency)}</text>
      <text x="2" y="128">{formatCompact(min, currency)}</text>
      <path d={path} className="price-chart__line" />
      <circle cx="230" cy={lastY} r="4" className="price-chart__point" />
      <foreignObject x="237" y={Math.max(2, Math.min(98, lastY - 18))} width="101" height="42">
        <PriceTag value={lastValue} currency={currency} />
      </foreignObject>
      <text x="16" y="136">{shortDate(firstPoint.recordedAt)}</text>
      <text x="198" y="136">{shortDate(lastPoint.recordedAt)}</text>
    </svg>
  );
}

function ProductSkeletons() {
  return (
    <div className="product-grid" aria-label="Loading products">
      {[0, 1, 2, 3].map((index) => (
        <div className="product-skeleton" key={index}>
          <div className="skeleton skeleton--image" />
          <div className="product-skeleton__body"><span className="skeleton skeleton--eyebrow" /><span className="skeleton skeleton--title" /><span className="skeleton skeleton--note" /></div>
          <div className="product-skeleton__votes"><span /><span /><span /></div>
        </div>
      ))}
    </div>
  );
}

function EmptyWorkspace({ workspace, onCreated, onError }: {
  workspace?: Workspace;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon"><ShoppingBag size={24} /></span>
      <h2>No products yet.</h2>
      <p>Add the first thing this workspace is deciding on.</p>
      <CreateProduct workspaceId={workspace?.id ?? ""} onCreated={onCreated} onError={onError} triggerLabel="Add the first product" />
    </section>
  );
}

function ErrorBanner({ message, onRetry, onClose }: { message: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      <div><button onClick={onRetry}><RefreshCw size={14} /> Retry</button><button className="icon-button" title="Dismiss" aria-label="Dismiss error" onClick={onClose}><X size={15} /></button></div>
    </div>
  );
}

function DecisionSnapshot({ products, onSelect }: { products: Product[]; onSelect: () => void }) {
  const leader = [...products].sort((a, b) => voteCounts(b).love - voteCounts(a).love)[0];
  return (
    <section className="decision-snapshot">
      <ReceiptText size={19} />
      <p className="eyebrow">Decision snapshot</p>
      <h2>{leader ? `${leader.storeName} is leading` : "No product selected"}</h2>
      <p>{leader ? `${voteCounts(leader).love} people love ${leader.title}.` : "Choose a product card to inspect its price history and comments."}</p>
      {leader ? <button className="text-button" onClick={onSelect}>Open the leader</button> : null}
    </section>
  );
}

function voteCounts(product: Product) {
  return product.votes.reduce((acc, vote) => ({ ...acc, [vote.voteType]: acc[vote.voteType] + 1 }), { love: 0, pass: 0, favorite: 0 });
}

function withOptimisticVote(product: Product, userId: string | null, voteType: VoteType): Product {
  if (!userId) return product;
  return { ...product, votes: [...product.votes.filter((vote) => vote.userId !== userId), { userId, voteType }] };
}

function priceDelta(product: Product) {
  if (product.priceHistory.length < 2 || product.currentPrice == null) return null;
  const sorted = [...product.priceHistory].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  return Number((Number(product.currentPrice) - Number(sorted.at(-2)!.price)).toFixed(2));
}

function jwtPayload(token: string | null): { sub: string; email: string } | null {
  if (!token) return null;
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" && typeof payload.email === "string" ? payload : null;
  } catch {
    return null;
  }
}

function initials(value: string) {
  return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function decisionSubtitle(description: string | null | undefined, picked: number, total: number) {
  return `${description ?? "Deciding what makes the final cart"}, ${picked} of ${total} picked.`;
}

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatCompact(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
