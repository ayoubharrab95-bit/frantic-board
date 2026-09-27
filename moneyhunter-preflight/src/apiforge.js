const SERVICES=[{id:'bounty-preflight',price_usd:.05,unit:'request'},{id:'payment-reliability',price_usd:.03,unit:'request'},{id:'website-audit',price_usd:.05,unit:'request'},{id:'lead-score',price_usd:.03,unit:'request'}];
export function apiCatalog(){return SERVICES.map(x=>({...x}));}
export function apiEconomics(calls=10000){const n=Math.max(0,Number(calls)||0);return SERVICES.map(x=>({...x,calls:n,gross_usd:Number((n*x.price_usd).toFixed(2))}));}
