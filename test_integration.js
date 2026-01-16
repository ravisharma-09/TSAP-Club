const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

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
        const response = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com" // Important for LeetCode API
            },
            body: JSON.stringify({
                query: query,
                variables: { username }
            })
        });

        // Check text first in case of HTML error page
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (!json.data || !json.data.matchedUser) {
                console.warn(`[LeetCode] User not found: ${username}`);
                return null;
            }

            const stats = json.data.matchedUser.submitStats.acSubmissionNum;
            const totalSolved = stats.find(s => s.difficulty === "All").count;

            console.log("LeetCode Success:", {
                handle: username,
                total: totalSolved,
                rank: json.data.matchedUser.profile.ranking
            });
        } catch (e) {
            console.error("LeetCode JSON Parse Error:", e);
            console.log("Response Text Preview:", text.substring(0, 500));
        }

    } catch (e) {
        console.error(`[LeetCode] Error fetching ${username}:`, e.message);
    }
}

async function fetchCodechefStats(username) {
    if (!username) return null;

    try {
        const response = await fetch(`https://codechef.com/users/${username}`);
        const html = await response.text();

        const ratingMatch = html.match(/<div class="rating-number">(\d+)<\/div>/);
        // "Fully Solved (123)"
        const solvedMatch = html.match(/Fully Solved \(\s*(\d+)\s*\)/);

        const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;
        const totalSolved = solvedMatch ? parseInt(solvedMatch[1], 10) : 0;

        console.log("CodeChef Success:", {
            handle: username,
            rating,
            totalSolved
        });

    } catch (e) {
        console.warn(`[CodeChef] Error fetching ${username}:`, e.message);
    }
}

// Test with known handles (using ones from the users list in server.js)
console.log("Starting tests...");
fetchLeetCodeStats("tourist").then(() => console.log("LC Test 1 Done")); // User doesn't exist on LC usually, try 'tmwilliamlin168' or generic
fetchLeetCodeStats("leetcode");
fetchCodechefStats("tourist"); 
