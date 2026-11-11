// Canary documents. Every planted sensitive item is marked {{CATEGORY:text}}, so the counts are known exactly.
// All names, numbers and addresses are invented. Hard cases are planted on purpose and stay in: a name that is also a
// common word, a card number split by spaces, a phone number written with spaces, a health detail with no clinical
// cue word, and a credential inside a sentence.

export const SEEDS = [
  {
    id: 'meeting',
    title: 'Meeting transcript',
    kind: 'Weekly ops call',
    text: `Weekly ops call, Thursday

{{NAME:Dana Okafor}}: Morning all. Quick one today. {{NAME:Will Rivers}} is joining late from the {{PLACE:Mombasa}} depot.
{{NAME:Hope Adeyemi}}: The {{ORG:Northwind Freight}} renewal is still open. They want {{MONEY:$48,500}} for the year, up from {{MONEY:$41,000}}.
{{NAME:Dana Okafor}}: Too much. Can you push back and copy {{EMAIL:dana.okafor@lumen-ops.example}} on the reply?
{{NAME:Hope Adeyemi}}: Will do. Their account lead is {{NAME:Marcus Feld}}, best on {{PHONE:+44 20 7946 0321}}.
{{NAME:Dana Okafor}}: And Priya is out this week, she was diagnosed with {{HEALTH:shingles}}, so {{NAME:Will}} covers the rota.
{{NAME:Will Rivers}}: Fine. I will also chase the {{ORG:Kestrel Logistics}} invoice before Friday.
{{NAME:Dana Okafor}}: Last thing, {{NAME:Sam}} is back on Monday after {{HEALTH:her knee surgery}}. Keep her off the night shift for two weeks.
Decision: hold the Northwind renewal until we have a counter offer.`,
  },
  {
    id: 'email',
    title: 'Email thread',
    kind: 'Supplier onboarding',
    text: `From: {{NAME:Grace Mwangi}} <{{EMAIL:grace.mwangi@halcyon-labs.example}}>
To: Accounts
Subject: New supplier set up

Hi team,

Please set up {{ORG:Brightwater Ceramics}} as a supplier. Their contact is {{NAME:Tomas Lind}}, {{EMAIL:t.lind@brightwater.example}}, mobile {{PHONE:+254 712 345 678}}.
Payment goes to {{ACCOUNT:GB29 NWBK 6016 1331 9268 19}}. First order is {{MONEY:£12,400}}, due on the 30th.

For the director check we need his date of birth: {{DATE:14/03/1981}}. Their terms are at {{URL:https://brightwater.example/terms}}.

Thanks,
{{NAME:Grace}}

> On Monday, {{NAME:Rose}} wrote:
> Before we add anyone, run the usual checks with {{ORG:Credova}} and send me the result.`,
  },
  {
    id: 'ticket',
    title: 'Support ticket',
    kind: 'Card and login issue',
    text: `Ticket 88213, priority high

Customer {{NAME:Ana Lucia Ferreira}} called from {{PLACE:Porto}}. She cannot log in and says her card {{ACCOUNT:4539 1488 0343 6467}} was charged twice.
Callback number {{PHONE:+351 912 345 678}}, email {{EMAIL:analucia.f@mailbox.example}}.
To speed things up she read out her password: {{SECRET:Tulip#2291}}. She also gave her recovery code: {{SECRET:7QX-44M-PLR}}.
Agent note: refunded {{MONEY:€89.90}}. Customer account number {{ACCOUNT:0041 2237 9910}}. Escalated to {{NAME:Joel Brandt}} in billing.
She mentioned she is on medication for {{HEALTH:epilepsy}} and needs written instructions, not calls.`,
  },
];

/** Strips the markup: returns the clean text and the planted items with exact offsets. */
export function parseSeed(marked) {
  const planted = [];
  let text = '';
  let at = 0;
  const re = /\{\{([A-Z]+):([^}]+)\}\}/g;
  for (let m = re.exec(marked); m; m = re.exec(marked)) {
    text += marked.slice(at, m.index);
    const value = m[2] ?? '';
    planted.push({ category: m[1] ?? '', text: value, start: text.length, end: text.length + value.length });
    text += value;
    at = m.index + m[0].length;
  }
  text += marked.slice(at);
  return { text, planted };
}
