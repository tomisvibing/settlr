// settlr's push notifications. One function, three jobs, chosen by the JSON body's `type`:
//
//   { type: 'key' }                               the public VAPID key a browser subscribes with
//   { type: 'nudge', group_id, person_id }        from the app, signed in: tell someone who owes
//                                                 you in a group that you've nudged them
//   { type: 'weekly' }                            from the Sunday cron job: everyone with
//                                                 notifications on gets the overview's sentence
//
// Deployed with verify_jwt off (see supabase/config.toml): the publishable key isn't a JWT, so
// the function checks the signed-in user itself where it matters (nudges). The VAPID key pair
// is made on first use and kept in push_state, which only the service role can read.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { paymentPlan } from './lib/ledger.js';
import { storyParts, storyText, whoOwesWhom } from './lib/story.js';
import { money } from './lib/format.js';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const APP = 'https://tomisvibing.github.io/settlr/';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Keys = { publicKey: string; privateKey: string };
let keys: Keys | null = null;
async function vapid(): Promise<Keys> {
  if (keys) return keys;
  let { data } = await sb.from('push_state').select('value').eq('key', 'vapid').maybeSingle();
  if (!data) {
    // First run: make a pair. If two calls race, the insert that loses is ignored and both read the winner.
    await sb.from('push_state').upsert({ key: 'vapid', value: webpush.generateVAPIDKeys() }, { onConflict: 'key', ignoreDuplicates: true });
    ({ data } = await sb.from('push_state').select('value').eq('key', 'vapid').single());
  }
  keys = data!.value as Keys;
  webpush.setVapidDetails(APP, keys.publicKey, keys.privateKey);
  return keys;
}

// Every subscription a login has; ones the push service says are gone get deleted
async function send(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  await vapid();
  const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', userId);
  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push failed', code, (err as Error).message);
    }
  }
  return sent;
}

// Every row, a page at a time (the API returns at most 1,000 per request)
async function all(table: string, columns: string, filter?: (q: any) => any) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    // A stable order so pages don't overlap
    let q = sb.from(table).select(columns).order('id').range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// Groups in the shape the app's ledger expects: { id, name, currency, archivedAt, members, expenses }
async function loadGroups(groupIds?: string[]) {
  const inGroups = (col: string) => groupIds ? (q: any) => q.in(col, groupIds) : undefined;
  const [g, m, e, p] = await Promise.all([
    all('groups', 'id, name, currency, archived_at, simplify_debts', inGroups('id')),
    all('group_members', 'id, group_id, person_id, left_at', inGroups('group_id')),
    all('expenses', 'id, group_id, type, amount_cents, paid_by', inGroups('group_id')),
    all('people', 'id, name, user_id'),
  ]);
  const s = await all('expense_splits', 'id, expense_id, person_id, amount_cents', groupIds ? (q: any) => q.in('expense_id', e.map(x => x.id)) : undefined);
  const splits: Record<string, Record<string, number>> = {};
  for (const x of s) (splits[x.expense_id] ||= {})[x.person_id] = Number(x.amount_cents);
  const groups = g.map((row: any) => ({
    id: row.id, name: row.name, currency: row.currency, simplify: row.simplify_debts !== false, archivedAt: row.archived_at,
    members: m.filter((x: any) => x.group_id === row.id && !x.left_at).map((x: any) => x.person_id),
    expenses: e.filter((x: any) => x.group_id === row.id)
      .map((x: any) => ({ type: x.type, amount: Number(x.amount_cents), paidBy: x.paid_by, splits: splits[x.id] || {} })),
  }));
  const people = Object.fromEntries(p.map((x: any) => [x.id, x]));
  return { groups, people };
}
const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'Someone';

async function nudge(req: Request, groupId: string, personId: string) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await sb.auth.getUser(jwt);
  const me = auth?.user?.id;
  if (!me) return reply({ error: 'Sign in to nudge someone.' }, 401);
  if (!groupId || !personId) return reply({ error: 'Missing group or person.' }, 400);

  const { groups, people } = await loadGroups([groupId]);
  const g = groups[0];
  if (!g || g.archivedAt || !g.members.some((pid: string) => people[pid]?.user_id === me)) return reply({ error: 'Not in that group.' }, 403);
  const owed = paymentPlan(g).find(p => p.from === personId && people[p.to]?.user_id === me);
  if (!owed) return reply({ error: 'They don’t owe you in this group.' }, 400);
  const target = people[personId]?.user_id;
  if (!target || target === me) return reply({ sent: 0, reason: 'no-account' });

  const since = new Date(Date.now() - 12 * 3600e3).toISOString();
  const { count } = await sb.from('push_nudges').select('id', { count: 'exact', head: true })
    .eq('from_user', me).eq('to_person', personId).eq('group_id', groupId).gte('sent_at', since);
  if (count) return reply({ sent: 0, reason: 'recent' });

  const from = firstName(people[owed.to].name);
  const sent = await send(target, {
    title: `${from} nudged you`,
    body: `You owe ${from} ${money(owed.amount, g.currency)} for ${g.name}.`,
    url: `#/g/${g.id}`, tag: `nudge-${g.id}`,
  });
  if (sent) await sb.from('push_nudges').insert({ from_user: me, to_person: personId, group_id: groupId });
  return reply({ sent, reason: sent ? undefined : 'no-subscription' });
}

async function weekly() {
  const { data: last } = await sb.from('push_state').select('value').eq('key', 'weekly').maybeSingle();
  if (last && Date.now() - Date.parse((last.value as { at: string }).at) < 6 * 864e5) return reply({ skipped: 'already sent this week' });
  await sb.from('push_state').upsert({ key: 'weekly', value: { at: new Date().toISOString() }, updated_at: new Date().toISOString() });

  const { data: subs } = await sb.from('push_subscriptions').select('user_id');
  const users = [...new Set((subs || []).map((s: any) => s.user_id))];
  if (!users.length) return reply({ users: 0 });
  const { groups, people } = await loadGroups();
  let notified = 0;
  for (const uid of users) {
    const isMe = (pid: string) => people[pid]?.user_id === uid;
    const mine = groups.filter((g: any) => g.members.some(isMe));
    const { owedToMe, iOwe } = whoOwesWhom(mine, isMe);
    if (!owedToMe.length && !iOwe.length) continue;
    const body = storyText(storyParts(mine, isMe, (pid: string) => firstName(people[pid]?.name), money));
    if (await send(uid, { title: 'Your week in settlr', body, url: '#/overview', tag: 'weekly' })) notified++;
  }
  return reply({ users: users.length, notified });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.type === 'key') return reply({ publicKey: (await vapid()).publicKey });
    if (body.type === 'nudge') return await nudge(req, body.group_id, body.person_id);
    if (body.type === 'weekly') return await weekly();
    return reply({ error: 'Unknown type' }, 400);
  } catch (err) {
    console.error(err);
    return reply({ error: 'Something went wrong sending notifications.' }, 500);
  }
});
