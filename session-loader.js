// session-loader.js
const GITHUB_TOKEN = process.env.WOLF_TOKENS_PAT || '';
const GITHUB_OWNER = 'Ean72932';
const GITHUB_REPO = 'Ono';
const GITHUB_FILE = '1o.json';
const GITHUB_BRANCH = 'main';

// ============================================================
// أدوات
// ============================================================

function maskToken(value) {
    if (!value) return 'غير موجود';
    const text = String(value);
    if (text.length <= 16) return `${text.slice(0, 4)}...${text.slice(-4)}`;
    return `${text.slice(0, 8)}...${text.slice(-8)}`;
}

// ============================================================
// قراءة الرموز من GitHub
// ============================================================

async function fetchTokensFromGitHub() {
    if (!GITHUB_TOKEN) {
        throw new Error('❌ WOLF_TOKENS_PAT غير موجود في متغيرات البيئة');
    }

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`;
    console.log('🌐 قراءة الرموز من:', url);

    const res = await fetch(url, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'wolf-bot'
        }
    });

    if (res.status === 404) {
        throw new Error('❌ ملف token.json غير موجود في المستودع Too');
    }
    if (res.status === 401) {
        throw new Error('❌ WOLF_TOKENS_PAT غير صالح أو منتهي');
    }
    if (res.status === 403) {
        throw new Error('❌ الصلاحيات غير كافية — تأكد من Contents: Read-only على Too');
    }
    if (!res.ok) {
        throw new Error(`❌ فشل قراءة الملف: HTTP ${res.status} — ${await res.text()}`);
    }

    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const tokens = JSON.parse(content);

    console.log('✅ تم تحميل الرموز من GitHub');
    console.log(`📅 آخر تحديث: ${tokens.updatedAt || 'غير معروف'}`);

    return tokens;
}

// ============================================================
// loadSession — الواجهة الرئيسية
// ============================================================

export async function loadSession() {
    console.log('');
    console.log('========================================');
    console.log('🔐 تحميل الجلسة من GitHub');
    console.log('========================================');
    console.log(`📦 المستودع: ${GITHUB_OWNER}/${GITHUB_REPO}`);
    console.log(`📄 الملف: ${GITHUB_FILE}`);
    console.log(`🌿 الفرع: ${GITHUB_BRANCH}`);
    console.log('');

    const tokens = await fetchTokensFromGitHub();

    if (!tokens.v3APIToken) {
        throw new Error('❌ v3APIToken مفقود في token.json');
    }
    if (!tokens.appCheckToken) {
        throw new Error('❌ appCheckToken مفقود في token.json');
    }

    console.log('');
    console.log('========================================');
    console.log('🔐 WOLF Credentials');
    console.log('========================================');
    console.log(`🔐 v3APIToken: ${maskToken(tokens.v3APIToken)}`);
    console.log(`🔐 Token length: ${tokens.v3APIToken.length}`);
    console.log(`🛡️ appCheckToken: ${maskToken(tokens.appCheckToken)}`);
    console.log(`🛡️ AppCheck length: ${tokens.appCheckToken.length}`);

    if (tokens.deviceToken) {
        console.log(`📱 deviceToken: ${maskToken(tokens.deviceToken)}`);
        console.log(`📱 DeviceToken length: ${tokens.deviceToken.length}`);
    }

    console.log('📱 Device: web');
    console.log('========================================');

    return {
        token: tokens.v3APIToken,
        appCheckToken: tokens.appCheckToken,
        deviceToken: tokens.deviceToken || '',
        device: 'web',
        isAppCheckEnabled: true,
        page: null
    };
}

export async function closeSessionBrowser() {
    console.log('ℹ️ لا يوجد متصفح لإغلاقه (الرموز من GitHub)');
}
