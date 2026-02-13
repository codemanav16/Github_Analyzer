document.addEventListener("DOMContentLoaded", async () => {
  const DAYS_FOR_COMMITS = 14;

  const $ = (id) => document.getElementById(id);

  const input = $("usernameInput");
  const analyzeBtn = $("analyzeBtn");
  const deepAnalyzeBtn = $("deepAnalyzeBtn");
  const statusText = $("statusText");
  const content = $("content");

  const profileLink = $("profileLink");
  const avatar = $("avatar");
  const nameEl = $("name");
  const bioEl = $("bio");
  const repoCountEl = $("repoCount");
  const followersEl = $("followers");
  const repoList = $("repoList");

  const commitCanvas = $("commitChart");
  const languageCanvas = $("languageChart");

  const reportCard = $("portfolioReport");
  const scoreEl = $("portfolioScore");
  const strengthsEl = $("strengthsList");
  const weaknessesEl = $("weaknessesList");
  const improvementsEl = $("improvementsList");
  const techSummaryEl = $("techSummary");

  await loadChartJS();

  let commitChart = null;
  let languageChart = null;
  let lastRepos = [];

  analyzeBtn.onclick = analyzeProfile;
  deepAnalyzeBtn.onclick = analyzePortfolio;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") analyzeProfile();
  });

  $("themeToggle")?.addEventListener("click", () => {
    document.body.dataset.theme =
      document.body.dataset.theme === "dark" ? "light" : "dark";
  });

  /* ================= HELPERS FOR ANALYSIS TEXT ================= */

  const pct = (part, whole) => {
    if (!whole) return "0%";
    return `${((part / whole) * 100).toFixed(0)}%`;
  };

  const topEntries = (obj, n = 5) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

  /* ================= PROFILE ANALYSIS ================= */

  async function analyzeProfile() {
    const username = input.value.trim();
    if (!username) return;

    statusText.textContent = "Analyzing profile…";
    content.classList.add("hidden");
    reportCard.classList.add("hidden");

    try {
      const [user, repos, commitData] = await Promise.all([
        fetchJSON(`https://api.github.com/users/${username}`),
        fetchJSON(
          `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`
        ),
        fetchCommitActivity(username),
      ]);

      lastRepos = repos;

      renderProfile(user);
      renderRepos(repos);
      renderLanguageChart(repos);
      renderCommitChart(commitData);

      content.classList.remove("hidden");
      statusText.textContent = "";
    } catch (err) {
      console.error(err);
      statusText.textContent = "Failed to load GitHub profile.";
    }
  }

  /* ================= PORTFOLIO ANALYSIS ================= */

  function analyzePortfolio() {
    if (!lastRepos.length) return;
    const report = generatePortfolioReport(lastRepos);
    renderReport("Portfolio Analysis Report", report);
  }


  async function fetchReadmeSignals(owner, repoName) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/readme`,
      {
        headers: {
          Accept: "application/vnd.github.v3.raw",
        },
      }
    );

    if (!res.ok) {
      return { hasImages: false, hasLinks: false };
    }

    const text = await res.text();

    const hasImages =
      /!\[.*?\]\(.*?\.(png|jpg|jpeg|gif|webp)\)/i.test(text);

    const hasLinks =
      /(https?:\/\/|vercel\.app|netlify\.app|github\.io)/i.test(text);

    return { hasImages, hasLinks };
  } catch {
    return { hasImages: false, hasLinks: false };
  }
}


  /* ================= REPO ANALYSIS ================= */

async function analyzeRepo(repo) {
  const readmeSignals = await fetchReadmeSignals(
    repo.owner.login,
    repo.name
  );

  const report = generateRepoReport(repo, readmeSignals);
  renderReport(`Repository Analysis: ${repo.name}`, report);
}


  /* ================= RENDER ================= */

  function renderProfile(user) {
    profileLink.href = user.html_url;
    avatar.src = user.avatar_url;
    nameEl.textContent = user.login;
    bioEl.textContent = user.bio || "No bio provided";
    repoCountEl.textContent = user.public_repos;
    followersEl.textContent = user.followers;
  }

  function renderRepos(repos) {
    repoList.innerHTML = "";

    repos.slice(0, 6).forEach((repo) => {
      const div = document.createElement("div");
      div.className = "repo-item";

      div.innerHTML = `
        <div>
          <h4>${repo.name}</h4>
          <p>${repo.description || "No description"}</p>
        </div>
        <div class="repo-meta">
          <span>★ ${repo.stargazers_count}</span>
          <span>${repo.language || "N/A"}</span>
          <button class="btn-secondary analyze-repo-btn">Analyze Repo</button>
        </div>
      `;

      div.querySelector(".analyze-repo-btn").onclick = () => analyzeRepo(repo);

      repoList.appendChild(div);
    });
  }

  /* ================= CHARTS ================= */

  function renderCommitChart(data) {
    if (commitChart) commitChart.destroy();

    const ctx = commitCanvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(96,165,250,0.45)");
    gradient.addColorStop(1, "rgba(96,165,250,0.05)");

    commitChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map((_, i) =>
          i === data.length - 1 ? "Today" : `${data.length - i - 1}d ago`
        ),
        datasets: [
          {
            data,
            fill: true,
            backgroundColor: gradient,
            borderColor: "#60a5fa",
            borderWidth: 3,
            tension: 0.45,
            pointRadius: 0,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: "rgba(148,163,184,0.15)", drawBorder: false },
            beginAtZero: true,
          },
        },
      },
    });
  }

  function renderLanguageChart(repos) {
    const languageCounts = {};
    const totalRepos = repos.length;

    repos.forEach((repo) => {
      if (repo.language) {
        languageCounts[repo.language] =
          (languageCounts[repo.language] || 0) + 1;
      }
    });

    const labels = Object.keys(languageCounts);
    const values = Object.values(languageCounts);

    if (languageChart) languageChart.destroy();

    const ctx = languageCanvas.getContext("2d");

    languageChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderWidth: 0,
            hoverOffset: 10,
            backgroundColor: [
              "#60a5fa",
              "#34d399",
              "#fbbf24",
              "#f472b6",
              "#a78bfa",
              "#fb7185",
              "#38bdf8",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, padding: 16 },
          },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.95)",
            padding: 12,
            callbacks: {
              label: function (context) {
                const count = context.raw;
                const percentage = ((count / totalRepos) * 100).toFixed(1);
                return `${context.label}: ${count} project(s) • ${percentage}%`;
              },
            },
          },
        },
      },
    });
  }

  /* ================= REPORTS ================= */

  function renderReport(title, report) {
    reportCard.querySelector("h3").textContent = title;
    scoreEl.textContent = report.score;

    strengthsEl.innerHTML = report.strengths.map((s) => `<li>${s}</li>`).join("");
    weaknessesEl.innerHTML = report.weaknesses.map((w) => `<li>${w}</li>`).join("");
    improvementsEl.innerHTML = report.improvements.map((i) => `<li>${i}</li>`).join("");

    techSummaryEl.textContent = report.techSummary;

    reportCard.classList.remove("hidden");
    reportCard.scrollIntoView({ behavior: "smooth" });
  }

  /* ================= DEEPER PORTFOLIO ANALYSIS (UPGRADED) ================= */

  function generatePortfolioReport(repos) {
    const total = repos.length || 1;

    // Metrics
    let documented = 0;      // has description
    let homepageLinks = 0;   // has homepage/live link
    let hasPages = 0;        // GitHub Pages enabled
    let hasLicense = 0;
    let hasTopics = 0;
    let forks = 0;
    let originals = 0;
    let active30 = 0;
    let active90 = 0;

    let starsTotal = 0;
    let forksTotal = 0;
    let issuesTotal = 0;

    const languages = {};
    const updatedDays = [];
    const sizes = [];

    repos.forEach((r) => {
      if (r.language) languages[r.language] = (languages[r.language] || 0) + 1;

      if (r.description) documented++;
      if (r.homepage) homepageLinks++;
      if (r.has_pages) hasPages++;
      if (r.license) hasLicense++;
      if (Array.isArray(r.topics) && r.topics.length) hasTopics++;

      if (r.fork) forks++;
      else originals++;

      const d = daysSince(r.updated_at);
      updatedDays.push(d);
      if (d <= 30) active30++;
      if (d <= 90) active90++;

      starsTotal += r.stargazers_count || 0;
      forksTotal += r.forks_count || 0;
      issuesTotal += r.open_issues_count || 0;

      sizes.push(r.size || 0);
    });

    // Stats
    updatedDays.sort((a, b) => a - b);
    const medianUpdated =
      updatedDays.length ? updatedDays[Math.floor(updatedDays.length / 2)] : 999;

    sizes.sort((a, b) => a - b);
    const medianSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;

    const langCount = Object.keys(languages).length;
    const topLangs = topEntries(languages, 5);

    // Score (0–10) more realistic
    let score = 0;

    // Portfolio breadth
    if (repos.length >= 12) score += 2;
    else if (repos.length >= 8) score += 1.5;
    else if (repos.length >= 5) score += 1;

    // Activity
    if (active30 >= 2) score += 2;
    else if (active90 >= 3) score += 1.5;
    else if (active90 >= 1) score += 1;

    // Documentation + presentation
    const docRatio = documented / total;
    if (docRatio >= 0.7) score += 2;
    else if (docRatio >= 0.5) score += 1.5;
    else if (docRatio >= 0.3) score += 1;

    // Tech range
    if (langCount >= 5) score += 2;
    else if (langCount >= 3) score += 1.5;
    else if (langCount >= 2) score += 1;

    // Ownership
    const originalRatio = originals / total;
    if (originalRatio >= 0.75) score += 2;
    else if (originalRatio >= 0.55) score += 1.5;
    else if (originalRatio >= 0.35) score += 1;

    // Small boosts for polish signals
    if (homepageLinks > 0) score += 0.5;
    if (hasPages > 0) score += 0.5;
    if (hasLicense > 0) score += 0.25;

    score = Math.max(0, Math.min(10, Math.round(score * 10) / 10)); // 1 decimal

    // Strengths/Weaknesses/Improvements (detailed)
    const strengths = [];
    const weaknesses = [];
    const improvements = [];

    strengths.push(
      `Repository volume: ${repos.length} public repo(s), which is a solid base for a portfolio.`
    );

    strengths.push(
      `Ownership: ${originals}/${repos.length} are original (${pct(originals, repos.length)}).`
    );

    strengths.push(
      `Activity: ${active30} updated in last 30 days; ${active90} updated in last 90 days. Median last update: ~${Math.round(medianUpdated)} day(s) ago.`
    );

    strengths.push(
      `Tech coverage: ${langCount} language(s). Top: ${topLangs
        .map(([l, c]) => `${l} (${c})`)
        .join(", ")}.`
    );

    // Weaknesses with real numbers
    if (docRatio < 0.6) {
      weaknesses.push(
        `Documentation signal is weak: only ${documented}/${repos.length} repos have descriptions (${pct(documented, repos.length)}).`
      );
    } else {
      weaknesses.push(
        `Documentation is decent, but READMEs and usage guides still matter for recruiter review (descriptions alone are not enough).`
      );
    }

    if (homepageLinks === 0 && hasPages === 0) {
      weaknesses.push(
        "Presentation is limited: no homepage links or GitHub Pages detected. Recruiters love demos."
      );
    } else {
      weaknesses.push(
        `Some presentation exists: ${homepageLinks} repo(s) have a homepage link, ${hasPages} repo(s) have GitHub Pages enabled.`
      );
    }

    if (starsTotal === 0 && forksTotal === 0) {
      weaknesses.push(
        "Low external signal: stars/forks are near zero. That’s normal early on, but showcasing best projects helps."
      );
    } else {
      weaknesses.push(
        `External signal: ${starsTotal} total star(s), ${forksTotal} total fork(s).`
      );
    }

    // Improvements that read like a roadmap
    improvements.push(
      "Create 1 flagship project: include a crisp README (problem → solution → tech), screenshots, and a live demo link."
    );

    improvements.push(
      "Standardize repos: add descriptions everywhere, consistent naming, and a short feature list + setup steps."
    );

    improvements.push(
      "Add portfolio polish signals: license on major repos, topics/tags, and a simple roadmap (issues or milestones)."
    );

    improvements.push(
      "Pin 4–6 best repos on GitHub and align them with the role you want (frontend, backend, full-stack)."
    );

    improvements.push(
      "Increase credibility: meaningful commit history, small iterative improvements, and short demo videos for top projects."
    );

    // Tech summary (more informative than before)
    const techSummary =
      `Languages: ${topEntries(languages, 10)
        .map(([l, c]) => `${l} (${c}, ${pct(c, repos.length)})`)
        .join(" | ")}. ` +
      `Docs: ${documented}/${repos.length}. ` +
      `Demos: homepage links ${homepageLinks}, GitHub Pages ${hasPages}. ` +
      `License: ${hasLicense} repo(s). ` +
      `Median repo size: ~${medianSize} KB.`;

    return {
      score,
      strengths,
      weaknesses,
      improvements,
      techSummary,
    };
  }

function generateRepoReport(repo, readmeSignals = {}) {
  let score = 0;

  const strengths = [];
  const weaknesses = [];
  const improvements = [];

  /* ================= METRICS ================= */

  const daysInactive = daysSince(repo.updated_at);
  const hasDescription = !!repo.description;
  const hasHomepage = !!repo.homepage;
  const hasLicense = !!repo.license;
  const hasTopics = Array.isArray(repo.topics) && repo.topics.length > 0;
  const isFork = repo.fork;

  const stars = repo.stargazers_count || 0;
  const forks = repo.forks_count || 0;
  const issues = repo.open_issues_count || 0;
  const sizeKB = repo.size || 0;

  /* ================= SCORING (0–10) ================= */

  // Ownership
  if (!isFork) score += 2;
  else score -= 1;

  // Activity
  if (daysInactive <= 30) score += 2;
  else if (daysInactive <= 90) score += 1.5;
  else if (daysInactive <= 180) score += 1;

  // Documentation & presentation
  if (hasDescription) score += 1.5;
  if (hasHomepage) score += 1;
  if (hasLicense) score += 0.5;
  if (hasTopics) score += 0.5;

  // Community signal
  if (stars > 0) score += 1;
  if (forks > 0) score += 0.5;

  // Size signal
  if (sizeKB >= 300) score += 1;
  else if (sizeKB >= 120) score += 0.5;

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  /* ================= MATURITY LEVEL ================= */

  let maturity = "Beginner";
  if (score >= 7.5) maturity = "Advanced";
  else if (score >= 5) maturity = "Intermediate";

  /* ================= STRENGTHS ================= */

  strengths.push(
    `Project maturity: ${maturity} level (score ${score}/10).`
  );

  if (!isFork) {
    strengths.push(
      "Original project, showing independent ownership and problem-solving."
    );
  }

  strengths.push(
    `Last updated ~${Math.round(daysInactive)} day(s) ago.`
  );

  if (hasDescription) {
    strengths.push("Clear project description helps quick understanding.");
  }

  if (hasHomepage) {
    strengths.push("Includes a live demo or homepage link.");
  }

  if (stars > 0 || forks > 0) {
    strengths.push(
      `Community engagement detected: ${stars} star(s), ${forks} fork(s).`
    );
  }

  if (sizeKB >= 300) {
    strengths.push(
      `Repository size (~${sizeKB} KB) suggests a non-trivial implementation.`
    );
  } else if (sizeKB >= 120) {
    strengths.push(
      `Moderate repository size (~${sizeKB} KB) indicating meaningful work.`
    );
  }

  /* ================= WEAKNESSES ================= */

  if (isFork) {
    weaknesses.push(
      "Forked repository — ownership impact depends on how much original work was added."
    );
  }

  if (!hasDescription) {
    weaknesses.push(
      "Missing description makes it harder for reviewers to quickly grasp the project."
    );
  }

const hasDemoOrVisuals =
  hasHomepage || readmeSignals.hasLinks || readmeSignals.hasImages;

if (hasDemoOrVisuals) {
  strengths.push(
    "Project includes visual proof (screenshots or live demo), improving clarity and presentation."
  );
} else {
  weaknesses.push(
    "No demo or screenshots detected. Adding visuals helps reviewers quickly understand the project."
  );
}


  if (!hasLicense) {
    weaknesses.push(
      "No license specified, which reduces professionalism and reuse clarity."
    );
  }

  if (!hasTopics) {
    weaknesses.push(
      "No topics/tags set, reducing discoverability on GitHub."
    );
  }

  if (daysInactive > 180) {
    weaknesses.push(
      "Project has not been updated recently, which may signal abandonment."
    );
  }

  if (sizeKB < 60) {
    weaknesses.push(
      "Very small repository size may indicate experimental or incomplete work."
    );
  }

/* ================= IMPROVEMENTS (CONDITIONAL ROADMAP) ================= */

// README quality is always useful
improvements.push(
  "Ensure the README is well-structured: problem → solution → features → tech stack → setup → screenshots."
);

// Demo only if missing
if (!hasDemoOrVisuals) {
  improvements.push(
    "Add a demo (GitHub Pages, Vercel, Netlify) or screenshots/GIFs to visually showcase the project."
  );
} else {
  improvements.push(
    "Improve presentation by refining screenshots, adding captions, or short demo GIFs/videos."
  );
}

// Topics
if (!hasTopics) {
  improvements.push(
    "Add GitHub topics/tags to improve discoverability and clarify the project’s domain."
  );
}

// License
if (!hasLicense) {
  improvements.push(
    "Add an appropriate open-source license (MIT, Apache 2.0, etc.) to improve professionalism."
  );
}

// Fork-specific
if (isFork) {
  improvements.push(
    "Clearly document your contributions and extend the project with original features."
  );
}

// Always good advice
improvements.push(
  "Continue making small, meaningful updates to show maintenance and long-term ownership."
);

  /* ================= TECH SUMMARY ================= */

  const techSummary =
    `Primary language: ${repo.language || "Not specified"} • ` +
    `Size: ~${sizeKB} KB • ` +
    `Stars: ${stars}, Forks: ${forks}, Issues: ${issues} • ` +
    `Last update: ~${Math.round(daysInactive)} day(s) ago`;

  return {
    score,
    strengths,
    weaknesses,
    improvements,
    techSummary,
  };
}


  /* ================= HELPERS ================= */

  async function fetchCommitActivity(username) {
    const res = await fetch(
      `https://api.github.com/users/${username}/events/public?per_page=100`
    );
    if (!res.ok) return Array(DAYS_FOR_COMMITS).fill(0);

    const events = await res.json();
    const buckets = Array(DAYS_FOR_COMMITS).fill(0);
    const today = new Date();

    events.forEach((e) => {
      if (e.type === "PushEvent") {
        const diff = Math.floor(
          (today - new Date(e.created_at)) / (1000 * 60 * 60 * 24)
        );
        if (diff >= 0 && diff < DAYS_FOR_COMMITS)
          buckets[DAYS_FOR_COMMITS - diff - 1]++;
      }
    });

    return buckets;
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    return res.json();
  }

  function daysSince(date) {
    return (Date.now() - new Date(date)) / (1000 * 60 * 60 * 24);
  }

  function loadChartJS() {
    return new Promise((resolve) => {
      if (window.Chart) return resolve();
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }
});
