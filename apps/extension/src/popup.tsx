import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { Check, LogIn, PackagePlus } from "lucide-react";
import "./style.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type Workspace = { id: string; name: string };
type Capture = { title: string; productUrl: string; imageUrl?: string | null; storeName?: string | null };

function Popup() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["accessToken"], (result) => {
      if (result.accessToken) setToken(result.accessToken);
    });
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "CARTPARTY_CAPTURE" }, (response) => {
        if (response) setCapture(response);
      });
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/extension/workspaces`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setWorkspaces(data);
        setWorkspaceId(data[0]?.id ?? "");
      });
  }, [token]);

  async function login() {
    const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
    await chrome.storage.local.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setToken(data.accessToken);
  }

  async function save() {
    if (!capture || !workspaceId) return;
    await axios.post(
      `${API_URL}/extension/save`,
      { ...capture, title: capture.title || "Untitled product", workspaceId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setSaved(true);
  }

  return (
    <main>
      <header>
        <div className="mark"><PackagePlus size={18} /></div>
        <div>
          <h1>CartParty</h1>
          <p>Save product to a shared workspace</p>
        </div>
      </header>
      {!token ? (
        <section className="panel">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          <button onClick={login}><LogIn size={16} /> Login</button>
        </section>
      ) : (
        <section className="panel">
          {capture?.imageUrl ? <img className="preview" src={capture.imageUrl} alt="" /> : null}
          <strong>{capture?.title ?? "Current page"}</strong>
          <small>{capture?.storeName}</small>
          <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <button onClick={save}>{saved ? <Check size={16} /> : <PackagePlus size={16} />}{saved ? "Saved" : "Save to CartParty"}</button>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
