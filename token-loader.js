// token-loader.js
const GITHUB_TOKEN = process.env.WOLF_TOKENS_PAT || '';

// بيانات الحساب الأول (المنشئ)
const HOST_OWNER = 'Ean72932';
const HOST_REPO = 'too';
const HOST_FILE = '2t.json';

// بيانات الحساب الثاني (الضيف)
const GUEST_OWNER = 'Ean72932';
const GUEST_REPO = 'Ono';
const GUEST_FILE = '1o.json';

const GITHUB_BRANCH = 'main';

async function fetchFileFromGitHub(owner, repo, file) {
    if (!GITHUB_TOKEN) {
        throw new Error('❌ WOLF_TOKENS_PAT غير موجود في متغيرات البيئة');
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${file}?ref=${GITHUB_BRANCH}`;
    console.log(`🌐 جلب: ${owner}/${repo}/${file}`);

    const res = await fetch(url, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'wolf-bot'
        }
    });

    if (!res.ok) {
        throw new Error(`❌ فشل جلب ${file} من ${repo}: HTTP ${res.status}`);
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(content);
}

export async function loadTokens() {
    console.log('\n========================================');
    console.log('🔐 تحميل الرموز للحسابين من GitHub');
    console.log('========================================');

    // 1. جلب توكن المنشئ
    const hostData = await fetchFileFromGitHub(HOST_OWNER, HOST_REPO, HOST_FILE);
    const tokenHost = hostData.v3APIToken || hostData.token;
    if (!tokenHost) throw new Error('❌ v3APIToken مفقود في حساب المنشئ');

    // 2. جلب توكن الضيف
    const guestData = await fetchFileFromGitHub(GUEST_OWNER, GUEST_REPO, GUEST_FILE);
    const tokenGuest = guestData.v3APIToken || guestData.token;
    if (!tokenGuest) throw new Error('❌ v3APIToken مفقود في حساب الضيف');

    console.log('✅ تم تحميل التوكنات بنجاح');
    console.log('========================================\n');

    return {
        TOKEN_HOST: tokenHost,
        TOKEN_GUEST: tokenGuest
    };
}
