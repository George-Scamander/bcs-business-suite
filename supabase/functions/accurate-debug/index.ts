// 測試：找出正確的 pvt1 節點 + 確認 Supabase IP
const TOKEN = Deno.env.get("ACCURATE_TOKEN")!;
const SECRET = Deno.env.get("ACCURATE_SIGNATURE_SECRET")!;

async function sig(ts: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts));
  return btoa(String.fromCharCode(...new Uint8Array(s)));
}

async function test(label: string, url: string, headers: Record<string, string>) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    return { label, status: r.status, body: (await r.text()).slice(0, 200) };
  } catch (e) { return { label, status: "ERR", body: String(e).slice(0, 100) }; }
}

Deno.serve(async () => {
  const ts = String(Date.now());
  const s = await sig(ts);
  const h = { Authorization: `Bearer ${TOKEN}`, "X-Session-ID": TOKEN, "X-Api-Timestamp": ts, "X-Api-Signature": s };

  // 取得 Supabase Edge Function 自己的出口 IP
  let myIp = "unknown";
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    myIp = (await r.json() as { ip: string }).ip;
  } catch (_) { /* ignore */ }

  // DNS 查詢
  const dnsResults: Record<string, string> = {};
  for (const host of ["public.accurate.id", "d1841595.pvt1.accurate.id", "pvt1.accurate.id"]) {
    try {
      const r = await Deno.resolveDns(host, "A");
      dnsResults[host] = r.join(", ");
    } catch (e) { dnsResults[host] = String(e); }
  }

  // 測試 pvt1 上不同節點 (pvt1, pvt2, pvt3) 和不同 subdomain 格式
  const nodes = await Promise.all([
    test("pvt1.accurate.id /accurate/api/salesInvoice/list.do",
      "https://pvt1.accurate.id/accurate/api/salesInvoice/list.do?page=1&pageSize=2", h),
    test("pvt2.accurate.id /accurate/api/salesInvoice/list.do",
      "https://pvt2.accurate.id/accurate/api/salesInvoice/list.do?page=1&pageSize=2", h),
    test("pvt3.accurate.id /accurate/api/salesInvoice/list.do",
      "https://pvt3.accurate.id/accurate/api/salesInvoice/list.do?page=1&pageSize=2", h),
    test("d1841595.pvt1 /accurate/api (no .do)",
      "https://d1841595.pvt1.accurate.id/accurate/api/salesInvoice/list?page=1&pageSize=2", h),
    // 用 public.accurate.id IP 直接連接
    test("202.78.195.211 直連 (with Host header)",
      "https://202.78.195.211/accurate/api/salesInvoice/list.do?page=1&pageSize=2",
      { ...h, Host: "public.accurate.id" }),
  ]);

  return new Response(JSON.stringify({ myIp, dnsResults, nodes }, null, 2), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
