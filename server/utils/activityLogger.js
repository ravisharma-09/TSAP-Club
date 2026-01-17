/**
 * Activity Logger
 * Handles logging and retrieval of club activity events
 */

const ACTIVITY_TYPES = {
    CLUB_MILESTONE: 'club_milestone',
    MEMBER_JOIN: 'member_join',
    MEMBER_MILESTONE: 'member_milestone',
    CONTEST_STREAK: 'contest_streak'
};

const MAX_ACTIVITIES = 50; // Store last 50 activities
const DISPLAY_LIMIT = 10; // Show last 10 by default

/**
 * Activity storage (in-memory for now, will use Firebase)
 */
let activities = [];

/**
 * Log a new activity event
 * @param {string} type - Activity type from ACTIVITY_TYPES
 * @param {Object} data - Activity data
 * @returns {Object} Created activity
 */
function logActivity(type, data) {
    const activity = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        timestamp: new Date().toISOString(),
        ...data
    };

    // Add to beginning of array
    activities.unshift(activity);

    // Keep only last MAX_ACTIVITIES
    if (activities.length > MAX_ACTIVITIES) {
        activities = activities.slice(0, MAX_ACTIVITIES);
    }

    return activity;
}

/**
 * Log club milestone achievement
 * @param {Object} milestone - Milestone object
 */
function logClubMilestone(milestone) {
    return logActivity(ACTIVITY_TYPES.CLUB_MILESTONE, {
        message: `Club reached ${milestone.threshold} rating milestone`,
        icon: 'trophy',
        iconClass: 'milestone-icon',
        milestone: {
            threshold: milestone.threshold,
            reward: milestone.reward,
            icon: milestone.icon
        }
    });
}

/**
 * Log new member joining
 * @param {Object} member - Member object
 */
function logMemberJoin(member) {
    return logActivity(ACTIVITY_TYPES.MEMBER_JOIN, {
        message: `${member.name} joined the club`,
        icon: 'user-plus',
        iconClass: 'growth-icon',
        memberId: member.id,
        memberName: member.name
    });
}

/**
 * Log member milestone achievement (anonymized)
 * @param {string} level - Milestone level achieved
 */
function logMemberMilestone(level) {
    return logActivity(ACTIVITY_TYPES.MEMBER_MILESTONE, {
        message: `A member reached ${level}`,
        icon: 'target',
        iconClass: 'achievement-icon',
        level
    });
}

/**
 * Log contest streak achievement
 * @param {number} days - Streak days
 */
function logContestStreak(days) {
    return logActivity(ACTIVITY_TYPES.CONTEST_STREAK, {
        message: `Daily contest streak: ${days} days`,
        icon: 'flame',
        iconClass: 'streak-icon',
        days
    });
}

/**
 * Get recent activities
 * @param {number} limit - Number of activities to return
 * @returns {Array} Recent activities
 */
function getRecentActivities(limit = DISPLAY_LIMIT) {
    return activities.slice(0, limit).map(activity => ({
        ...activity,
        timeAgo: getTimeAgo(activity.timestamp)
    }));
}

/**
 * Calculate time ago string
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Human-readable time ago
 */
function getTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
    return then.toLocaleDateString();
}

/**
 * Check if activity already exists (prevent duplicates)
 * @param {string} type - Activity type
 * @param {Object} criteria - Matching criteria
 * @returns {boolean} True if exists
 */
function activityExists(type, criteria) {
    return activities.some(activity => {
        if (activity.type !== type) return false;

        // Check criteria match
        return Object.keys(criteria).every(key => activity[key] === criteria[key]);
    });
}

/**
 * Clear all activities (for testing)
 */
function clearActivities() {
    activities = [];
}

/**
 * Initialize with sample activities (for testing)
 */
function initializeSampleActivities() {
    const now = Date.now();

    activities = [
        {
            id: '1',
            type: ACTIVITY_TYPES.CLUB_MILESTONE,
            timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
            message: 'Club reached 1000 rating milestone',
            icon: 'trophy',
            iconClass: 'milestone-icon'
        },
        {
            id: '2',
            type: ACTIVITY_TYPES.MEMBER_JOIN,
            timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
            message: '5 new members joined this week',
            icon: 'trending-up',
            iconClass: 'growth-icon'
        },
        {
            id: '3',
            type: ACTIVITY_TYPES.MEMBER_MILESTONE,
            timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
            message: 'Club solved 500+ problems this month',
            icon: 'target',
            iconClass: 'achievement-icon'
        },
        {
            id: '4',
            type: ACTIVITY_TYPES.CONTEST_STREAK,
            timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
            message: 'Daily contest streak: 30 days',
            icon: 'flame',
            iconClass: 'streak-icon'
        }
    ];
}

module.exports = {
    ACTIVITY_TYPES,
    logActivity,
    logClubMilestone,
    logMemberJoin,
    logMemberMilestone,
    logContestStreak,
    getRecentActivities,
    activityExists,
    clearActivities,
    initializeSampleActivities
};
