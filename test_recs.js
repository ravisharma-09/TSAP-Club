const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

async function testRecs() {
    const handle = "tourist"; // Someone with many solved problems
    const url = `http://localhost:3000/api/dashboard/recommendations?handle=${handle}`;

    console.log(`Testing Recommendations for ${handle}...`);
    try {
        const res = await fetch(url);
        const data = await res.json();

        if (Array.isArray(data)) {
            console.log(`Success! Received ${data.length} recommendations.`);
            data.forEach((p, i) => {
                console.log(`${i + 1}. [${p.rating}] ${p.title} (${p.tags.join(", ")})`);
            });
        } else {
            console.error("Failed:", data);
        }
    } catch (e) {
        console.error("Error connecting to server:", e.message);
        console.log("Ensure the server is running (npm start)!");
    }
}

testRecs();
