import type { View } from '../App';
import { CHECKLIST, daysLeft, type Claim } from './claim';
import { s } from './i18n';

export interface Gap {
  level: 'urgent' | 'fix' | 'later';
  text: string;
  go: View;
}

/** Finds what's missing or risky in a claim. Plain rules, so it works offline and never makes things up. */
export function findGaps(c: Claim, today = new Date()): Gap[] {
  const gaps: Gap[] = [];
  const home: View = { name: 'home' };
  const days = daysLeft(c.deadline, today);
  if (days === null) gaps.push({ level: 'urgent', text: s('No aid deadline set. Add it from your official notice.'), go: home });
  else if (days < 0) gaps.push({ level: 'urgent', text: s('Your aid deadline has passed. Contact your aid program about a late application.'), go: home });
  else if (days <= 14) gaps.push({ level: 'urgent', text: s('Your aid deadline is in {n} days.', { n: days }), go: { name: 'packet' } });

  const waiting = c.photos.filter((p) => !p.scanned).length;
  if (waiting) gaps.push({ level: 'fix', text: s('{n} photos are waiting to be read.', { n: waiting }), go: { name: 'room', id: c.photos.find((p) => !p.scanned)!.roomId } });
  for (const r of c.rooms) {
    const items = c.items.filter((i) => i.roomId === r.id);
    const noEst = items.filter((i) => i.estimate === null).length;
    const noName = items.filter((i) => !i.name.trim()).length;
    if (noEst) gaps.push({ level: 'fix', text: s('{room}: {n} items have no estimate.', { room: s(r.name), n: noEst }), go: { name: 'room', id: r.id } });
    if (noName) gaps.push({ level: 'fix', text: s('{room}: {n} items have no name.', { room: s(r.name), n: noName }), go: { name: 'room', id: r.id } });
  }
  const noAmount = c.expenses.filter((e) => e.amount === null).length;
  if (noAmount) gaps.push({ level: 'fix', text: s('{n} extra costs have no amount.', { n: noAmount }), go: { name: 'costs' } });
  if (!c.details.name || !c.details.ref || !c.details.insurer) gaps.push({ level: 'fix', text: s('Add your name, insurer and claim number to the packet.'), go: { name: 'packet' } });

  const empty = c.rooms.filter((r) => !r.done && !c.photos.some((p) => p.roomId === r.id) && !c.items.some((i) => i.roomId === r.id));
  if (empty.length) gaps.push({ level: 'later', text: s('No photos yet: {rooms}.', { rooms: empty.map((r) => s(r.name)).join(', ') }), go: { name: 'room', id: empty[0].id } });
  const open = c.rooms.filter((r) => !r.done && (c.photos.some((p) => p.roomId === r.id) || c.items.some((i) => i.roomId === r.id)));
  if (open.length) gaps.push({ level: 'later', text: s('Not marked done: {rooms}.', { rooms: open.map((r) => s(r.name)).join(', ') }), go: { name: 'room', id: open[0].id } });
  if (c.items.length && !c.packet?.text) gaps.push({ level: 'later', text: s('No cover letter yet.'), go: { name: 'packet' } });
  const left = CHECKLIST.length - c.checks.length;
  if (left > 0) gaps.push({ level: 'later', text: s('{n} checklist steps left.', { n: left }), go: home });
  return gaps;
}
