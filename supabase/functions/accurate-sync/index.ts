import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ACCURATE_TOKEN = Deno.env.get("ACCURATE_TOKEN")!;
const ACCURATE_SIGNATURE_SECRET = Deno.env.get("ACCURATE_SIGNATURE_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const API_BASE = "https://d1841595.pvt1.accurate.id/api";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── HMAC-SHA256 簽名 ─────────────────────────────────────────────────────────

async function makeSignature(timestamp: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ACCURATE_SIGNATURE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function getHeaders(): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  return {
    Authorization: `Bearer ${ACCURATE_TOKEN}`,
    "X-Api-Timestamp": timestamp,
    "X-Api-Signature": await makeSignature(timestamp),
    "Content-Type": "application/json",
  };
}

// ── Accurate API 工具 ─────────────────────────────────────────────────────────

async function accurateGet(
  path: string,
  params: Record<string, string | number> = {},
): Promise<Record<string, unknown>> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const resp = await fetch(url.toString(), {
    headers: await getHeaders(),
  });

  if (!resp.ok) {
    throw new Error(`Accurate API ${path} → HTTP ${resp.status}`);
  }
  const data = await resp.json() as Record<string, unknown>;
  if (!data.s) {
    const msg = Array.isArray(data.d) ? (data.d as string[]).join(", ") : String(data.d ?? "unknown");
    throw new Error(`Accurate error: ${msg}`);
  }
  return data;
}

