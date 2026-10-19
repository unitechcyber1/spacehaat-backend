/**
 * Generates `new_description` for coworking spaces (WorkSpace) by rewriting the
 * existing `description` into natural, SEO-friendly copy (60–100 words).
 *
 * Scope: cities Delhi / Noida / Gurgaon (Gurugram), status `approve` or `inprogress`,
 * non-empty `description`, empty `new_description` (unless --overwrite).
 * The original `description` is never modified.
 *
 * Usage:
 *   node src/scripts/workspace-new-description.js --count
 *       Only print how many spaces match. No API calls, no DB writes.
 *   node src/scripts/workspace-new-description.js --out preview.json [--limit 10]
 *       Generate rewrites with OpenAI and save them to a review file. No DB writes.
 *   node src/scripts/workspace-new-description.js --apply-file preview.json
 *       Save the reviewed rewrites from the file into `new_description`.
 *
 * Options: --overwrite (also replace existing new_description), --concurrency 4,
 *          --include-flagged (with --apply-file, also save items marked needs_review)
 * Env: OPENAI_API_KEY (required for generation), OPENAI_MODEL (default gpt-4.1)
 */
import '../config/loadEnv.js';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';
import { countWords, createOpenAiClient } from '../utilities/pg-description-ai.js';

const WorkSpace = models['WorkSpace'];
const City = models['City'];

const CITY_NAMES = /^(delhi|new delhi|noida|gurgaon|gurugram)$/i;
const STATUSES = ['approve', 'inprogress'];
const MIN_WORDS = 60;
const MAX_WORDS = 100;
const MAX_ATTEMPTS = 4;

// Words and phrases that make copy read as machine-written.
const BANNED_PHRASES = [
    'nestled', 'boasts', 'boasting', 'seamless', 'seamlessly', 'vibrant', 'bustling', 'elevate',
    'unlock', 'state-of-the-art', 'cutting-edge', 'thriving', 'dynamic', 'world-class',
    'top-notch', 'game-changer', 'game changer', 'tailored', 'foster', 'synergy', 'delve',
    'embark', 'unparalleled', 'premier', 'look no further', 'whether you', "in today's",
    'perfect blend', 'perfect for', 'ideal for', 'welcome to', 'nestled in', 'step into',
    'discover', 'experience the', 'redefine', 'revolutionize', 'testament', 'tapestry',
    'landscape', 'realm', 'elevated', 'curated', 'meticulously', 'effortlessly', 'enhance',
    'empower', 'paradise', 'oasis', 'haven', 'one-stop', 'second to none', 'like-minded',
    'practical', 'straightforward', 'hassle-free', 'conveniently', 'ensuring', 'ensures',
    'essentials', 'functional', 'cater', 'caters', 'catering', 'explore', 'whether',
    'team leads', 'stress-free', 'frills', 'comfortable setting', 'work environment',
    'a breeze', 'great spot', 'perfect', 'prime location', 'strategic', 'awaits', 'hangs',
];

// Each listing opens from a different angle so 500 descriptions don't share one template.
const OPENING_ANGLES = [
    'Open with where the building is and what is around it.',
    'Open with how people get there (metro, main road, autos).',
    'Open with the size of the centre and the kind of seating it has.',
    'Open with what a normal workday there looks like.',
    'Open with the name of the space and one specific detail about it.',
    'Open with the locality and why businesses pick that area.',
];

function parseArgs(argv) {
    const args = { concurrency: 4 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--count') args.count = true;
        else if (a === '--overwrite') args.overwrite = true;
        else if (a === '--include-flagged') args.includeFlagged = true;
        else if (a === '--out') args.out = argv[++i];
        else if (a === '--apply-file') args.applyFile = argv[++i];
        else if (a === '--limit') args.limit = Number(argv[++i]);
        else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
        else throw new Error(`Unknown argument: ${a}`);
    }
    return args;
}

function htmlToText(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
}

function textToHtml(text) {
    return text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join('');
}

