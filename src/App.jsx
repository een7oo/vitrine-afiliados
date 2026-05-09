import { useState, useEffect, useRef } from "react";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPA_URL = "https://rjglqdupougpwyhebcxp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZ2xxZHVwb3VncHd5aGViY3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyOTUwNzYsImV4cCI6MjA5Mzg3MTA3Nn0.zgJqtEN9FFD1piwh_rOYh08VgibjDYFC69KDLaoUNq0";

const h = (token) => ({
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${token || SUPA_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
});

const supa = {
  _token: null,
  _userId: null,

  // ── Auth ──
  async signUp(email, password) {
    const r = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method: "POST", headers: h(),
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (r.status === 429) throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
    if (!r.ok || d.error || d.error_code) throw new Error(d.msg || d.error_description || d.error?.message || "Erro ao criar conta");
    if (d.access_token) { this._token = d.access_token; this._userId = d.user?.id; }
    return d;
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: h(),
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (r.status === 429) throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
    if (!r.ok || d.error || d.error_code) throw new Error(d.msg || d.error_description || d.error?.message || "E-mail ou senha incorretos");
    this._token = d.access_token;
    this._userId = d.user?.id;
    localStorage.setItem("sb_token", d.access_token);
    localStorage.setItem("sb_refresh", d.refresh_token || "");
    return d;
  },
  async refreshSession(refreshToken) {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: h(),
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const d = await r.json();
    if (d.access_token) {
      this._token = d.access_token;
      this._userId = d.user?.id;
      localStorage.setItem("sb_token", d.access_token);
      localStorage.setItem("sb_refresh", d.refresh_token || "");
    }
    return d;
  },
  async getUser(token) {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: h(token) });
    if (r.status === 403 || r.status === 401) {
      localStorage.removeItem("sb_token");
      localStorage.removeItem("sb_refresh");
      return null;
    }
    return r.json();
  },
  signOut() {
    this._token = null; this._userId = null;
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_refresh");
  },

  // ── Profile ──
  async getProfileByUser(userId) {
    const r = await fetch(`${SUPA_URL}/rest/v1/profiles?user_id=eq.${userId}&limit=1`, { headers: h(this._token) });
    const d = await r.json();
    return d[0] || null;
  },
  async getProfileByUsername(username) {
    const r = await fetch(`${SUPA_URL}/rest/v1/profiles?username=eq.${username}&limit=1`, { headers: h(this._token) });
    const d = await r.json();
    return d[0] || null;
  },
  async createProfile(data) {
    const r = await fetch(`${SUPA_URL}/rest/v1/profiles`, { method: "POST", headers: h(this._token), body: JSON.stringify(data) });
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  },
  async updateProfile(id, data) {
    await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${id}`, { method: "PATCH", headers: h(this._token), body: JSON.stringify(data) });
  },

  // ── Products ──
  async getProducts(profileId) {
    const r = await fetch(`${SUPA_URL}/rest/v1/products?profile_id=eq.${profileId}&order=created_at.desc`, { headers: h(this._token) });
    return r.json();
  },
  async addProduct(data) {
    const r = await fetch(`${SUPA_URL}/rest/v1/products`, { method: "POST", headers: h(this._token), body: JSON.stringify(data) });
    const d = await r.json();
    return Array.isArray(d) ? d[0] : d;
  },
  async deleteProduct(id) {
    await fetch(`${SUPA_URL}/rest/v1/products?id=eq.${id}`, { method: "DELETE", headers: h(this._token) });
  },

  // ── Storage ──
  async uploadAvatar(userId, file) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/avatars/${path}`, {
      method: "POST",
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${this._token}`, "Content-Type": file.type, "x-upsert": "true" },
      body: file
    });
    if (!r.ok) throw new Error("Upload falhou");
    return `${SUPA_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`;
  }
};

// ─── Themes ───────────────────────────────────────────────────────────────────
const THEMES = {
  laranja: { label:"Laranja", swatch:"#f97316", accent:"#f97316", accentGrad:"linear-gradient(135deg,#f97316,#fb923c)", bg:"#f9f8f6", card:"#ffffff", header:"#ffffff", border:"#f0ede8", chipBg:"#f0ede8", chipActive:"#1a1a1a", chipActiveText:"#ffffff", text:"#1a1a1a", textSub:"#888", scrollThumb:"#f97316", promo:"#ef4444" },
  azul:    { label:"Azul",    swatch:"#2563eb", accent:"#2563eb", accentGrad:"linear-gradient(135deg,#2563eb,#60a5fa)", bg:"#f4f6fb", card:"#ffffff", header:"#ffffff", border:"#e2e8f4", chipBg:"#e2e8f4", chipActive:"#1e3a6e", chipActiveText:"#ffffff", text:"#0f172a", textSub:"#6b7a9a", scrollThumb:"#2563eb", promo:"#ef4444" },
  verde:   { label:"Verde",   swatch:"#16a34a", accent:"#16a34a", accentGrad:"linear-gradient(135deg,#16a34a,#4ade80)", bg:"#f3faf5", card:"#ffffff", header:"#ffffff", border:"#d1ead8", chipBg:"#d1ead8", chipActive:"#14532d", chipActiveText:"#ffffff", text:"#0f2d18", textSub:"#6a9b76", scrollThumb:"#16a34a", promo:"#ef4444" },
  roxo:    { label:"Roxo",    swatch:"#7c3aed", accent:"#7c3aed", accentGrad:"linear-gradient(135deg,#7c3aed,#a78bfa)", bg:"#f7f4fe", card:"#ffffff", header:"#ffffff", border:"#e5ddf9", chipBg:"#e5ddf9", chipActive:"#3b0764", chipActiveText:"#ffffff", text:"#1a0a2e", textSub:"#7e6fa5", scrollThumb:"#7c3aed", promo:"#ef4444" },
  escuro:  { label:"Escuro",  swatch:"#0f172a", accent:"#f59e0b", accentGrad:"linear-gradient(135deg,#f59e0b,#fbbf24)", bg:"#0f172a", card:"#1e293b", header:"#1e293b", border:"#334155", chipBg:"#334155", chipActive:"#f59e0b", chipActiveText:"#0f172a", text:"#f1f5f9", textSub:"#94a3b8", scrollThumb:"#f59e0b", promo:"#f87171" },
  rosa:    { label:"Rosa",    swatch:"#db2777", accent:"#db2777", accentGrad:"linear-gradient(135deg,#db2777,#f472b6)", bg:"#fdf4f8", card:"#ffffff", header:"#ffffff", border:"#fbd5e8", chipBg:"#fbd5e8", chipActive:"#831843", chipActiveText:"#ffffff", text:"#1a0010", textSub:"#a05070", scrollThumb:"#db2777", promo:"#ef4444" },
  pb:      { label:"P&B",     swatch:"#111111", accent:"#111111", accentGrad:"linear-gradient(135deg,#111,#444)", bg:"#f5f5f5", card:"#ffffff", header:"#ffffff", border:"#e0e0e0", chipBg:"#e8e8e8", chipActive:"#111111", chipActiveText:"#ffffff", text:"#111111", textSub:"#777", scrollThumb:"#333", promo:"#444" },
};

const FONT_PAIRS = {
  moderna:  { label:"Moderna",  desc:"Plus Jakarta Sans + DM Sans",  import:"https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap", heading:"'Plus Jakarta Sans', sans-serif", body:"'DM Sans', sans-serif" },
  classica: { label:"Clássica", desc:"Playfair Display + Lato",       import:"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Lato:wght@400;500;700&display=swap", heading:"'Playfair Display', Georgia, serif", body:"'Lato', sans-serif" },
  tecnica:  { label:"Técnica",  desc:"Space Mono + IBM Plex Sans",    import:"https://fonts.googleapis.com/css2?family=Space+Mono:wght@700&family=IBM+Plex+Sans:wght@400;500;600&display=swap", heading:"'Space Mono', monospace", body:"'IBM Plex Sans', sans-serif" },
  elegante: { label:"Elegante", desc:"Cormorant Garamond + Nunito",   import:"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700;800&family=Nunito:wght@400;500;600&display=swap", heading:"'Cormorant Garamond', serif", body:"'Nunito', sans-serif" },
  arrojada: { label:"Arrojada", desc:"Bebas Neue + Inter",            import:"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap", heading:"'Bebas Neue', sans-serif", body:"'Inter', sans-serif" },
};

const CAT_EMOJI = { "Todos":"◈","Eletrônicos":"⚡","Moda":"◆","Casa":"▲","Beleza":"★","Esportes":"●","Brinquedos":"◉","Livros":"▣","Alimentos":"◐","Outros":"□" };
const platformConfig = {
  shopee:       { label:"Shopee",        color:"#EE4D2D", bg:"#fff1ee" },
  mercadolivre: { label:"Mercado Livre", color:"#e6b800", bg:"#fffce0", text:"#7a6200" },
  amazon:       { label:"Amazon",        color:"#FF9900", bg:"#fff7ec" },
  unknown:      { label:"Link",          color:"#888",    bg:"#f5f5f5" },
};

const DEMO_PRODUCTS = [
  { id:"d1", title:"Fone Bluetooth TWS Pro",    price:"R$ 89,90",  original_price:"R$ 149,90", image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80", category:"Eletrônicos", platform:"shopee",       original_url:"#" },
  { id:"d2", title:"Tênis Running Ultra Boost", price:"R$ 249,99", original_price:"",          image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80", category:"Esportes",    platform:"mercadolivre", original_url:"#" },
  { id:"d3", title:"Camiseta Oversized Básica", price:"R$ 59,90",  original_price:"R$ 89,90",  image:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80", category:"Moda",       platform:"shopee",       original_url:"#" },
  { id:"d4", title:"Luminária LED Articulada",  price:"R$ 124,00", original_price:"",          image:"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&q=80", category:"Casa",       platform:"amazon",       original_url:"#" },
  { id:"d5", title:"Kit Skincare Hidratação",   price:"R$ 167,50", original_price:"R$ 220,00", image:"https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80", category:"Beleza",     platform:"amazon",       original_url:"#" },
  { id:"d6", title:"Smartwatch Fitness Band X", price:"R$ 199,90", original_price:"",          image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80", category:"Eletrônicos",platform:"mercadolivre", original_url:"#" },
];

async function fetchProductMeta(url) {
  let platform = "unknown";
  if (url.includes("shopee")) platform = "shopee";
  else if (url.includes("mercadolivre") || url.includes("mercadolibre")) platform = "mercadolivre";
  else if (url.includes("amazon")) platform = "amazon";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Busque o produto neste link: ${url}\n\nRetorne SOMENTE um JSON:\n{"title":"...","price":"R$ XX,XX","original_price":"R$ XX,XX se houver promoção, senão vazio","image":"url_imagem","category":"categoria","platform":"${platform}","original_url":"${url}"}\n\nSe não achar algum campo, use "".` }]
    })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  try {
    const m = text.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
    if (m) return { ...JSON.parse(m[0]), platform, id: crypto.randomUUID() };
  } catch {}
  return { id: crypto.randomUUID(), title: "Produto", price: "", original_price: "", image: "", category: "Outros", platform, original_url: url };
}

