import { readFile } from 'fs/promises';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

if (!CLAUDE_API_KEY) {
    console.error('❌ CLAUDE_API_KEY not set');
    process.exit(1);
}

async function getChangedMarkdownFiles(): Promise<string[]> {
    const base = process.env.GITHUB_BASE_REF || 'main';
    const head = process.env.GITHUB_HEAD_REF || '';
    const diffOutput = execSync(`git fetch origin ${base} && git diff --name-only origin/${base}...${head}`, { encoding: 'utf-8' });
    return diffOutput
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.endsWith('.md'));
}

async function sendToClaude(content: string): Promise<string> {
    const body = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
            { role: 'user', content: `다음 문서를 리뷰해줘:\n\n${content}` },
        ],
    };

    const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        } as HeadersInit | undefined,
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(`Claude API 요청 실패: ${res.statusText}`);
    }

    const data = await res.json() as {
        content: { text: string }[];
    };

    return data.content[0].text;
}

async function main() {
    const files = await getChangedMarkdownFiles();
    for (const file of files) {
        const content = await readFile(file, 'utf-8');
        const review = await sendToClaude(content);
        console.log(`\n📝 Review for ${file}:\n${review}\n`);
    }
}

main().catch((err) => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
});
