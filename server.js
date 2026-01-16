const express = require("express");
const path = require("path");
const crypto = require("crypto");
const admin = require("firebase-admin");

// Initialize Firebase Admin (Note: Requires SERVICE_ACCOUNT_KEY env var or default credentials)
// For now, we'll try to initialize, but fall back gracefully if not configured to avoid checking app crash during dev
try {
  if (process.env.SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://tsap-club-default-rtdb.firebaseio.com" // Replace with actual
    });
    console.log("[Firebase] Initialized with Service Account");
  } else {
    console.log("[Firebase] No credentials found. Running in Memory Mode.");
  }
} catch (e) {
  console.warn("[Firebase] Initialization failed. Some features may not work:", e.message);
}

const fetchModule = (...args) => import("node-fetch").then(m => m.default(...args));

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

const db = require("./db");
const recommendations = require("./recommendations");

// Initialize DB abstraction (Handles seeding / Firebase connection)
db.init().catch(console.error);

// LEADERBOARD CACHE
const leaderboardCache = {
  data: [],
  lastUpdated: 0,
  isUpdating: false
};

async function updateGlobalLeaderboard() {
  if (leaderboardCache.isUpdating) return;
  leaderboardCache.isUpdating = true;
  console.log("[Leaderboard] Starting update...");

  const results = [];

  const allUsers = await db.getAllUsers();

  for (const user of allUsers) {
    if (!user.handles.codeforces) continue;

    try {
      console.log(`[Leaderboard] Fetching for ${user.name} (${user.handles.codeforces})...`);
      // Add a small delay to be nice to Codeforces API
      await new Promise(r => setTimeout(r, 500));

      const stats = await fetchCodeforcesStats(user.handles.codeforces);
      if (stats) {
        results.push({
          userId: user.id,
          name: user.name,
          handle: user.handles.codeforces,
          platform: "codeforces",
          totalSolved: stats.totalProblemsSolved,
          rating: stats.ratingHistory.length > 0 ? stats.ratingHistory[stats.ratingHistory.length - 1].rating : 0,
          maxRating: stats.ratingHistory.reduce((max, r) => Math.max(max, r.rating), 0)
        });
      }
    } catch (e) {
      console.error(`[Leaderboard] Failed for ${user.name}:`, e.message);
      // Keep existing data if available or push error state
      results.push({
        userId: user.id,
        name: user.name,
        handle: user.handles.codeforces,
        platform: "codeforces",
        totalSolved: 0,
        rating: 0,
        error: "Failed to fetch"
      });
    }
  }

  // Sort by rating (desc) then totalSolved (desc)
  results.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.totalSolved - a.totalSolved;
  });

  leaderboardCache.data = results;
  leaderboardCache.lastUpdated = Date.now();
  leaderboardCache.isUpdating = false;
  console.log("[Leaderboard] Update complete.");
}

// Trigger initial update shortly after start
setTimeout(updateGlobalLeaderboard, 5000);

// function list removed (handled in db.js or not needed)