// ─── Shared input style factory ───────────────────────────────────────────────
const iStyle = (T, F) => ({
  width:"100%", boxSizing:"border-box", padding:"12px 14px",
  borderRadius:10, border:`2px solid ${T.border}`,
  fontSize:14, fontFamily:F.body, background:T.bg,
  color:T.text, outline:"none", transition:"border-color 0.2s"
});

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const T = THEMES.laranja;
  const F = FONT_PAIRS.moderna;
  const is = iStyle(T, F);

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) return setErr("Preencha e-mail e senha.");
    if (password.length < 6) return setErr("Senha deve ter pelo menos 6 caracteres.");
    setErr(""); setLoading(true);
    try {
      if (mode === "signup") {
        const d = await supa.signUp(email, password);
        if (d.user && !d.access_token) {
          setInfo("Confirmação enviada para seu e-mail. Verifique a caixa de entrada.");
        } else if (d.access_token) {
          onAuth(d.user);
        }
      } else {
        const d = await supa.signIn(email, password);
        onAuth(d.user);
      }
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <style>{`@import url('${F.import}'); * { box-sizing:border-box; } @keyframes spin { to { transform:rotate(360deg); } }`}</style>
      <div style={{ width:"100%", maxWidth:380 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:58, height:58, background:T.accentGrad, borderRadius:16, margin:"0 auto 12px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, color:"#fff", fontFamily:F.heading, fontWeight:800 }}>V</div>
          <h1 style={{ margin:0, fontFamily:F.heading, fontSize:24, fontWeight:800, color:T.text }}>Vitrine Afiliados</h1>
          <p style={{ margin:"5px 0 0", color:T.textSub, fontFamily:F.body, fontSize:13 }}>
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta grátis"}
          </p>
        </div>

        <div style={{ background:T.card, borderRadius:20, padding:26, boxShadow:"0 4px 30px rgba(0,0,0,0.08)" }}>

          {/* E-mail */}
          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.textSub, marginBottom:5, fontFamily:F.body, letterSpacing:0.6 }}>E-MAIL</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" type="email" style={is}
              onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.textSub, marginBottom:5, fontFamily:F.body, letterSpacing:0.6 }}>SENHA</label>
            <div style={{ position:"relative" }}>
              <input value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="signup"?"Mínimo 6 caracteres":"••••••••"} type={showPwd?"text":"password"} style={{ ...is, paddingRight:42 }}
                onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}
                onKeyDown={e=>e.key==="Enter"&&handleEmailAuth()} />
              <button type="button" onClick={()=>setShowPwd(v=>!v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:T.textSub, fontSize:15, padding:0, lineHeight:1 }}>
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {err && <p style={{ color:"#ef4444", fontSize:13, margin:"-4px 0 12px", fontFamily:F.body }}>{err}</p>}
          {info && <p style={{ color:"#16a34a", fontSize:13, margin:"-4px 0 12px", fontFamily:F.body }}>{info}</p>}

          <button onClick={handleEmailAuth} disabled={loading} style={{
            width:"100%", padding:13, background:loading?T.border:T.accentGrad,
            color:"#fff", border:"none", borderRadius:12, fontSize:14,
            fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:F.heading,
            display:"flex", alignItems:"center", justifyContent:"center", gap:8
          }}>
            {loading
              ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span>{mode==="signup"?"Criando conta...":"Entrando..."}</>
              : mode==="signup" ? "Criar conta" : "Entrar"}
          </button>

          {/* Toggle mode */}
          <p style={{ textAlign:"center", margin:"16px 0 0", fontSize:13, fontFamily:F.body, color:T.textSub }}>
            {mode==="login" ? "Não tem conta? " : "Já tem conta? "}
            <button onClick={()=>{ setMode(mode==="login"?"signup":"login"); setErr(""); setInfo(""); }}
              style={{ background:"none", border:"none", color:T.accent, cursor:"pointer", fontWeight:700, fontFamily:F.body, fontSize:13, padding:0 }}>
              {mode==="login" ? "Criar grátis" : "Entrar"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Setup (after first login) ───────────────────────────────────────
function ProfileSetup({ user, onSave }) {
  const [fields, setFields] = useState({ name: user.user_metadata?.full_name || "", username:"", bio:"", avatarFile:null, avatarPreview: user.user_metadata?.avatar_url || "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const T = THEMES.laranja; const F = FONT_PAIRS.moderna;
  const is = iStyle(T, F);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFields(prev => ({ ...prev, avatarFile:f, avatarPreview:URL.createObjectURL(f) }));
  }

  async function handle() {
    if (!fields.name.trim() || !fields.username.trim()) return setErr("Nome e usuário são obrigatórios.");
    const slug = fields.username.trim().toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9_]/g,"");
    if (!slug) return setErr("Usuário inválido.");
    setLoading(true);
    try {
      const existing = await supa.getProfileByUsername(slug);
      if (existing) { setErr("Esse usuário já está em uso."); setLoading(false); return; }

      const profile = await supa.createProfile({ user_id: user.id, username:slug, name:fields.name.trim(), bio:fields.bio.trim(), theme:"laranja", fonts:"moderna", show_emoji:false });
      let avatarUrl = fields.avatarPreview && !fields.avatarFile ? fields.avatarPreview : "";
      if (fields.avatarFile && profile?.id) {
        try { avatarUrl = await supa.uploadAvatar(user.id, fields.avatarFile); await supa.updateProfile(profile.id, { avatar_url:avatarUrl }); } catch {}
      }
      onSave({ ...profile, avatar_url: avatarUrl });
    } catch(e) { setErr("Erro ao criar perfil."); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <style>{`@import url('${F.import}'); * { box-sizing:border-box; } @keyframes spin { to { transform:rotate(360deg); } }`}</style>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <h1 style={{ margin:0, fontFamily:F.heading, fontSize:22, fontWeight:800, color:T.text }}>Configure sua vitrine</h1>
          <p style={{ margin:"5px 0 0", color:T.textSub, fontFamily:F.body, fontSize:13 }}>Só mais um passo</p>
        </div>
        <div style={{ background:T.card, borderRadius:20, padding:26, boxShadow:"0 4px 30px rgba(0,0,0,0.08)" }}>

          {/* Avatar */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:20 }}>
            <div onClick={()=>fileRef.current.click()} style={{ width:80, height:80, borderRadius:"50%", border:`2px dashed ${T.border}`, cursor:"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, position:"relative" }}>
              {fields.avatarPreview
                ? <img src={fields.avatarPreview} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                : <span style={{ fontSize:28, color:T.textSub }}>+</span>}
            </div>
            <span style={{ marginTop:6, fontSize:11, color:T.textSub, fontFamily:F.body }}>Foto de perfil (opcional)</span>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
          </div>

          {[
            { label:"SEU NOME *", key:"name", ph:"Ex: João Silva" },
            { label:"USUÁRIO * (link: /u/username)", key:"username", ph:"Ex: joaosilva" },
            { label:"BIO (opcional)", key:"bio", ph:"Ex: Melhores achados do ML e Shopee" },
          ].map(({ label, key, ph }) => (
            <div key={key} style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.textSub, marginBottom:5, fontFamily:F.body, letterSpacing:0.6 }}>{label}</label>
              <input value={fields[key]||""} onChange={e=>setFields(f=>({...f,[key]:e.target.value}))} placeholder={ph} style={is}
                onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border} />
            </div>
          ))}

          {err && <p style={{ color:"#ef4444", fontSize:13, margin:"-4px 0 10px", fontFamily:F.body }}>{err}</p>}
          <button onClick={handle} disabled={loading} style={{ width:"100%", padding:13, background:loading?T.border:T.accentGrad, color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:F.heading, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {loading ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span>Salvando...</> : "Entrar na vitrine →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Avatar component ─────────────────────────────────────────────────────────
function Avatar({ name, size=52, T, F }) {
  const initials = name?.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"?";
  return <div style={{ width:size, height:size, borderRadius:"50%", background:T.accentGrad, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:size*0.35, fontFamily:F.heading, flexShrink:0 }}>{initials}</div>;
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onDelete, isOwner, T, F, showEmoji }) {
  const plt = platformConfig[product.platform] || platformConfig.unknown;
  const [imgErr, setImgErr] = useState(false);
  const hasPromo = product.original_price && product.original_price !== product.price;
  return (
    <div style={{ background:T.card, borderRadius:14, overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.07)", transition:"transform 0.18s, box-shadow 0.18s", position:"relative" }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.13)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,0.07)";}}>
      <div style={{ position:"relative", paddingBottom:"100%", background:T.border, overflow:"hidden" }}>
        {product.image && !imgErr
          ? <img src={product.image} alt={product.title} onError={()=>setImgErr(true)} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
          : <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, color:T.textSub }}>▣</div>}
        <span style={{ position:"absolute", top:7, left:7, background:plt.bg, color:plt.text||plt.color, fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, border:`1.5px solid ${plt.color}`, fontFamily:F.body }}>{plt.label}</span>
        {hasPromo && <span style={{ position:"absolute", top:7, right:isOwner?36:7, background:T.promo, color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, fontFamily:F.body }}>OFERTA</span>}
        {isOwner && <button onClick={e=>{e.stopPropagation();onDelete(product.id);}} style={{ position:"absolute", top:7, right:7, background:"rgba(0,0,0,0.55)", border:"none", borderRadius:"50%", width:24, height:24, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>✕</button>}
      </div>
      <a href={product.original_url||"#"} target="_blank" rel="noreferrer" style={{ textDecoration:"none", color:"inherit" }}>
        <div style={{ padding:"10px 12px 12px" }}>
          <p style={{ margin:0, fontSize:13, fontWeight:600, color:T.text, fontFamily:F.heading, lineHeight:1.35, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{product.title}</p>
          <div style={{ marginTop:5, display:"flex", alignItems:"baseline", gap:5, flexWrap:"wrap" }}>
            {product.price && <span style={{ fontSize:15, fontWeight:800, color:T.accent, fontFamily:F.heading }}>{product.price}</span>}
            {hasPromo && <span style={{ fontSize:11, color:T.textSub, textDecoration:"line-through", fontFamily:F.body }}>{product.original_price}</span>}
          </div>
          {product.category && <span style={{ display:"inline-block", marginTop:5, fontSize:10, color:T.textSub, background:T.chipBg, padding:"2px 7px", borderRadius:10, fontFamily:F.body }}>{showEmoji?`${CAT_EMOJI[product.category]||"□"} `:""}{product.category}</span>}
        </div>
      </a>
    </div>
  );
}

// ─── Appearance Panel ─────────────────────────────────────────────────────────
function AppearancePanel({ theme, fonts, showEmoji, onChange, onClose, T, F }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200, backdropFilter:"blur(4px)" }}>
      <div style={{ background:T.card, borderRadius:"20px 20px 0 0", padding:"24px 20px 36px", width:"100%", maxWidth:500, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ margin:0, fontFamily:F.heading, fontSize:18, fontWeight:800, color:T.text }}>Aparência</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:T.textSub }}>✕</button>
        </div>
        <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:T.textSub, fontFamily:F.body, letterSpacing:0.8 }}>COR DO TEMA</p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:24 }}>
          {Object.entries(THEMES).map(([key,t])=>(
            <button key={key} onClick={()=>onChange("theme",key)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, background:"none", border:"none", cursor:"pointer", padding:0 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:t.accentGrad, border:theme===key?`3.5px solid ${T.text}`:"3.5px solid transparent", boxSizing:"border-box", transition:"border 0.15s" }} />
              <span style={{ fontSize:10, fontFamily:F.body, color:T.textSub, fontWeight:theme===key?700:400 }}>{t.label}</span>
            </button>
          ))}
        </div>
        <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:T.textSub, fontFamily:F.body, letterSpacing:0.8 }}>JOGO DE FONTES</p>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
          {Object.entries(FONT_PAIRS).map(([key,fp])=>(
            <button key={key} onClick={()=>onChange("fonts",key)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderRadius:11, cursor:"pointer", background:fonts===key?T.accentGrad:T.chipBg, border:"none", transition:"all 0.15s" }}>
              <div style={{ textAlign:"left" }}>
                <span style={{ display:"block", fontFamily:fp.heading, fontSize:15, fontWeight:700, color:fonts===key?"#fff":T.text }}>{fp.label}</span>
                <span style={{ display:"block", fontFamily:fp.body, fontSize:11, color:fonts===key?"rgba(255,255,255,0.7)":T.textSub, marginTop:2 }}>{fp.desc}</span>
              </div>
              {fonts===key && <span style={{ color:"#fff" }}>✓</span>}
            </button>
          ))}
        </div>
        <p style={{ margin:"0 0 10px", fontSize:11, fontWeight:700, color:T.textSub, fontFamily:F.body, letterSpacing:0.8 }}>ICONES</p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:T.chipBg, borderRadius:11 }}>
          <div>
            <span style={{ display:"block", fontFamily:F.body, fontSize:14, fontWeight:600, color:T.text }}>Mostrar emojis nas categorias</span>
            <span style={{ display:"block", fontFamily:F.body, fontSize:12, color:T.textSub, marginTop:2 }}>Ativa ícones no menu e nos cards</span>
          </div>
          <div onClick={()=>onChange("showEmoji",!showEmoji)} style={{ width:44, height:24, borderRadius:12, cursor:"pointer", background:showEmoji?T.accent:T.border, position:"relative", transition:"background 0.2s", flexShrink:0, marginLeft:12 }}>
            <div style={{ position:"absolute", top:3, left:showEmoji?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Product Modal ────────────────────────────────────────────────────────
function AddProductModal({ onAdd, onClose, T, F }) {
  const [url, setUrl] = useState("");
  const [manualCat, setManualCat] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const is = iStyle(T, F);

  async function handle() {
    if (!url.trim()) return setErr("Cole o link do produto.");
    const valid = url.includes("shopee")||url.includes("mercadolivre")||url.includes("mercadolibre")||url.includes("amazon");
    if (!valid) return setErr("Use links da Shopee, Mercado Livre ou Amazon.");
    setErr(""); setLoading(true);
    try {
      const p = await fetchProductMeta(url.trim());
      if (manualCat) p.category = manualCat;
      onAdd(p); onClose();
    } catch { setErr("Não foi possível buscar o produto."); }
    setLoading(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:16, backdropFilter:"blur(4px)" }}>
      <div style={{ background:T.card, borderRadius:20, padding:26, width:"100%", maxWidth:400 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ margin:0, fontFamily:F.heading, fontSize:18, fontWeight:800, color:T.text }}>Adicionar Produto</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:T.textSub }}>✕</button>
        </div>
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.textSub, marginBottom:5, fontFamily:F.body, letterSpacing:0.6 }}>LINK DO PRODUTO *</label>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Shopee, Mercado Livre ou Amazon" style={is}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border} />
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.textSub, margin:"14px 0 5px", fontFamily:F.body, letterSpacing:0.6 }}>CATEGORIA (opcional)</label>
        <select value={manualCat} onChange={e=>setManualCat(e.target.value)} style={{ ...is, cursor:"pointer" }}>
          <option value="">Detectar automaticamente</option>
          {["Eletrônicos","Moda","Casa","Beleza","Esportes","Brinquedos","Livros","Alimentos","Outros"].map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        {err && <p style={{ color:"#ef4444", fontSize:13, margin:"10px 0 0", fontFamily:F.body }}>{err}</p>}
        <button onClick={handle} disabled={loading} style={{ width:"100%", marginTop:18, padding:13, background:loading?T.border:T.accentGrad, color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:F.heading, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {loading?<><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span>Buscando...</>:"Adicionar à vitrine"}
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser]   = useState(null);   // Supabase auth user
  const [profile, setProfile]     = useState(null);   // app profile row
  const [authReady, setAuthReady] = useState(false);  // finished checking session
  const [products, setProducts]   = useState(DEMO_PRODUCTS);
  const [search, setSearch]       = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [theme, setTheme]     = useState("laranja");
  const [fonts, setFonts]     = useState("moderna");
  const [showEmoji, setShowEmoji] = useState(false);

  const T = THEMES[theme];
  const F = FONT_PAIRS[fonts];

  // ── Restore session on load ──
  useEffect(() => {
    async function restoreSession() {
      // Try stored token
      const storedToken = localStorage.getItem("sb_token");
      const storedRefresh = localStorage.getItem("sb_refresh");
      if (storedToken) {
        supa._token = storedToken;
        const user = await supa.getUser(storedToken);
        if (user?.id) { supa._userId = user.id; await loadProfile(user); return; }
        supa._token = null;
        // Token expired, try refresh
        if (storedRefresh) {
          const d = await supa.refreshSession(storedRefresh);
          if (d.user) { await loadProfile(d.user); return; }
        }
      }
      setAuthReady(true);
    }
    restoreSession();
  }, []);

  async function loadProfile(user) {
    setAuthUser(user);
    const p = await supa.getProfileByUser(user.id);
    if (p) {
      setProfile(p);
      setTheme(p.theme || "laranja");
      setFonts(p.fonts || "moderna");
      setShowEmoji(p.show_emoji || false);
      const prods = await supa.getProducts(p.id);
      if (prods?.length) setProducts(prods);
      else setProducts([]);
    }
    setAuthReady(true);
  }

  // Sync appearance to DB
  useEffect(() => {
    if (!profile?.id) return;
    const t = setTimeout(() => supa.updateProfile(profile.id, { theme, fonts, show_emoji:showEmoji }), 800);
    return () => clearTimeout(t);
  }, [theme, fonts, showEmoji]);

  function handleAppearance(key, val) {
    if (key==="theme") setTheme(val);
    if (key==="fonts") setFonts(val);
    if (key==="showEmoji") setShowEmoji(val);
  }

  async function handleAddProduct(p) {
    const row = { profile_id:profile.id, title:p.title, price:p.price, original_price:p.original_price||"", image:p.image, category:p.category, platform:p.platform, original_url:p.original_url||p.originalUrl||"" };
    try {
      const saved = await supa.addProduct(row);
      setProducts(prev => [saved||{...row,id:p.id}, ...prev]);
    } catch { setProducts(prev => [{...p},...prev]); }
  }

  async function handleDeleteProduct(id) {
    setProducts(prev => prev.filter(x=>x.id!==id));
    if (!id.toString().startsWith("d")) { try { await supa.deleteProduct(id); } catch {} }
  }

  function handleSignOut() {
    supa.signOut();
    setAuthUser(null); setProfile(null);
    setProducts(DEMO_PRODUCTS);
  }

  const allCategories = ["Todos", ...Array.from(new Set(products.map(p=>p.category).filter(Boolean)))];
  const filtered = products.filter(p => {
    const matchCat = activeCategory==="Todos"||p.category===activeCategory;
    const matchSearch = !search||p.title.toLowerCase().includes(search.toLowerCase())||p.category?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Loading ──
  if (!authReady) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f9f8f6" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:36, animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</div>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  // ── Not logged in ──
  if (!authUser) return <AuthScreen onAuth={user => loadProfile(user)} />;

  // ── Logged in but no profile yet ──
  if (!profile) return <ProfileSetup user={authUser} onSave={p => { setProfile(p); setProducts([]); }} />;

  // ── Main storefront ──
  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:F.body }}>
      <style>{`
        @import url('${F.import}');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:${T.scrollThumb}; border-radius:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ background:T.header, borderBottom:`1px solid ${T.border}`, padding:"18px 16px 0", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:640, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.name} style={{ width:50, height:50, borderRadius:"50%", objectFit:"cover", border:`2.5px solid ${T.accent}`, flexShrink:0 }} onError={e=>e.target.style.display="none"} />
              : <Avatar name={profile.name} T={T} F={F} />}
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ margin:0, fontFamily:F.heading, fontSize:17, fontWeight:800, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{profile.name}</h1>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:1 }}>
                <span style={{ fontSize:11, color:T.accent, fontWeight:600, fontFamily:F.body }}>vitrine.app/u/{profile.username}</span>
                <button onClick={()=>navigator.clipboard?.writeText(`vitrine.app/u/${profile.username}`)} title="Copiar link" style={{ background:"none", border:"none", cursor:"pointer", color:T.textSub, fontSize:13, padding:2 }}>⎘</button>
              </div>
              {profile.bio && <p style={{ margin:"2px 0 0", fontSize:11, color:T.textSub, fontFamily:F.body, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{profile.bio}</p>}
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button onClick={()=>setShowAppearance(true)} title="Aparência" style={{ background:T.chipBg, border:"none", borderRadius:10, padding:"9px 11px", cursor:"pointer", color:T.text, fontSize:14 }}>◑</button>
              <button onClick={()=>setShowAddModal(true)} style={{ background:T.accentGrad, color:"#fff", border:"none", borderRadius:10, padding:"9px 13px", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:F.heading, whiteSpace:"nowrap" }}>+ Produto</button>
            </div>
          </div>

          <div style={{ display:"flex", gap:16, marginBottom:12 }}>
            <span style={{ fontSize:12, color:T.textSub, fontFamily:F.body }}><strong style={{ color:T.text, fontFamily:F.heading }}>{products.length}</strong> produtos</span>
            <span style={{ fontSize:12, color:T.textSub, fontFamily:F.body }}><strong style={{ color:T.text, fontFamily:F.heading }}>{allCategories.length-1}</strong> categorias</span>
            <button onClick={handleSignOut} style={{ marginLeft:"auto", background:"none", border:"none", fontSize:11, color:T.textSub, cursor:"pointer", fontFamily:F.body }}>Sair</button>
          </div>

          <div style={{ position:"relative", marginBottom:12 }}>
            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:T.textSub, fontSize:14, pointerEvents:"none" }}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produtos..."
              style={{ width:"100%", padding:"10px 13px 10px 32px", borderRadius:10, border:`2px solid ${T.border}`, fontSize:14, fontFamily:F.body, background:T.bg, color:T.text, outline:"none", transition:"border-color 0.2s" }}
              onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border} />
          </div>

          <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:14, scrollbarWidth:"none" }}>
            {allCategories.map(cat=>(
              <button key={cat} onClick={()=>setActiveCategory(cat)} style={{ whiteSpace:"nowrap", padding:"6px 13px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:activeCategory===cat?700:500, fontFamily:F.body, flexShrink:0, transition:"all 0.15s", background:activeCategory===cat?T.chipActive:T.chipBg, color:activeCategory===cat?T.chipActiveText:T.textSub }}>
                {showEmoji?`${CAT_EMOJI[cat]||"□"} `:""}{cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth:640, margin:"0 auto", padding:"14px 14px 48px" }}>
        {filtered.length===0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <p style={{ fontFamily:F.heading, fontSize:16, fontWeight:700, color:T.textSub, margin:"0 0 4px" }}>{search?"Nenhum produto encontrado":"Nenhum produto ainda"}</p>
            <p style={{ fontFamily:F.body, fontSize:13, color:T.border, margin:0 }}>{search?`Sem resultados para "${search}"`:"Adicione produtos pela vitrine"}</p>
            {!search && <button onClick={()=>setShowAddModal(true)} style={{ marginTop:14, background:T.accentGrad, color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontFamily:F.heading, fontWeight:700, fontSize:13 }}>Adicionar primeiro produto</button>}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {filtered.map((product,i)=>(
              <div key={product.id} style={{ animation:`fadeUp 0.3s ease ${i*0.04}s both` }}>
                <ProductCard product={product} onDelete={handleDeleteProduct} isOwner={true} T={T} F={F} showEmoji={showEmoji} />
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && <AddProductModal onAdd={handleAddProduct} onClose={()=>setShowAddModal(false)} T={T} F={F} />}
      {showAppearance && <AppearancePanel theme={theme} fonts={fonts} showEmoji={showEmoji} onChange={handleAppearance} onClose={()=>setShowAppearance(false)} T={T} F={F} />}
    </div>
  );
}
