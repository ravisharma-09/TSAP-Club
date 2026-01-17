/**
 * Data Aggregation Utilities
 * Handles aggregation of member data into club-level statistics
 */

/**
 * Aggregate member data into club statistics
 * @param {Array} members - Array of member objects
 * @returns {Object} Aggregated club statistics
 */
function aggregateClubStats(members) {
    if (!Array.isArray(members) || members.length === 0) {
        return {
            totalMembers: 0,
            totalProblemsSolved: 0,
            averageRating: 0,
            platformStats: {
                codeforces: { count: 0, avgRating: 0 },
                leetcode: { count: 0, avgProblems: 0 },
                codechef: { count: 0, avgRating: 0 }
            }
        };
    }

    let totalProblems = 0;
    let cfRatings = [];
    let lcProblems = [];
    let ccRatings = [];

    members.forEach(member => {
        // Skip invalid members
        if (!member || typeof member !== 'object') {
            console.warn('Invalid member data:', member);
            return;
        }

        // Aggregate problems solved
        if (typeof member.problemsSolved === 'number' && member.problemsSolved >= 0) {
            totalProblems += member.problemsSolved;
        }

        // Aggregate platform stats
        if (member.ratings) {
            if (member.ratings.codeforces) {
                cfRatings.push(member.ratings.codeforces);
            }
            if (member.ratings.leetcode) {
                lcProblems.push(member.ratings.leetcode);
            }
            if (member.ratings.codechef) {
                ccRatings.push(member.ratings.codechef);
            }
        }
    });

    // Calculate averages
    const avgCF = cfRatings.length > 0
        ? Math.round(cfRatings.reduce((a, b) => a + b, 0) / cfRatings.length)
        : 0;

    const avgLC = lcProblems.length > 0
        ? Math.round(lcProblems.reduce((a, b) => a + b, 0) / lcProblems.length)
        : 0;

    const avgCC = ccRatings.length > 0
        ? Math.round(ccRatings.reduce((a, b) => a + b, 0) / ccRatings.length)
        : 0;

    return {
        totalMembers: members.length,
        totalProblemsSolved: totalProblems,
        averageRating: Math.round((avgCF + avgCC) / 2),
        platformStats: {
            codeforces: { count: cfRatings.length, avgRating: avgCF },
            leetcode: { count: lcProblems.length, avgProblems: avgLC },
            codechef: { count: ccRatings.length, avgRating: avgCC }
        }
    };
}

/**
 * Validate member data before aggregation
 * @param {Object} member - Member object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateMemberData(member) {
    if (!member || typeof member !== 'object') {
        return false;
    }

    // Required fields
    if (!member.id || !member.name) {
        return false;
    }

    // Validate problemsSolved
    if (member.problemsSolved !== undefined) {
        if (typeof member.problemsSolved !== 'number' || member.problemsSolved < 0) {
            return false;
        }
    }

    return true;
}

/**
 * Calculate contest streak (placeholder - needs real implementation)
 * @param {Array} members - Array of member objects
 * @returns {number} Contest streak in days
 */
function calculateContestStreak(members) {
    // TODO: Implement based on actual contest participation data
    return 30; // Placeholder
}

/**
 * Get top performers
 * @param {Array} members - Array of member objects
 * @param {number} limit - Number of top performers to return
 * @returns {Array} Top performers sorted by problems solved
 */
function getTopPerformers(members, limit = 10) {
    return members
        .filter(m => validateMemberData(m))
        .sort((a, b) => (b.problemsSolved || 0) - (a.problemsSolved || 0))
        .slice(0, limit)
        .map(m => ({
            id: m.id,
            name: m.name,
            problemsSolved: m.problemsSolved || 0,
            ratings: m.ratings || {}
        }));
}

module.exports = {
    aggregateClubStats,
    validateMemberData,
    calculateContestStreak,
    getTopPerformers
};
