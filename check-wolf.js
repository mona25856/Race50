// check-wolf.js
import wolfjs from "wolf.js";
import { io } from "socket.io-client";
import { loadSession, closeSessionBrowser } from "./session-loader.js";

const { WOLF, OnlineState } = wolfjs;

// ============================================================
// إعدادات أوامر بوت ملوك
// ============================================================
const settings = {
    channelId: 224,
    attack: { message: '!ملوك هجوم', repeat: 3, gapMs: 1000, waitMs: 5 * 60 * 1000 + 1000 },
    training: { message: '!ملوك تدريب', repeat: 1, gapMs: 0, waitMs: 2 * 60 * 1000 + 1000 },
    mercenary: { message: '!ملوك مرتزقة 🪶', repeat: 3, gapMs: 1000, waitMs: 10 * 60 * 1000 + 1000 },
    armor: { message: '!ملوك درع 6', repeat: 1, gapMs: 0, waitMs: 1 * 60 * 1000 + 1000 }
};

const WALL_CASTLE = {
    wall:   '!ملوك سور تطوير',
    castle: '!ملوك قلعة تطوير',
    repeat: 10,
    waitMs: 31 * 60 * 1000   // 31 دقيقة
};

// ============================================================
// Variables
// ============================================================
let WOLF_TOKEN = null;
let WOLF_APP_CHECK_TOKEN = null;
let WOLF_DEVICE_TOKEN = null;

let service = null;
let socket = null;
let running = true;
let shuttingDown = false;
let browserClosed = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function maskToken(value) {
    if (!value) return "غير موجود";
    const text = String(value);
    if (text.length <= 16) return `${text.slice(0, 4)}...${text.slice(-4)}`;
    return `${text.slice(0, 8)}...${text.slice(-8)}`;
}

// ============================================================
// Load WOLF Credentials (من GitHub)
// ============================================================
async function loadWolfCredentials() {
    const session = await loadSession();
    if (!session || !session.token) {
        throw new Error("❌ تعذر تحميل الرموز من token.json");
    }
    WOLF_TOKEN = session.token;
    WOLF_APP_CHECK_TOKEN = session.appCheckToken;
    WOLF_DEVICE_TOKEN = session.deviceToken || '';
}

// ============================================================
// Create WOLF Service
// ============================================================
function createWolfService() {
    console.log("\n🐺 إنشاء WOLF service...");
    service = new WOLF();
    service.config.framework.login.token = WOLF_TOKEN;
    service.config.framework.login.onlineState = OnlineState.BUSY; // بوت ملوك يفضل أن يكون BUSY
    if (WOLF_APP_CHECK_TOKEN) {
        service.config.framework.login.appCheckToken = WOLF_APP_CHECK_TOKEN;
    }
    console.log("✅ WOLF service جاهز");
}

// ============================================================
// Initialize WOLF Handlers
// ============================================================
async function initializeWolfHandlers() {
    console.log("\n⚙️ [WOLF] Initializing wolf.js handlers...");
    await service.websocket.init();
    const handlerCount = Object.keys(service.websocket.handlers || {}).length;
    console.log(`⚙️ [WOLF] Loaded ${handlerCount} socket handlers`);
}

// ============================================================
// Connect WOLF Socket.IO (نفس طريقة بوت الستيج)
// ============================================================
async function connectWolfSocket() {
    const connection = service._frameworkConfig?.get?.("connection");
    const host = connection?.host || "https://v3-rc.palringo.com";
    const port = connection?.port ?? 443;

    const connectionDevice = "web";
    const isAppCheckEnabled = WOLF_APP_CHECK_TOKEN ? 'true' : 'false';

    console.log("\n========================================");
    console.log("🔌 تشغيل اتصال WOLF API");
    console.log("========================================");
    console.log(`🌐 Host: ${host} | 🔌 Port: ${port}`);
    
    socket = io(`${host}:${port}`, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 5000,
        reconnectionAttempts: Infinity,
        autoConnect: false,
        query: {
            token: WOLF_TOKEN,
            device: connectionDevice,
            state: service.config.framework.login.onlineState,
            version: connection?.version || undefined,
            isAppCheckEnabled: isAppCheckEnabled,
            appCheckToken: WOLF_APP_CHECK_TOKEN || undefined,
            deviceToken: WOLF_DEVICE_TOKEN || undefined
        }
    });

    service.websocket.socket = socket;

    socket.on("connect", () => {
        console.log(`🔗 [WOLF] Socket.IO connected (ID: ${socket.id})`);
    });

    socket.on("connect_error", error => {
        console.error("❌ [WOLF] Socket connect error:", error?.message || error);
    });

    socket.on("disconnect", reason => {
        console.log(`🔌 [WOLF] Socket disconnected: ${reason}`);
    });

    socket.onAny(async (eventName, data) => {
        try {
            if (eventName === 'group event update') return;
            const handler = service.websocket.handlers?.[eventName];
            if (!handler) return;
            await handler.process(data?.body ?? data);
        } catch (error) {
            console.error(`❌ Handler error [${eventName}]:`, error?.message || error);
        }
    });

    console.log("🔌 [WOLF] Connecting...");
    socket.connect();
    await waitForAuthorization();
}

