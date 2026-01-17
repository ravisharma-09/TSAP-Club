/**
 * Sync Service
 * Main orchestrator for data synchronization and aggregation
 */

const { aggregateClubStats, validateMemberData } = require('../utils/aggregator');
const {
    calculateClubMilestones,
    getNewlyAchievedMilestones,
    calculateMemberMilestone,
    getNewlyAchievedMemberMilestone
} = require('../utils/milestones');
const {
    logClubMilestone,
    logMemberMilestone,
    activityExists,
    ACTIVITY_TYPES
} = require('../utils/activityLogger');

/**
 * Cached club data
 */
let cachedClubData = null;
let lastSyncTime = null;

/**
 * Perform full sync of club data
 * @param {Object} db - Database instance
 * @returns {Object} Updated club data
 */
async function performFullSync(db) {
    try {
        console.log('[Sync] Starting full sync...');

        // 1. Fetch all members
        const members = await fetchAllMembers(db);
        console.log(`[Sync] Fetched ${members.length} members`);

        // 2. Validate members
        const validMembers = members.filter(validateMemberData);
        if (validMembers.length < members.length) {
            console.warn(`[Sync] ${members.length - validMembers.length} invalid members skipped`);
        }

        // 3. Aggregate club stats
        const clubStats = aggregateClubStats(validMembers);
        console.log(`[Sync] Aggregated stats: ${clubStats.totalProblemsSolved} problems`);

        // 4. Get previous milestones
        const previousMilestones = cachedClubData?.milestones || [];

        // 5. Calculate new milestones
        const newMilestones = calculateClubMilestones(
            clubStats.totalProblemsSolved,
            previousMilestones
        );

        // 6. Check for newly achieved milestones
        const newlyAchieved = getNewlyAchievedMilestones(previousMilestones, newMilestones);

        // 7. Log new milestone achievements
        newlyAchieved.forEach(milestone => {
            if (!activityExists(ACTIVITY_TYPES.CLUB_MILESTONE, {
                'milestone.threshold': milestone.threshold
            })) {
                logClubMilestone(milestone);
                console.log(`[Sync] New milestone achieved: ${milestone.threshold}`);
            }
        });

        // 8. Build club data object
        const clubData = {
            ...clubStats,
            milestones: newMilestones,
            contestStreak: 30, // TODO: Calculate from real data
            lastSyncTime: new Date().toISOString()
        };

        // 9. Cache the data
        cachedClubData = clubData;
        lastSyncTime = Date.now();

        // 10. Save to database
        await saveClubData(db, clubData);

        console.log('[Sync] Full sync completed successfully');
        return clubData;

    } catch (error) {
        console.error('[Sync] Full sync failed:', error);

        // Return cached data if available
        if (cachedClubData) {
            console.warn('[Sync] Returning cached data due to sync failure');
            return cachedClubData;
        }

        throw error;
    }
}

/**
 * Update member data and trigger sync
 * @param {Object} db - Database instance
 * @param {string} memberId - Member ID
 * @param {Object} updates - Member data updates
 * @returns {Object} Updated member data
 */
async function updateMemberData(db, memberId, updates) {
    try {
        // 1. Get current member data
        const currentMember = await getMember(db, memberId);
        if (!currentMember) {
            throw new Error(`Member ${memberId} not found`);
        }

        // 2. Check for milestone changes
        const oldProblems = currentMember.problemsSolved || 0;
        const newProblems = updates.problemsSolved !== undefined
            ? updates.problemsSolved
            : oldProblems;

        // 3. Update member in database
        const updatedMember = {
            ...currentMember,
            ...updates,
            lastUpdated: new Date().toISOString()
        };

        await saveMember(db, memberId, updatedMember);

        // 4. Check for new individual milestone
        if (newProblems !== oldProblems) {
            const newMilestone = getNewlyAchievedMemberMilestone(oldProblems, newProblems);
            if (newMilestone) {
                logMemberMilestone(newMilestone.level);
                console.log(`[Sync] Member ${memberId} reached ${newMilestone.level}`);
            }
        }

        // 5. Trigger club sync
        await performFullSync(db);

        return updatedMember;

    } catch (error) {
        console.error(`[Sync] Failed to update member ${memberId}:`, error);
        throw error;
    }
}

/**
 * Get club data (from cache or database)
 * @param {Object} db - Database instance
 * @param {boolean} forceRefresh - Force refresh from database
 * @returns {Object} Club data
 */
async function getClubData(db, forceRefresh = false) {
    // Return cached data if recent (< 5 minutes)
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    if (!forceRefresh && cachedClubData && lastSyncTime && (Date.now() - lastSyncTime < CACHE_TTL)) {
        console.log('[Sync] Returning cached club data');
        return cachedClubData;
    }

    // Perform sync if cache is stale or missing
    return await performFullSync(db);
}

/**
 * Get member data with calculated milestone
 * @param {Object} db - Database instance
 * @param {string} memberId - Member ID
 * @returns {Object} Member data with milestone
 */
