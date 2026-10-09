import {CONSTELLATION_PREVIEW_CATALOGUE} from "../src/campaign/constellation-preview.js";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function renderConstellationPreviewHtml(entries=CONSTELLATION_PREVIEW_CATALOGUE){
 const cards=entries.map(c=>{
  const lines=c.edges.map(([a,b])=>{
   const p=c.points[a],q=c.points[b];
   return '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+q[0]+'" y2="'+q[1]+'" />';
  }).join("");
  const stars=c.points.map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="2.6" />').join("");
  return '<article class="card" data-published="'+c.published+'"><svg viewBox="0 0 280 120" role="img" aria-label="Silhouette de '+esc(c.name)+'"><g class="links">'+lines+'</g><g class="stars">'+stars+'</g></svg><div class="meta"><strong>'+esc(c.name)+'</strong><small>'+(c.published?'Dans le jeu':'À venir')+'</small></div></article>';
 }).join("");
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumen - aperçu des 88 constellations</title><style>body{margin:0;background:#0b1024;color:#f5f4ff;font-family:system-ui,sans-serif;padding:24px}header{max-width:1100px;margin:auto auto 24px}h1{font-size:clamp(1.5rem,4vw,2.4rem)}p{color:#c2c8df}.grid{max-width:1100px;margin:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(225px,1fr));gap:16px}.card{background:#161e38;border:1px solid #34405f;border-radius:14px;overflow:hidden}.card svg{width:100%;height:auto;background:radial-gradient(circle at center,#22305c,#0b1024)}.links{stroke:#7c9bdf;stroke-width:1.3}.stars{fill:#fff5c8}.meta{display:flex;justify-content:space-between;gap:8px;padding:12px}.meta small{color:#a6b5d9}footer{max-width:1100px;margin:30px auto;color:#a6b5d9;font-size:.8rem}</style></head><body><header><h1>Les 88 constellations de Lumen</h1><p>24 constellations déjà dans le jeu et 64 nouvelles silhouettes en préparation. Aperçu uniquement : aucune quête ni progression modifiée.</p></header><main class="grid">'+cards+'</main><footer>Tracés supplémentaires adaptés de d3-celestial (Olaf Frohn et contributeurs). Vérification des droits de données avant publication commerciale.</footer></body></html>';
}