async function waitForAuthorization(timeout = 60000) {
    const start = Date.now();
    console.log("⏳ [WOLF] Waiting for authorization...");
    while (Date.now() - start < timeout) {
        if (service.currentSubscriber?.id) {
            console.log(`✅ [WOLF] Authorization complete | Subscriber ID: ${service.currentSubscriber.id}`);
            return;
        }
        await sleep(500);
    }
    throw new Error("Timeout waiting for WOLF authorization");
}

// ============================================================
// Task Loops
// ============================================================
async function sendToChannel(text) {
    try {
        await service.messaging.sendGroupMessage(settings.channelId, text);
        console.log(`🚀 [${settings.channelId}] ← "${text}"`);
    } catch (err) {
        console.error(`❌ فشل إرسال "${text}":`, err?.message || err);
    }
}

async function taskLoop(name, config) {
    while (running) {
        try {
            console.log(`▶️ [${name}] إرسال ${config.repeat} مرة`);
            for (let i = 0; i < config.repeat; i++) {
                if (!running) return;
                await sendToChannel(config.message);
                if (i < config.repeat - 1 && config.gapMs > 0) await sleep(config.gapMs);
            }
            console.log(`⏳ [${name}] انتظار ${Math.round(config.waitMs / 1000)} ثانية`);
            await sleep(config.waitMs);
        } catch (err) {
            console.error(`❌ [${name}] خطأ:`, err?.message || err);
            await sleep(5000);
        }
    }
}

async function wallCastleLoop() {
    while (running) {
        try {
            console.log(`▶️ [سور تطوير] إرسال ${WALL_CASTLE.repeat} مرة (كل 31 دقيقة)`);
            for (let i = 0; i < WALL_CASTLE.repeat; i++) {
                if (!running) return;
                await sendToChannel(WALL_CASTLE.wall);
                console.log(`⏳ [سور تطوير] ${i + 1}/${WALL_CASTLE.repeat} — انتظار 31 دقيقة`);
                await sleep(WALL_CASTLE.waitMs);
            }

            if (!running) return;
            console.log('🏰 [قلعة تطوير] إرسال مرة واحدة');
            await sendToChannel(WALL_CASTLE.castle);
            console.log('⏳ [قلعة تطوير] انتظار 31 دقيقة');
            await sleep(WALL_CASTLE.waitMs);
        } catch (err) {
            console.error('❌ [سور/قلعة] خطأ:', err?.message || err);
            await sleep(5000);
        }
    }
}

function startTasks() {
    console.log('\n⚙️ تشغيل المهام');
    taskLoop('هجوم',   settings.attack);
    taskLoop('تدريب',  settings.training);
    taskLoop('مرتزقة', settings.mercenary);
    taskLoop('درع',    settings.armor);
    wallCastleLoop();
}

function startHeartbeat() {
    setInterval(() => {
        if (!running) return;
        const connected = socket?.connected;
        console.log(`💓 Heartbeat | socket=${connected ? 'ON' : 'OFF'}`);
        if (!connected && socket) {
            try { socket.connect(); } catch {}
        }
    }, 60000).unref();
}

// ============================================================
// Shutdown
// ============================================================
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    running = false;

    console.log("\n========================================");
    console.log(`🛑 إغلاق البوت بسبب ${signal}`);
    console.log("========================================");

    try { socket?.disconnect(); } catch {}
    try { service?.websocket?.socket?.disconnect(); } catch {}

    try {
        if (!browserClosed) {
            browserClosed = true;
            await closeSessionBrowser();
        }
    } catch (err) {
        console.log("⚠️ تعذر إغلاق الجلسة:", err?.message || err);
    }

    process.exitCode = 0;
    setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

// ============================================================
// Main
// ============================================================
async function main() {
    console.log("\n🐺 WOLF Malook Bot started");
    console.log("========================================");
    console.log("🔐 Tokens from: Ana72932/Too");
    console.log("========================================");

    try {
        await loadWolfCredentials();
        createWolfService();
        await initializeWolfHandlers();
        await connectWolfSocket();
        
        // تعيين الحالة بعد الاتصال
        await service.setOnlineState(OnlineState.BUSY);

        console.log("\n🟢 تم تسجيل الدخول بنجاح.");
        console.log(`📢 سيتم إرسال الأوامر إلى القناة: ${settings.channelId}`);

        startTasks();
        startHeartbeat();

        console.log("\n========================================");
        console.log("✅ [BOT] كل شيء يعمل وبوت ملوك مستمر...");
        console.log("========================================");

        // إيقاف تلقائي بعد 5 ساعات و41 دقيقة
        const AUTO_SHUTDOWN_MS = (5 * 60 + 41) * 60 * 1000;
        setTimeout(() => {
            console.log('⏰ انتهت مدة التشغيل التلقائي — إغلاق سلس');
            shutdown("AUTO_TIMEOUT");
        }, AUTO_SHUTDOWN_MS).unref();

    } catch (error) {
        console.error("\n❌ FATAL ERROR");
        console.error(error?.stack || error?.message || error);
        await shutdown("FATAL_ERROR");
    }
}

main();
