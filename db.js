const admin = require("firebase-admin");
const crypto = require("crypto");

// In-memory fallback
let users = [];
let sessions = new Map();
let nextUserId = 1;

// Default users for fallback/initialization
const defaultUsers = [
    {
        id: 1,
        name: "Ravi Sharma",
        email: "ravi.sharma@tsap.club",
        passwordHash: crypto.createHash("sha256").update("admin123").digest("hex"),
        role: "admin",
        handles: { codeforces: "ravisharma-09", leetcode: "", codechef: "ravisharma_09" }
    },
    {
        id: 2,
        name: "Aarpan Lohora",
        email: "aarpan.lohora@tsap.club",
        passwordHash: crypto.createHash("sha256").update("member123").digest("hex"),
        role: "member",
        handles: { codeforces: "AarpanLohora", leetcode: "", codechef: "aarpanlohora" }
    }
];

// Initialize default users
users = [...defaultUsers];
nextUserId = users.length + 1;

// Check if Firebase is active
function isFirebaseActive() {
    return admin.apps.length > 0;
}

// Data Access Layer
const db = {

    // User Methods
    async getUserById(id) {
        if (isFirebaseActive()) {
            try {
                const snap = await admin.database().ref(`users/${id}`).once('value');
                return snap.val();
            } catch (e) { console.error("Firebase Read Error:", e); }
        }
        return users.find(u => u.id === id);
    },

    async getUserByEmail(email) {
        // Normalizing email
        const target = email.toLowerCase();

        if (isFirebaseActive()) {
            try {
                // In RTDB, cannot query easily by email without index. 
                // For prototype, fetching all (inefficient) or using Firestore is better.
                // Switching to Firestore for this query if possible? No, sticking to one DB.
                // Let's assume fetching all for now as user base is small (<100).
                const snap = await admin.database().ref('users').once('value');
                const val = snap.val();
                if (!val) return null;
                return Object.values(val).find(u => u.email.toLowerCase() === target);
            } catch (e) { console.error("Firebase Query Error:", e); }
        }
        return users.find(u => u.email.toLowerCase() === target);
    },

    async createUser(userData) {
        const newUser = { ...userData, id: nextUserId++ };

        if (isFirebaseActive()) {
            try {
                // Using RTDB
                await admin.database().ref(`users/${newUser.id}`).set(newUser);
            } catch (e) {
                console.error("Firebase Write Error:", e);
                // Fallback to memory so app doesn't break
            }
        }
        users.push(newUser);
        return newUser;
    },

    async getAllUsers() {
        if (isFirebaseActive()) {
            try {
                const snap = await admin.database().ref('users').once('value');
                const val = snap.val();
                return val ? Object.values(val) : [];
            } catch (e) { console.error("Firebase List Error:", e); }
        }
        return users;
    },

    // Session Methods
    async createSession(userId) {
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, userId);
        return token;
    },

    async getSessionUser(token) {
        const userId = sessions.get(token);
        if (!userId) return null;
        return this.getUserById(userId);
    },

    async deleteSession(token) {
        sessions.delete(token);
    },

    // Init helper
    async init() {
        if (isFirebaseActive()) {
            // Sync initial users if DB is empty
            const current = await this.getAllUsers();
            if (current.length === 0) {
                console.log("[DB] Seeding default users to Firebase...");
                for (const u of defaultUsers) {
                    await admin.database().ref(`users/${u.id}`).set(u);
                }
                nextUserId = defaultUsers.length + 1;
            } else {
                // Update nextUserId based on max ID
                const maxId = current.reduce((max, u) => Math.max(max, u.id || 0), 0);
                nextUserId = maxId + 1;
            }
        }
    }
};

module.exports = db;
