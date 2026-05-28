import OpenAI from 'openai';

const DEFAULT_MIN_WORDS = Number(process.env.PG_DESC_MIN_WORDS || 25);
const DEFAULT_TARGET_WORDS = Number(process.env.PG_DESC_TARGET_WORDS || 30);

export function countWords(text) {
    if (text == null || text === '') return 0;
    return String(text)
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

export function trimToWordCount(text, maxWords) {
    if (!text || maxWords <= 0) return '';
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return words.join(' ');
    return words.slice(0, maxWords).join(' ');
}

/**
 * Min 20–30 words (default 25); may expand short originals up to a reasonable max.
 */
export function resolveDescriptionWordTargets(originalWords, { minWords, maxWords } = {}) {
    const min = Math.max(20, minWords ?? DEFAULT_MIN_WORDS);
    const target = Math.max(min, DEFAULT_TARGET_WORDS);

    if (maxWords != null && maxWords > 0) {
        return { minWords: min, targetWords: target, maxWords };
    }

    let max;
    if (originalWords < 15) {
        max = Math.max(40, min + 15);
    } else if (originalWords < 30) {
        max = Math.max(50, min + 20);
    } else {
        max = Math.min(180, Math.max(originalWords + 25, Math.ceil(originalWords * 1.35)));
    }

    return { minWords: min, targetWords: target, maxWords: max };
}

export function buildHumanizePrompt({
    description,
    minWords,
    targetWords,
    maxWords,
    name,
    city,
    locality,
    retryBecauseShort,
}) {
    const context = [name, city, locality].filter(Boolean).join(', ');
    return `Rewrite the following PG/coliving property description to sound natural, warm, and human — like a real person wrote it for renters.

Rules:
- Do NOT invent amenities, prices, room types, or locations not implied by the original.
- Keep the same core meaning; you may rephrase and lightly expand thin copy.
- Length: write between ${minWords} and ${maxWords} words. Aim for about ${targetWords} words.
- If the original is very short, expand it naturally into a complete paragraph (still factual).
- No bullet lists unless the original uses them. Prefer flowing prose.
- Do not include labels like "Description:" — return only the rewritten text.
${retryBecauseShort ? `\nIMPORTANT: Your previous draft was too short. You MUST write at least ${minWords} words.` : ''}
${context ? `\nProperty context (tone only): ${context}` : ''}

Original description:
${description}`;
}

export async function humanizePgDescription(
    openai,
    { description, minWords, targetWords, maxWords, name, city, locality, model },
) {
    if (!description || !String(description).trim()) {
        return { text: description, wordCount: 0, trimmed: false, expanded: false };
    }

    const originalWords = countWords(description);
    const targets = resolveDescriptionWordTargets(originalWords, { minWords, maxWords });
    const { minWords: min, targetWords: target, maxWords: max } = targets;

    async function callApi(retryBecauseShort = false) {
        const response = await openai.chat.completions.create({
            model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content:
                        'You rewrite PG/coliving descriptions to be warm, natural, and SEO-friendly while respecting word count ranges.',
                },
                {
                    role: 'user',
                    content: buildHumanizePrompt({
                        description,
                        minWords: min,
                        targetWords: target,
                        maxWords: max,
                        name,
                        city,
                        locality,
                        retryBecauseShort,
                    }),
                },
            ],
        });
        return response.choices?.[0]?.message?.content?.trim() || '';
    }

    let text = await callApi(false);
    if (!text) {
        throw new Error('OpenAI returned empty description');
    }

    let wordCount = countWords(text);
    if (wordCount < min) {
        text = await callApi(true);
        wordCount = countWords(text);
    }

    let trimmed = false;
    if (wordCount > max) {
        text = trimToWordCount(text, max);
        wordCount = countWords(text);
        trimmed = true;
    }

    return {
        text,
        wordCount,
        trimmed,
        expanded: wordCount > originalWords,
        originalWords,
        minWords: min,
        targetWords: target,
        maxWords: max,
    };
}

export function createOpenAiClient() {
    const key = process.env.OPENAI_API_KEY;
    if (!key || !String(key).trim()) {
        throw new Error('OPENAI_API_KEY is not set in environment (.env)');
    }
    return new OpenAI({ apiKey: String(key).trim() });
}
