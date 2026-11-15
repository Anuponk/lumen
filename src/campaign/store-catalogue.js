// #725/#728: Adventure pricing (owner decision, 15/11/2026), EUR cents incl. VAT.
// Single source for the client display and the server seed (scripts/adventure-store-seed.mjs).
// The server stays authoritative for what a payment grants.
export const ADVENTURE_PRICE_CENTS=100;
export const SKY_PRICE_CENTS=500;
export const SKY_PRODUCT_ID='real-sky-all';
export function formatEuros(cents){
 const value=Number(cents)/100;
 return (Number.isInteger(value)?String(value):value.toFixed(2).replace('.',','))+' €';
}