async function getMemberDataWithMilestone(db, memberId) {
    const member = await getMember(db, memberId);
    if (!member) {
        throw new Error(`Member ${memberId} not found`);
    }

    const milestone = calculateMemberMilestone(member.problemsSolved || 0);

    return {
        ...member,
        milestone
    };
}

// ========== Database Helper Functions ==========

/**
 * Fetch all members from database
 * @param {Object} db - Database instance
 * @returns {Array} Array of members
 */
async function fetchAllMembers(db) {
    if (!db) {
        console.warn('[Sync] No database instance, using sample data');
        return getSampleMembers();
    }

    try {
        const snapshot = await db.ref('members').once('value');
        const membersObj = snapshot.val() || {};
        return Object.keys(membersObj).map(id => ({
            id,
            ...membersObj[id]
        }));
    } catch (error) {
        console.error('[Sync] Failed to fetch members:', error);
        return getSampleMembers();
    }
}

/**
 * Get single member from database
 * @param {Object} db - Database instance
 * @param {string} memberId - Member ID
 * @returns {Object|null} Member data or null
 */
async function getMember(db, memberId) {
    if (!db) {
        return getSampleMembers().find(m => m.id === memberId) || null;
    }

    try {
        const snapshot = await db.ref(`members/${memberId}`).once('value');
        const data = snapshot.val();
        return data ? { id: memberId, ...data } : null;
    } catch (error) {
        console.error(`[Sync] Failed to fetch member ${memberId}:`, error);
        return null;
    }
}

/**
 * Save member to database
 * @param {Object} db - Database instance
 * @param {string} memberId - Member ID
 * @param {Object} memberData - Member data
 */
async function saveMember(db, memberId, memberData) {
    if (!db) {
        console.warn('[Sync] No database instance, skipping save');
        return;
    }

    try {
        await db.ref(`members/${memberId}`).set(memberData);
    } catch (error) {
        console.error(`[Sync] Failed to save member ${memberId}:`, error);
        throw error;
    }
}

/**
 * Save club data to database
 * @param {Object} db - Database instance
 * @param {Object} clubData - Club data
 */
async function saveClubData(db, clubData) {
    if (!db) {
        console.warn('[Sync] No database instance, skipping save');
        return;
    }

    try {
        await db.ref('clubData').set(clubData);
    } catch (error) {
        console.error('[Sync] Failed to save club data:', error);
        throw error;
    }
}

/**
 * Get sample members for testing
 * @returns {Array} Sample members
 */
function getSampleMembers() {
    return [
        {
            id: '1',
            name: 'Aryan Chauhan',
            email: 'aryan@tsap.club',
            role: 'admin',
            joinDate: '2025-09-01',
            handles: { codeforces: 'sharkie1604', leetcode: 'aryan_cf', codechef: 'aryan_cc' },
            problemsSolved: 450,
            ratings: { codeforces: 1450, leetcode: 234, codechef: 1500 }
        },
        {
            id: '2',
            name: 'Ravi Sharma',
            email: 'ravi@tsap.club',
            role: 'admin',
            joinDate: '2025-09-01',
            handles: { codeforces: 'ravisharma-09', leetcode: 'ravi_lc', codechef: 'ravi_cc' },
            problemsSolved: 380,
            ratings: { codeforces: 1380, leetcode: 189, codechef: 1420 }
        },
        {
            id: '3',
            name: 'Ankur Bhadauria',
            email: 'ankur@tsap.club',
            role: 'admin',
            joinDate: '2025-09-01',
            handles: { codeforces: 'LOKI_29', leetcode: 'ankur_lc', codechef: 'ankur_cc' },
            problemsSolved: 520,
            ratings: { codeforces: 1520, leetcode: 267, codechef: 1580 }
        },
        {
            id: '4',
            name: 'Jothin Kumar',
            email: 'jothin@tsap.club',
            role: 'member',
            joinDate: '2025-10-01',
            handles: { codeforces: 'jothin_cf', leetcode: 'jothin_lc', codechef: 'jothin_cc' },
            problemsSolved: 290,
            ratings: { codeforces: 1290, leetcode: 156, codechef: 1350 }
        },
        {
            id: '5',
            name: 'Sarah Miller',
            email: 'sarah@tsap.club',
            role: 'member',
            joinDate: '2025-10-15',
            handles: { codeforces: 'sarah_cf', leetcode: 'sarah_lc', codechef: 'sarah_cc' },
            problemsSolved: 198,
            ratings: { codeforces: 1150, leetcode: 198, codechef: 1200 }
        },
        {
            id: '6',
            name: 'David Kim',
            email: 'david@tsap.club',
            role: 'member',
            joinDate: '2025-11-01',
            handles: { codeforces: 'david_cf', leetcode: 'david_lc', codechef: 'david_cc' },
            problemsSolved: 223,
            ratings: { codeforces: 1340, leetcode: 223, codechef: 1380 }
        }
    ];
}

module.exports = {
    performFullSync,
    updateMemberData,
    getClubData,
    getMemberDataWithMilestone,
    getSampleMembers
};
