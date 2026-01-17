/**
 * Milestone Utilities
 * Handles club and individual milestone calculations
 */

// Club Milestone Definitions
const CLUB_MILESTONES = [
  { threshold: 800, reward: "Chocolate Treat", icon: "🍫" },
  { threshold: 1200, reward: "Cake Cutting", icon: "🎂" },
  { threshold: 2000, reward: "Burger Treat", icon: "🍔" },
  { threshold: 4000, reward: "T-Shirts Distribution", icon: "👕" },
  { threshold: 7000, reward: "Swag Bag", icon: "🎒" },
  { threshold: 10000, reward: "Trophy + Grand Party", icon: "🏆" }
];

// Individual Milestone Definitions (7 Tiers)
const INDIVIDUAL_MILESTONES = [
  { level: "Beginner", min: 0, max: 49, reward: "Keep Going!", badge: "🌱", color: "#6b7280" },
  { level: "Bronze Solver", min: 50, max: 149, reward: "Certificate", badge: "🥉", color: "#cd7f32" },
  { level: "Silver Solver", min: 150, max: 299, reward: "Club Recognition", badge: "🥈", color: "#c0c0c0" },
  { level: "Gold Solver", min: 300, max: 599, reward: "Special Badge", badge: "🥇", color: "#ffd700" },
  { level: "Platinum Solver", min: 600, max: 999, reward: "Elite Status", badge: "💎", color: "#00d4ff" },
  { level: "Diamond Solver", min: 1000, max: 1499, reward: "Diamond Badge", badge: "💠", color: "#00bfff" },
  { level: "Master Solver ⭐", min: 1500, max: Infinity, reward: "Gold Star + Featured", badge: "⭐", color: "#9b59b6" }
];

/**
 * Calculate club milestone states based on total problems solved
 * @param {number} totalProblemsSolved - Total problems solved by all members
 * @param {Array} existingMilestones - Current milestone states from DB
 * @returns {Array} Updated milestone states with achievement dates
 */
function calculateClubMilestones(totalProblemsSolved, existingMilestones = []) {
  return CLUB_MILESTONES.map(milestone => {
    const existing = existingMilestones.find(m => m.threshold === milestone.threshold);
    const achieved = totalProblemsSolved >= milestone.threshold;

    return {
      threshold: milestone.threshold,
      reward: milestone.reward,
      icon: milestone.icon,
      achieved,
      date: achieved ? (existing?.date || new Date().toISOString()) : null,
      progress: Math.min(100, (totalProblemsSolved / milestone.threshold) * 100)
    };
  });
}

/**
 * Get current milestone for club (highest achieved)
 * @param {Array} milestones - Club milestone states
 * @returns {Object|null} Current milestone or null
 */
function getCurrentClubMilestone(milestones) {
  const achieved = milestones.filter(m => m.achieved);
  return achieved.length > 0 ? achieved[achieved.length - 1] : null;
}

/**
 * Get next milestone for club
 * @param {Array} milestones - Club milestone states
 * @returns {Object|null} Next milestone or null if all achieved
 */
function getNextClubMilestone(milestones) {
  return milestones.find(m => !m.achieved) || null;
}

/**
 * Calculate individual member milestone
 * @param {number} problemsSolved - Member's total problems solved
 * @returns {Object} Member milestone data
 */
function calculateMemberMilestone(problemsSolved) {
  const milestone = INDIVIDUAL_MILESTONES.find(
    m => problemsSolved >= m.min && problemsSolved <= m.max
  );

  if (!milestone) {
    return null;
  }

  const nextMilestone = INDIVIDUAL_MILESTONES.find(m => m.min > problemsSolved);
  const progress = nextMilestone
    ? ((problemsSolved - milestone.min) / (nextMilestone.min - milestone.min)) * 100
    : 100;

  return {
    level: milestone.level,
    badge: milestone.badge,
    reward: milestone.reward,
    problemsSolved,
    problemsRequired: nextMilestone?.min || milestone.max,
    progress: Math.min(100, Math.max(0, progress)),
    nextReward: nextMilestone?.reward || "Max Level Reached"
  };
}

/**
 * Check if a new milestone was just achieved
 * @param {Object} oldMilestones - Previous milestone states
 * @param {Object} newMilestones - New milestone states
 * @returns {Array} Newly achieved milestones
 */
function getNewlyAchievedMilestones(oldMilestones, newMilestones) {
  const newlyAchieved = [];

  newMilestones.forEach(newM => {
    const oldM = oldMilestones.find(m => m.threshold === newM.threshold);
    if (newM.achieved && (!oldM || !oldM.achieved)) {
      newlyAchieved.push(newM);
    }
  });

  return newlyAchieved;
}

/**
 * Check if member reached a new individual milestone
 * @param {number} oldProblems - Previous problem count
 * @param {number} newProblems - New problem count
 * @returns {Object|null} New milestone if achieved, null otherwise
 */
function getNewlyAchievedMemberMilestone(oldProblems, newProblems) {
  const oldMilestone = calculateMemberMilestone(oldProblems);
  const newMilestone = calculateMemberMilestone(newProblems);

  if (!oldMilestone || !newMilestone) return null;

  if (oldMilestone.level !== newMilestone.level) {
    return newMilestone;
  }

  return null;
}

module.exports = {
  CLUB_MILESTONES,
  INDIVIDUAL_MILESTONES,
  calculateClubMilestones,
  getCurrentClubMilestone,
  getNextClubMilestone,
  calculateMemberMilestone,
  getNewlyAchievedMilestones,
  getNewlyAchievedMemberMilestone
};