function buildFacts(space) {
    const loc = space.location || {};
    const facts = [];
    facts.push(`Name: ${space.name}`);
    if (loc.micro_location?.name) facts.push(`Locality: ${loc.micro_location.name}`);
    if (loc.city?.name) facts.push(`City: ${loc.city.name}`);
    if (loc.address1) facts.push(`Address: ${loc.address1}`);
    if (loc.landmark) facts.push(`Nearby landmark: ${loc.landmark}${loc.landmark_distance ? ` (${loc.landmark_distance})` : ''}`);
    if (loc.metro_stop_landmark) facts.push(`Nearest metro: ${loc.metro_stop_landmark}`);
    if (space.no_of_seats) facts.push(`Seats: ${space.no_of_seats}`);
    const amenities = (space.amenties || []).map((a) => a?.name).filter(Boolean);
    if (amenities.length) facts.push(`Amenities: ${amenities.slice(0, 15).join(', ')}`);
    return facts.join('\n');
}

function buildPrompt(space, original, feedback) {
    const locality = space.location?.micro_location?.name;
    const city = space.location?.city?.name;
    // Roads read "on Sohna Road", everything else "in Sector 62".
    const preposition = /\b(road|marg|highway|expressway|avenue)\s*$/i.test(locality || '') ? 'on' : 'in';
    const keyword = `coworking space ${preposition} ${[locality?.trim(), city].filter(Boolean).join(', ')}`;
    const angle = OPENING_ANGLES[parseInt(String(space._id).slice(-4), 16) % OPENING_ANGLES.length];
    return `Rewrite the listing below for a coworking space in Delhi NCR.

Write it the way a local broker would describe the place to a client over the phone: plain, specific, a little conversational. ${angle}

Rules:
- Between ${MIN_WORDS} and ${MAX_WORDS} words. Two short paragraphs separated by a blank line.
- Mention the space by its name, "${space.name}", at least once, ideally in the first or second sentence.
- Use the phrase "${keyword}" once, where it reads naturally. Do not repeat keywords.
- Use only facts found in the original text or the facts list. Do not invent prices, amenities, timings, awards, distances, networking or nightlife claims.
- Prefer concrete details (locality, metro, landmarks, seating options, actual amenities) over adjectives.
- Pick at most three or four amenities that matter. Skip parking unless the original mentions it.
- Do not describe who the space is for with a list of people types. Do not end with a sales line or a summary sentence.
- If the seat count in the facts conflicts with the original text, leave the number out.
- Mix short and longer sentences. Simple everyday English.
- No em dashes, no exclamation marks, no questions, no bullet points, no headings, no emojis.
- Do not open with "Located in", "Welcome to" or "Looking for".
- Never use these words or phrases: ${BANNED_PHRASES.join(', ')}.
- Return only the rewritten text.

Facts:
${buildFacts(space)}

Original description:
${original}`;
}

const normalizeName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function checkDraft(text, name) {
    const problems = [];
    if (name && !normalizeName(text).includes(normalizeName(name))) problems.push(`it did not mention the space name "${name}"`);
    const words = countWords(text);
    if (words < MIN_WORDS || words > MAX_WORDS) problems.push(`it had ${words} words, it must be ${MIN_WORDS}-${MAX_WORDS}`);
    const lower = text.toLowerCase();
    const found = BANNED_PHRASES.filter((p) => new RegExp(`\\b${p.replace(/[-']/g, '.')}\\b`, 'i').test(lower));
    if (found.length) problems.push(`it used banned words: ${found.join(', ')}`);
    if (/[—–]/.test(text)) problems.push('it used dashes');
    if (/[!?]/.test(text)) problems.push('it used exclamation or question marks');
    return { words, problems };
}

// Second opinion: list claims in the draft that the source does not support.
async function findUnsupportedClaims(openai, space, original, text) {
    const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4.1',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: 'You are a strict fact checker for property listings. Reply with JSON only.',
            },
            {
                role: 'user',
                content: `List every factual claim in the DRAFT that is not stated or clearly implied by the SOURCE (facts + original). Claims include amenities, seating types, size, design or condition of the space, distances, nearby places and companies. General statements about the city or area being well connected are allowed only if the source mentions connectivity.

Reply as {"unsupported": ["claim", ...]}. Use an empty list if everything is supported.

SOURCE FACTS:
${buildFacts(space)}

SOURCE ORIGINAL:
${original}

DRAFT:
${text}`,
            },
        ],
    });
    try {
        const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
        return Array.isArray(parsed.unsupported) ? parsed.unsupported : [];
    } catch {
        return [];
    }
}

