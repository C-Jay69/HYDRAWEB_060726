"""Sample generated site used when no LLM key is configured or mock mode is on.

Keeps the whole platform exercisable end-to-end without external dependencies.
"""

SAMPLE_SITE = {
    "summary": "A modern dark-mode SaaS landing page with a hero, features grid, pricing, and a newsletter form.",
    "html": """<section class="hero">
  <div class="badge">New · HydraWeb 2.0</div>
  <h1>Build websites <span>with AI</span></h1>
  <p class="sub">Describe what you want. Get a production-ready site with a backend and database. Iterate together.</p>
  <div class="actions">
    <button class="btn primary">Start building</button>
    <button class="btn ghost">View live demo</button>
  </div>
</section>
<section class="features">
  <h2>Everything you need to ship</h2>
  <div class="grid">
    <div class="card"><h3>AI generation</h3><p>Natural-language prompts become full-stack apps.</p></div>
    <div class="card"><h3>Vibe coding</h3><p>Refine code with an AI pair in real time.</p></div>
    <div class="card"><h3>One-click deploy</h3><p>Go live on your own subdomain in seconds.</p></div>
    <div class="card"><h3>Team workspaces</h3><p>Invite editors and viewers to collaborate.</p></div>
    <div class="card"><h3>Version control</h3><p>Every change saved. Roll back anytime.</p></div>
    <div class="card"><h3>Stripe billing</h3><p>Subscriptions and one-time payments built in.</p></div>
  </div>
</section>
<section class="pricing">
  <h2>Simple pricing</h2>
  <div class="grid">
    <div class="card"><h3>Free</h3><p class="price">$0</p><p>1 project, 100 requests/min</p><button class="btn ghost">Get started</button></div>
    <div class="card featured"><h3>Pro</h3><p class="price">$20</p><p>10 projects, priority model access</p><button class="btn primary">Start trial</button></div>
    <div class="card"><h3>Enterprise</h3><p class="price">$100</p><p>Unlimited projects, SSO, support</p><button class="btn ghost">Contact sales</button></div>
  </div>
</section>
<section class="cta">
  <h2>Start building today</h2>
  <form class="newsletter">
    <input type="email" placeholder="you@company.com" aria-label="Email" />
    <button class="btn primary" type="submit">Get started</button>
  </form>
</section>
<footer><p>© 2026 HydraWeb. Built with AI.</p></footer>""",
    "css": """:root{--bg:#0a0a12;--card:#151523;--text:#f4f4f7;--muted:#9b9bb0;--accent:#7c5cff;--accent2:#00c2a8}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
section{max-width:1100px;margin:0 auto;padding:72px 24px}
.hero{text-align:center;padding-top:120px}
.badge{display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(124,92,255,.15);color:var(--accent);font-size:13px;font-weight:600;border:1px solid rgba(124,92,255,.3)}
h1{font-size:clamp(2.4rem,6vw,4rem);margin:20px 0 12px;letter-spacing:-.03em}
h1 span{background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--muted);max-width:560px;margin:0 auto;font-size:1.15rem}
.actions{display:flex;gap:14px;justify-content:center;margin-top:32px;flex-wrap:wrap}
.btn{padding:13px 26px;border-radius:12px;border:none;cursor:pointer;font-size:15px;font-weight:600;transition:transform .15s,opacity .15s}
.btn:hover{transform:translateY(-2px);opacity:.92}
.btn.primary{background:linear-gradient(90deg,var(--accent),var(--accent2));color:#fff}
.btn.ghost{background:rgba(255,255,255,.06);color:var(--text);border:1px solid rgba(255,255,255,.12)}
h2{font-size:clamp(1.6rem,4vw,2.4rem);text-align:center;margin-bottom:40px;letter-spacing:-.02em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.card{background:var(--card);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px}
.card h3{font-size:1.15rem;margin-bottom:10px}
.card p{color:var(--muted);font-size:14px}
.card.featured{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.price{font-size:2.2rem;font-weight:800;color:#fff}
.card .btn{margin-top:16px;width:100%}
.newsletter{display:flex;gap:12px;justify-content:center;max-width:460px;margin:0 auto;flex-wrap:wrap}
.newsletter input{flex:1;min-width:220px;padding:13px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;font-size:15px}
footer{text-align:center;color:var(--muted);padding:32px;font-size:14px}
@media(max-width:640px){section{padding:48px 18px}.hero{padding-top:80px}}""",
    "js": """document.querySelector('.newsletter')?.addEventListener('submit', function (e) {
  e.preventDefault();
  var input = this.querySelector('input[type="email"]');
  var btn = this.querySelector('button');
  if (!input || !input.value) return;
  var original = btn.textContent;
  btn.textContent = 'Thanks! 🎉';
  btn.disabled = true;
  setTimeout(function () { btn.textContent = original; btn.disabled = false; input.value = ''; }, 2500);
});

document.querySelectorAll('.card .btn').forEach(function (btn) {
  btn.addEventListener('click', function () { window.location.href = '/login'; });
});""",
    "backend": {
        "main.py": """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="HydraWeb generated API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class NewsletterSignup(BaseModel):
    email: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/newsletter")
def newsletter(signup: NewsletterSignup):
    return {"ok": True, "email": signup.email}
""",
        "requirements.txt": "fastapi\nuvicorn[standard]\npydantic\n",
    },
    "db_schema": """CREATE TABLE newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);""",
}


def get_sample_site(prompt: str) -> dict:
    return {**SAMPLE_SITE, "summary": f"Sample site (mock mode) generated for prompt: {prompt}"}
