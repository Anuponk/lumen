// #725/#728: Adventure pricing (owner decision, 15/11/2026), EUR cents incl. VAT.
// Single source for the client display and the server seed (scripts/adventure-store-seed.mjs).
// The server stays authoritative for what a payment grants.
export const ADVENTURE_PRICE_CENTS=100;
export const SKY_PRICE_CENTS=500;
export const SKY_PRODUCT_ID='real-sky-all';
// #865: « Tout débloquer » after N=1..4 confirmed unit purchases. The server picks the
// tier (lumen_get_main_sky_purchase_progress.sky_offer) and owns its price and activation.
export const SKY_UPGRADE_PRODUCT_IDS=Object.freeze([1,2,3,4].map(n=>'real-sky-upgrade-'+n));
export function isMainSkyProduct(id){return id===SKY_PRODUCT_ID||SKY_UPGRADE_PRODUCT_IDS.includes(id)}
export function formatEuros(cents){
 const value=Number(cents)/100;
 return (Number.isInteger(value)?String(value):value.toFixed(2).replace('.',','))+' €';
}