async function rewrite(openai, space) {
    const original = htmlToText(space.description);
    const messages = [
        {
            role: 'system',
            content: 'You are an experienced commercial real estate copywriter in Delhi NCR. You write clear, honest listings that read like a person wrote them.',
        },
        { role: 'user', content: buildPrompt(space, original) },
    ];
    let best = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4.1',
            temperature: 0.8,
            messages,
        });
        const text = (response.choices?.[0]?.message?.content || '').trim();
        const { words, problems } = checkDraft(text, space.name);
        if (!problems.length) {
            const unsupported = await findUnsupportedClaims(openai, space, original, text);
            if (unsupported.length) problems.push(`it added details not in the source, remove them: ${unsupported.join(' | ')}`);
        }
        if (!best || problems.length < best.problems.length) best = { text, words, problems, attempts: attempt };
        if (!problems.length) break;
        // Ask for a targeted edit of this draft rather than a fresh rewrite.
        messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: `Edit your draft to fix these problems: ${problems.join('; ')}. Rephrase only the sentences that need it, keep the rest, keep it ${MIN_WORDS}-${MAX_WORDS} words. If you need more words, use only details from the facts and original. Return only the text.` },
        );
    }
    return { original, ...best };
}

async function findSpaces({ overwrite, limit }) {
    const cities = await City.find({ name: CITY_NAMES }).select('name').lean();
    console.log(`Cities matched: ${cities.map((c) => c.name).join(', ') || 'none'}`);
    const condition = {
        status: { $in: STATUSES },
        'location.city': { $in: cities.map((c) => c._id) },
        description: { $exists: true, $nin: [null, ''] },
    };
    if (!overwrite) condition.new_description = { $in: [null, ''] };
    let query = WorkSpace.find(condition)
        .select('name description status location amenties no_of_seats')
        .populate({ path: 'location.city', select: 'name' })
        .populate({ path: 'location.micro_location', select: 'name' })
        .populate({ path: 'amenties', select: 'name' })
        .sort({ _id: 1 })
        .lean();
    if (limit) query = query.limit(limit);
    return { condition, query };
}

async function generate(args) {
    if (!args.out) throw new Error('Pass --out <file> for the review file');
    const openai = createOpenAiClient();
    const { query } = await findSpaces(args);
    const spaces = await query;
    console.log(`Generating for ${spaces.length} spaces...`);

    const results = [];
    let next = 0;
    async function worker() {
        while (next < spaces.length) {
            const space = spaces[next++];
            try {
                const r = await rewrite(openai, space);
                results.push({
                    id: String(space._id),
                    name: space.name,
                    city: space.location?.city?.name,
                    locality: space.location?.micro_location?.name,
                    status: space.status,
                    original: r.original,
                    new_description: r.text,
                    words: r.words,
                    needs_review: r.problems.length > 0,
                    problems: r.problems,
                });
                console.log(`${results.length}/${spaces.length} ${space.name} (${r.words} words${r.problems.length ? ', NEEDS REVIEW' : ''})`);
            } catch (error) {
                results.push({ id: String(space._id), name: space.name, error: error.message });
                console.error(`Failed: ${space.name}: ${error.message}`);
            }
        }
    }
    await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, worker));

    await fs.writeFile(args.out, JSON.stringify(results, null, 2));
    const flagged = results.filter((r) => r.needs_review || r.error).length;
    console.log(`Saved ${results.length} rewrites to ${args.out} (${flagged} need review). Nothing written to the database.`);
}

async function apply(args) {
    const items = JSON.parse(await fs.readFile(args.applyFile, 'utf8'));
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
        if (item.error || !item.new_description || !String(item.new_description).trim() || (item.needs_review && !args.includeFlagged)) {
            skipped++;
            continue;
        }
        const filter = { _id: item.id };
        if (!args.overwrite) filter.new_description = { $in: [null, ''] };
        const html = /<[a-z][\s\S]*>/i.test(item.new_description) ? item.new_description : textToHtml(item.new_description);
        const res = await WorkSpace.updateOne(filter, { $set: { new_description: html } });
        if (res.modifiedCount) updated++;
        else skipped++;
    }
    console.log(`Updated ${updated} spaces, skipped ${skipped}.`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    await mongoose.connect(database.uri);
    try {
        if (args.count) {
            const { condition } = await findSpaces(args);
            const total = await WorkSpace.countDocuments(condition);
            console.log(`Matching spaces: ${total}`);
        } else if (args.applyFile) {
            await apply(args);
        } else {
            await generate(args);
        }
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
