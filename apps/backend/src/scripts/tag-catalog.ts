import { asc, count, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents } from '../db/schema.js';
import { deriveTags, rebuildTagUsageCounts, tagUntaggedContents } from '../services/taxonomy.js';

/**
 * Without --write this only prints the derived tags, so a bad keyword shows up
 * in the real catalog before it is written into the taxonomy. Writing labels
 * contents that carry no tag at all, which keeps a manual edit from being
 * overwritten by the next run.
 */
const write = process.argv.includes('--write');
const sample = Number(process.argv.find((arg) => arg.startsWith('--sample='))?.split('=')[1] ?? 40);

if (!write) {
  const rows = await db
    .select({ id: contents.id, title: contents.title, summary: contents.summary, source: contents.source })
    .from(contents)
    .orderBy(asc(contents.createdAt))
    .limit(sample);

  for (const row of rows) {
    const tags = deriveTags(row.title, row.summary).map((def) => def.slug);
    console.log(`${(row.source || '?').padEnd(14)}${tags.join(' ') || '-'}`);
    console.log(`${' '.repeat(14)}${row.title.slice(0, 90)}`);
  }
  console.log(`\n${rows.length} contents inspected.`);
  process.exit(0);
}

const tagged = await tagUntaggedContents(5000);
await rebuildTagUsageCounts();

const [totals] = await db.select({ contents: count(), tagged: sql<number>`(select count(distinct content_id) from content_tags)::int` }).from(contents);
console.log(`Tagged ${tagged} contents — ${totals.tagged}/${totals.contents} of the catalog now carry a tag.`);
process.exit(0);
