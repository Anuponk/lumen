// #740: « Crédits et sources » in the account menu (not in Mon ciel).
// The attribution required by CC BY-SA must be visible to every player,
// guest or signed in, before the Google Play publication.
export const CREDITS_ATTRIBUTION="Données de constellations Western © équipe Stellarium, CC BY-SA ; coordonnées stellaires Hipparcos II (ESA) via CDS VizieR. Projection et adaptation pour Lumen.";
export const CREDITS_LINKS=Object.freeze({
 stellarium:"https://github.com/Stellarium/stellarium-skycultures/blob/92df9e4c48c7a3b21d4b0cfc6ce088dd8ce2f2df/western/description.md",
 licence:"https://creativecommons.org/licenses/by-sa/4.0/deed.fr",
 hipparcos:"https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I%2F311%2Fhip2",
 attribution:"https://github.com/Anuponk/lumen/blob/main/docs/ASTRONOMY_DATA_ATTRIBUTION.md"
});
export function setupCredits(doc=document){
 const toggle=doc.getElementById("showCredits"),panel=doc.getElementById("creditsPanel"),close=doc.getElementById("closeCredits");
 if(!toggle||!panel)return false;
 const set=open=>{panel.hidden=!open;toggle.setAttribute("aria-expanded",String(open))};
 toggle.addEventListener("click",()=>set(panel.hidden));
 close?.addEventListener("click",()=>{set(false);toggle.focus()});
 return true;
}
