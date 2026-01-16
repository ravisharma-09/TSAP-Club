
function qs(id) {
  return document.getElementById(id);
}

// Check if user is logged in
async function checkAuth(redirectIfUnauth = true) {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) {
      if (redirectIfUnauth) {
        window.location.href = "index.html";
      }
      return null;
    }
    const user = await res.json();
    window.currentUser = user;
    return user;
  } catch (e) {
    if (redirectIfUnauth) {
      window.location.href = "index.html";
    }
    return null;
  }
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "index.html";
}

function renderNav(activePage) {
  const user = window.currentUser;
  if (!user) return;

  const navContainer = document.createElement("div");
  navContainer.className = "nav";

  const logo = document.createElement("div");
  logo.className = "nav-logo";
  logo.textContent = "TSAP Club";

  const links = document.createElement("div");
  links.className = "nav-links";

  const pages = [
    { id: "dashboard", label: "Dashboard", href: "dashboard.html" },
    { id: "leaderboard", label: "Leaderboard", href: "leaderboard.html" },
    { id: "analytics", label: "Analytics", href: "analytics.html" },
  ];

  if (user.role === "admin") {
    pages.push({ id: "admin", label: "Admin", href: "admin.html" });
  }

  pages.forEach(p => {
    const a = document.createElement("a");
    a.href = p.href;
    a.textContent = p.label;
    if (activePage === p.id) a.className = "active";
    links.appendChild(a);
  });

  // User profile / logout
  const userSection = document.createElement("div");
  userSection.style.display = "flex";
  userSection.style.alignItems = "center";
  userSection.style.gap = "12px";

  const userName = document.createElement("span");
  userName.className = "small";
  userName.textContent = user.name;

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "btn-link";
  logoutBtn.textContent = "Logout";
  logoutBtn.onclick = logout;

  userSection.appendChild(userName);
  userSection.appendChild(logoutBtn);

  navContainer.appendChild(logo);
  navContainer.appendChild(links);
  navContainer.appendChild(userSection);

  // Prepend to body
  document.body.insertBefore(navContainer, document.body.firstChild);
}