async function fetchAllPages(
  path: string,
  extra: Record<string, string> = {},
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const data = await accurateGet(path, { page, pageSize: 100, ...extra });
    const d = data.d as Record<string, unknown>;
    const records = (d?.data ?? []) as Record<string, unknown>[];
    all.push(...records);
    const totalPages = (d?.pageCount as number) ?? 1;
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

// ── 工具函數 ─────────────────────────────────────────────────────────────────

function safeDecimal(v: unknown): number | null {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? null : n;
}

function safeDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

function now(): string {
  return new Date().toISOString();
}

// ── 5 個同步函數 ──────────────────────────────────────────────────────────────

async function syncSalesInvoices(): Promise<number> {
  const records = await fetchAllPages("salesInvoice/list");
  const rows = await Promise.all(records.map(async (r) => ({
    id: String(r.id ?? await sha256hex(`si|${r.number}`)),
    invoice_no: String(r.number ?? ""),
    customer_name: r.customerName ?? null,
    customer_id: r.customerId ? String(r.customerId) : null,
    branch_name: r.branchName ?? null,
    transaction_date: safeDate(r.transDate),
    due_date: safeDate(r.dueDate),
    total_amount: safeDecimal(r.totalAmount),
    tax_amount: safeDecimal(r.taxAmount),
    paid_amount: safeDecimal(r.paidAmount),
    outstanding_amount: safeDecimal(r.remainingAmount),
    status: r.paymentStatus ?? r.status ?? null,
    currency_code: (r.currency as Record<string, unknown>)?.code ?? "IDR",
    note: r.note ?? null,
    raw_data: r,
    synced_at: now(),
    updated_at: now(),
  })));
  if (rows.length) {
    await supabase.from("accurate_sales_invoices").upsert(rows, { onConflict: "id" });
  }
  return rows.length;
}

async function syncPurchaseInvoices(): Promise<number> {
  const records = await fetchAllPages("purchaseInvoice/list");
  const rows = await Promise.all(records.map(async (r) => ({
    id: String(r.id ?? await sha256hex(`pi|${r.number}`)),
    invoice_no: String(r.number ?? ""),
    vendor_name: r.vendorName ?? null,
    vendor_id: r.vendorId ? String(r.vendorId) : null,
    branch_name: r.branchName ?? null,
    transaction_date: safeDate(r.transDate),
    due_date: safeDate(r.dueDate),
    total_amount: safeDecimal(r.totalAmount),
    tax_amount: safeDecimal(r.taxAmount),
    paid_amount: safeDecimal(r.paidAmount),
    outstanding_amount: safeDecimal(r.remainingAmount),
    status: r.paymentStatus ?? r.status ?? null,
    currency_code: (r.currency as Record<string, unknown>)?.code ?? "IDR",
    note: r.note ?? null,
    raw_data: r,
    synced_at: now(),
    updated_at: now(),
  })));
  if (rows.length) {
    await supabase.from("accurate_purchase_invoices").upsert(rows, { onConflict: "id" });
  }
  return rows.length;
}

async function syncInventory(): Promise<number> {
  const records = await fetchAllPages("item/list", {
    fields: "id,no,name,categoryName,unitName,availableStock,minStock,buyPrice,sellPrice,warehouseName,branchName",
  });
  const rows = await Promise.all(records.map(async (r) => ({
    id: String(r.id ?? await sha256hex(`item|${r.no}`)),
    item_code: r.no ?? null,
    item_name: String(r.name ?? ""),
    category: r.categoryName ?? null,
    unit: r.unitName ?? null,
    stock_quantity: safeDecimal(r.availableStock),
    min_stock: safeDecimal(r.minStock),
    buy_price: safeDecimal(r.buyPrice),
    sell_price: safeDecimal(r.sellPrice),
    warehouse_name: r.warehouseName ?? null,
    branch_name: r.branchName ?? null,
    raw_data: r,
    synced_at: now(),
    updated_at: now(),
  })));
  if (rows.length) {
    await supabase.from("accurate_inventory_items").upsert(rows, { onConflict: "id" });
  }
  return rows.length;
}

async function syncBackorders(): Promise<number> {
  const records = await fetchAllPages("salesOrder/list", { filter: "OPEN" });
  const rows: Record<string, unknown>[] = [];
  for (const r of records) {
    const details = (r.detailItem ?? []) as Record<string, unknown>[];
    for (const detail of details) {
      const orderedQty = safeDecimal(detail.quantity) ?? 0;
      const deliveredQty = safeDecimal(detail.deliveredQty) ?? 0;
      const remaining = orderedQty - deliveredQty;
      if (remaining <= 0) continue;
      rows.push({
        id: await sha256hex(`bo|${r.id}|${detail.id}`),
        order_no: String(r.number ?? ""),
        customer_name: r.customerName ?? null,
        customer_id: r.customerId ? String(r.customerId) : null,
        branch_name: r.branchName ?? null,
        transaction_date: safeDate(r.transDate),
        expected_delivery_date: safeDate(r.promisedDate ?? r.dueDate),
        item_name: detail.itemName ?? null,
        item_code: detail.itemNo ?? null,
        ordered_quantity: orderedQty,
        delivered_quantity: deliveredQty,
        remaining_quantity: remaining,
        unit: detail.unitName ?? null,
        unit_price: safeDecimal(detail.unitPrice),
        total_amount: safeDecimal(detail.amount),
        status: r.status ?? "OPEN",
        raw_data: { order: r, detail },
        synced_at: now(),
        updated_at: now(),
      });
    }
  }
  if (rows.length) {
    await supabase.from("accurate_backorders").upsert(rows, { onConflict: "id" });
  }
  return rows.length;
}

async function syncCashFlow(): Promise<number> {
  const records = await fetchAllPages("generalLedger/list");
  const rows = await Promise.all(records.map(async (r) => ({
    id: String(r.id ?? await sha256hex(`gl|${r.transNo}`)),
    transaction_date: safeDate(r.transDate),
    description: r.description ?? r.memo ?? null,
    account_name: r.accountName ?? null,
    account_code: r.accountNo ?? null,
    branch_name: r.branchName ?? null,
    debit_amount: safeDecimal(r.debitAmount) ?? 0,
    credit_amount: safeDecimal(r.creditAmount) ?? 0,
    balance: safeDecimal(r.balance),
    transaction_type: r.transType ?? null,
    reference_no: r.transNo ?? null,
    raw_data: r,
    synced_at: now(),
    updated_at: now(),
  })));
  if (rows.length) {
    await supabase.from("accurate_cash_flow").upsert(rows, { onConflict: "id" });
  }
  return rows.length;
}

// ── 主程序 ────────────────────────────────────────────────────────────────────

const TASKS = [
  { name: "sales_invoices", fn: syncSalesInvoices },
  { name: "purchase_invoices", fn: syncPurchaseInvoices },
  { name: "inventory", fn: syncInventory },
  { name: "backorders", fn: syncBackorders },
  { name: "cash_flow", fn: syncCashFlow },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const results: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const { name, fn } of TASKS) {
    // 建立 sync log
    const { data: logRow } = await supabase
      .from("accurate_sync_logs")
      .insert({ sync_type: name, status: "partial", started_at: now() })
      .select("id")
      .single();

    const logId = logRow?.id as string | undefined;

    try {
      const count = await fn();
      results[name] = count;
      if (logId) {
        await supabase
          .from("accurate_sync_logs")
          .update({ status: "success", records_synced: count, finished_at: now() })
          .eq("id", logId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors[name] = msg;
      if (logId) {
        await supabase
          .from("accurate_sync_logs")
          .update({ status: "error", error_message: msg, finished_at: now() })
          .eq("id", logId);
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, synced: results, errors }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
});