function setSessionCookie(res, token) {
  const cookie = [
    `tsap_session=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax"
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

function getSessionTokenFromRequest(req) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  const parts = header.split(";").map(v => v.trim());
  for (const part of parts) {
    if (part.startsWith("tsap_session=")) {
      return part.slice("tsap_session=".length);
    }
  }
  return null;
}

async function authMiddleware(req, res, next) {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await db.getSessionUser(token);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function toDateKey(timestampSeconds) {
  const d = new Date(timestampSeconds * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchCodeforcesStats(handle) {
  if (!handle) {
    return null;
  }

  const base = "https://codeforces.com/api";

  const [infoRes, ratingRes, statusRes] = await Promise.all([
    fetchModule(`${base}/user.info?handles=${encodeURIComponent(handle)}`),
    fetchModule(`${base}/user.rating?handle=${encodeURIComponent(handle)}`),
    fetchModule(`${base}/user.status?handle=${encodeURIComponent(handle)}`)
  ]);

  const infoJson = await infoRes.json();
  const ratingJson = await ratingRes.json();
  const statusJson = await statusRes.json();

  if (infoJson.status !== "OK") {
    throw new Error("Failed to fetch Codeforces user info");
  }

  const submissions = statusJson.status === "OK" ? statusJson.result : [];
  const ratingUpdates = ratingJson.status === "OK" ? ratingJson.result : [];

  const solvedSet = new Set();
  let acceptedCount = 0;
  let totalSubmissions = 0;
  const tagCounts = {};
  const activityCalendar = {};
  const solvedProblems = {};

  for (const sub of submissions) {
    if (!sub.problem) {
      continue;
    }
    totalSubmissions += 1;
    const problem = sub.problem;
    const problemKey = `${problem.contestId || "custom"}-${problem.index || problem.name}`;
    const verdict = sub.verdict;
    if (verdict === "OK") {
      acceptedCount += 1;
      solvedSet.add(problemKey);
      const dateKey = toDateKey(sub.creationTimeSeconds);
      activityCalendar[dateKey] = (activityCalendar[dateKey] || 0) + 1;
      if (!solvedProblems[problemKey]) {
        solvedProblems[problemKey] = {
          id: problemKey,
          title: problem.name,
          rating: problem.rating || null,
          tags: Array.isArray(problem.tags) ? problem.tags.slice() : []
        };
      }
      if (Array.isArray(problem.tags)) {
        for (const tag of problem.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }
  }

  const totalProblemsSolved = solvedSet.size;
  const submissionAccuracy = totalSubmissions > 0 ? acceptedCount / totalSubmissions : null;

  const ratingHistory = ratingUpdates.map(update => ({
    contestName: update.contestName,
    rating: update.newRating,
    timeSeconds: update.ratingUpdateTimeSeconds
  }));

  const contestFrequencyMap = {};
  for (const update of ratingUpdates) {
    const key = toDateKey(update.ratingUpdateTimeSeconds).slice(0, 7);
    contestFrequencyMap[key] = (contestFrequencyMap[key] || 0) + 1;
  }
  const contestFrequency = Object.entries(contestFrequencyMap).map(([month, count]) => ({
    month,
    contests: count
  }));

  const tagStrengths = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, solved: count }))
    .sort((a, b) => b.solved - a.solved);

  return {
    platform: "codeforces",
    handle,
    totalProblemsSolved,
    submissionAccuracy,
    ratingHistory,
    contestFrequency,
    tagStrengths,
    solvedProblems: Object.values(solvedProblems),
    activityCalendar
  };
}

async function fetchLeetCodeStats(username) {
  if (!username) return null;

  const query = `
    query customerProfile($username: String!) {
      matchedUser(username: $username) {
        username
        submitStats: submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
        }
        profile {
          ranking
          reputation
        }
      }
    }
  `;

  try {
    const response = await fetchModule("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com"
      },
      body: JSON.stringify({
        query: query,
        variables: { username }
      })
    });

    const json = await response.json();
    if (!json.data || !json.data.matchedUser) {
      console.warn(`[LeetCode] User not found: ${username}`);
      return null;
    }

    const stats = json.data.matchedUser.submitStats.acSubmissionNum;
    const totalSolved = stats.find(s => s.difficulty === "All").count;

    return {
      platform: "leetcode",
      handle: username,
      totalProblemsSolved: totalSolved,
      breakdown: stats,
      ranking: json.data.matchedUser.profile.ranking,
      supported: true
    };
  } catch (e) {
    console.error(`[LeetCode] Error fetching ${username}:`, e.message);
    return null;
  }
}

async function fetchCodechefStats(username) {
  if (!username) return null;

  try {
    // Scraping public profile as no easy public API exists
    const response = await fetchModule(`https://codechef.com/users/${username}`);
    const html = await response.text();

    // Simple regex to extract rating (very brittle, but standard for this kind of "integration")
    // Looking for <div class="rating-number">1650</div>
    const ratingMatch = html.match(/<div class="rating-number">(\d+)<\/div>/);
    // Looking for global rank
    const globalRankMatch = html.match(/<strong>Global Rank:<\/strong>\s*(\d+)/);

    // For problems solved, CodeChef page structure is complex. 
    // We might look for "Fully Solved (123)"
    const solvedMatch = html.match(/Fully Solved \(\s*(\d+)\s*\)/);

    const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;
    const totalSolved = solvedMatch ? parseInt(solvedMatch[1], 10) : 0;

    return {
      platform: "codechef",
      handle: username,
      rating: rating,
      totalProblemsSolved: totalSolved,
      supported: true
    };
  } catch (e) {
    console.warn(`[CodeChef] Error fetching ${username}:`, e.message);
    return {
      platform: "codechef",
      handle: username,
      error: "Failed to scrape",
      supported: false
    };
  }
}

