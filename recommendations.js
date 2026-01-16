const fetchModule = (...args) => import("node-fetch").then(m => m.default(...args));

// Cache the problem set to avoid hitting CF API on every request
let problemSetCache = {
    problems: [],
    lastUpdated: 0
};

async function getProblemSet() {
    if (Date.now() - problemSetCache.lastUpdated < 60 * 60 * 1000 && problemSetCache.problems.length > 0) {
        return problemSetCache.problems;
    }

    try {
        const res = await fetchModule("https://codeforces.com/api/problemset.problems");
        const data = await res.json();
        if (data.status === "OK") {
            problemSetCache.problems = data.result.problems;
            problemSetCache.lastUpdated = Date.now();
            console.log(`[Recommendations] Cached ${data.result.problems.length} problems.`);
        }
        return problemSetCache.problems;
    } catch (e) {
        console.error("[Recommendations] Failed to fetch problem set:", e.message);
        return [];
    }
}

async function getRecommendations(userStats) {
    if (!userStats || userStats.platform !== "codeforces") {
        return [];
    }

    const handle = userStats.handle;
    // Determine current rating (default to 800 if unrated)
    const currentRating = userStats.ratingHistory.length > 0
        ? userStats.ratingHistory[userStats.ratingHistory.length - 1].rating
        : 800;

    // Define "Growth Zone": [current + 100, current + 400]
    // Cap at 3500, min at 800
    const minRating = Math.max(800, currentRating + 100);
    const maxRating = Math.min(3500, currentRating + 400);

    // Identify "Weak Tags"
    // Logic: Look at tags with solve counts. We want tags that user has at least TRIED or are standard.
    // precise logic: Randomly pick standard tags or look at `tagStrengths` (inverted).
    // For simplicity V1: Just recommend balanced problems in rating range.

    const allProblems = await getProblemSet();

    // Set of already solved problem IDs (contestId-index)
    const solvedIds = new Set(userStats.solvedProblems.map(p => p.id)); // Assuming userStats has solvedProblems populated

    // Filter candidates
    const candidates = allProblems.filter(p => {
        // Check rating
        if (!p.rating || p.rating < minRating || p.rating > maxRating) return false;

        // Check if already solved
        const pid = `${p.contestId}-${p.index}`;
        if (solvedIds.has(pid)) return false;

        // Filter out very obscure tags if needed? No, standard problems usually have standard tags.
        return true;
    });

    // Shuffle and pick 3-5
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5).map(p => ({
        title: p.name,
        contestId: p.contestId,
        index: p.index,
        rating: p.rating,
        tags: p.tags,
        link: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`
    }));
}

module.exports = { getRecommendations };
