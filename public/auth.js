/**
 * Authentication Utilities
 * Client-side session management and auth helpers
 */

/**
 * Check if user is currently authenticated
 * @returns {Promise<boolean>}
 */
async function checkAuth() {
    try {
        const response = await fetch('/api/me', {
            credentials: 'include'
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Get current user data
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
async function getCurrentUser() {
    try {
        const response = await fetch('/api/me', {
            credentials: 'include'
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[Auth] Failed to get current user:', error);
        return null;
    }
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        // Redirect to home page
        window.location.href = 'index.html';
    } catch (error) {
        console.error('[Auth] Logout failed:', error);
        // Redirect anyway
        window.location.href = 'index.html';
    }
}

/**
 * Require authentication - redirect to login if not authenticated
 * Call this on protected pages
 */
async function requireAuth() {
    const isAuthenticated = await checkAuth();

    if (!isAuthenticated) {
        // Save current page to redirect back after login
        const returnUrl = window.location.pathname + window.location.search;
        window.location.href = `login.html?return=${encodeURIComponent(returnUrl)}`;
    }
}

/**
 * Redirect to profile if already authenticated
 * Call this on login/register pages
 */
async function redirectIfAuthenticated() {
    const isAuthenticated = await checkAuth();

    if (isAuthenticated) {
        // Check for return URL
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('return') || 'profile.html';
        window.location.href = returnUrl;
    }
}

/**
 * Update navbar to show user state
 * Call this on page load for all pages
 */
async function updateNavbarAuth() {
    const user = await getCurrentUser();
    const navLinks = document.querySelector('.nav-links.desktop-only');
    const mobileMenu = document.querySelector('.mobile-menu');

    if (!navLinks) return;

    // Find login link
    const loginLink = navLinks.querySelector('a[href="login.html"]');
    const mobileLoginLink = mobileMenu?.querySelector('a[href="login.html"]');

    if (user) {
        // User is logged in - show Profile link and Logout button
        const profileAndLogoutHTML = `
            <a href="profile.html" class="nav-item">Profile</a>
            <button onclick="logout()" class="nav-item logout-btn" style="background: none; border: none; color: var(--text-secondary); font-size: 0.9rem; font-weight: 500; cursor: pointer; padding: 0.5rem 0;">Logout</button>
        `;

        // Replace login link with profile + logout
        if (loginLink) {
            loginLink.outerHTML = profileAndLogoutHTML;
        }

        // Mobile menu - show profile and logout
        if (mobileLoginLink) {
            mobileLoginLink.outerHTML = `
                <a href="profile.html" class="nav-item">Profile</a>
                <button onclick="logout()" class="nav-item logout-btn" style="background: none; border: none; color: var(--text-secondary); font-size: 1.1rem; font-weight: 600; cursor: pointer; padding: 0.75rem; border-radius: 8px; width: 100%; text-align: center;">Logout</button>
            `;
        }

        // Re-initialize Lucide icons if needed
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } else {
        // User is not logged in - ensure login link exists
        if (!loginLink && navLinks) {
            // Add login link if it doesn't exist
            const loginLinkHTML = '<a href="login.html" class="nav-item">Login</a>';
            navLinks.insertAdjacentHTML('beforeend', loginLinkHTML);
        }

        // Ensure mobile menu has login link
        if (!mobileLoginLink && mobileMenu) {
            const loginLinkHTML = '<a href="login.html" class="nav-item">Login</a>';
            mobileMenu.insertAdjacentHTML('beforeend', loginLinkHTML);
        }
    }
}

// Auto-initialize navbar auth on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNavbarAuth);
} else {
    updateNavbarAuth();
}