async function aggregateStatsForHandles(handles) {
  const [cf, lc, cc] = await Promise.all([
    fetchCodeforcesStats(handles.codeforces),
    fetchLeetCodeStats(handles.leetcode),
    fetchCodechefStats(handles.codechef)
  ]);

  const platforms = [cf, lc, cc].filter(Boolean);

  const totalProblemsSolved = platforms.reduce((sum, p) => {
    return sum + (p.totalProblemsSolved || 0);
  }, 0);

  let totalAccepted = 0;
  let totalSubmissions = 0;
  if (cf && cf.submissionAccuracy !== null && cf.submissionAccuracy !== undefined) {
    totalAccepted += cf.submissionAccuracy * (cf.totalProblemsSolved || 0);
    totalSubmissions += cf.totalProblemsSolved || 0;
  }
  const aggregatedAccuracy = totalSubmissions > 0 ? totalAccepted / totalSubmissions : null;

  const leaderboardEntry = platforms.map(p => ({
    platform: p.platform,
    handle: p.handle,
    totalProblemsSolved: p.totalProblemsSolved || 0
  })).sort((a, b) => b.totalProblemsSolved - a.totalProblemsSolved);

  return {
    totalProblemsSolved,
    aggregatedAccuracy,
    platforms,
    leaderboardByProblemsSolved: leaderboardEntry
  };
}

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, codeforces, leetcode, codechef } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }

  const existing = await db.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: "Email already registered" });
  }

  // First user is admin logic: check if any users exist
  const allUsers = await db.getAllUsers();
  const role = allUsers.length === 0 ? "admin" : "member";

  const newUser = await db.createUser({
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    handles: {
      codeforces: codeforces || "",
      leetcode: leetcode || "",
      codechef: codechef || ""
    }
  });

  const token = await db.createSession(newUser.id);
  setSessionCookie(res, token);
  res.json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    handles: newUser.handles
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  console.log(`[Login Attempt] Email: ${email}, Password provided: ${!!password}`);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await db.getUserByEmail(email);
  console.log(`[Login Debug] User found: ${user ? user.name : "No"}`);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const hash = hashPassword(password);
  const match = hash === user.passwordHash;
  console.log(`[Login Debug] Hash match: ${match}`);

  if (!match) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = await db.createSession(user.id);
  setSessionCookie(res, token);
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    handles: user.handles
  });
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  if (req.sessionToken) {
    await db.deleteSession(req.sessionToken);
  }
  res.setHeader("Set-Cookie", "tsap_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  res.json({ ok: true });
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    handles: req.user.handles
  });
});

app.get("/api/members", authMiddleware, async (req, res) => {
  const allUsers = await db.getAllUsers();
  const list = allUsers.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    handles: u.handles
  }));
  res.json(list);
});

app.get("/api/members/:id/dashboard", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const member = await db.getUserById(id);
  if (!member) {
    return res.status(404).json({ error: "Member not found" });
  }
  try {
    const data = await aggregateStatsForHandles(member.handles);
    res.json({
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        handles: member.handles
      },
      dashboard: data
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to fetch member dashboard" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  // If data is older than 15 minutes, trigger update
  if (Date.now() - leaderboardCache.lastUpdated > 15 * 60 * 1000) {
    updateGlobalLeaderboard().catch(console.error);
  }

  res.json({
    updatedAt: leaderboardCache.lastUpdated,
    isUpdating: leaderboardCache.isUpdating,
    data: leaderboardCache.data
  });
});

app.get("/api/admin/members", authMiddleware, adminMiddleware, async (req, res) => {
  const allUsers = await db.getAllUsers();
  const list = allUsers.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    handles: u.handles
  }));
  res.json(list);
});

app.get("/api/dashboard/overview", async (req, res) => {
  const codeforcesHandle = req.query.codeforces;
  const leetcodeUsername = req.query.leetcode;
  const codechefUsername = req.query.codechef;

  try {
    const data = await aggregateStatsForHandles({
      codeforces: codeforcesHandle,
      leetcode: leetcodeUsername,
      codechef: codechefUsername
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to fetch dashboard data" });
  }
});

app.get("/api/dashboard/platforms", async (req, res) => {
  const codeforcesHandle = req.query.codeforces;
  const leetcodeUsername = req.query.leetcode;
  const codechefUsername = req.query.codechef;

  try {
    const [cf, lc, cc] = await Promise.all([
      fetchCodeforcesStats(codeforcesHandle),
      fetchLeetCodeStats(leetcodeUsername),
      fetchCodechefStats(codechefUsername)
    ]);
    res.json({
      codeforces: cf,
      leetcode: lc,
      codechef: cc
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to fetch platform stats" });
  }
});

app.get("/api/dashboard/recommendations", async (req, res) => {
  const handle = req.query.handle;
  if (!handle) {
    return res.status(400).json({ error: "Handle required" });
  }

  try {
    // We need user stats to generate recommendations
    // Check if we have cached stats or fresh fetch
    // For now, let's just fetch fresh CF stats (or use cached if we implemented general caching)
    const stats = await fetchCodeforcesStats(handle);
    if (!stats) {
      return res.status(404).json({ error: "Codeforces profile not found" });
    }

    const recs = await recommendations.getRecommendations(stats);
    res.json(recs);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to generate recommendations" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  process.stdout.write(`TSAP server running on http://localhost:${port}\n`);
});
