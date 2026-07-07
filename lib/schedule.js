// Shared roadmap/date logic — used by both the client UI and the server cron job.
export const START = new Date(2026, 6, 7); // 7 Jul 2026
export const END = new Date(2026, 8, 6); // 6 Sep 2026
export const TOTAL_DAYS = 62;

export const WEEKS = [
  {
    theme: "Finish Ch.2 + Ch.3 Devices",
    linux: "HLW Ch.2 (job control → archiving) → Ch.3 /dev, udev, lsblk",
    weekday: ["Two Sum", "Contains Duplicate", "Valid Anagram", "Group Anagrams", "Top K Frequent Elements"],
    sat: "Product of Array Except Self + re-solve Merge Intervals",
    milestone: "Linux Upskill Challenge — days 0–2",
  },
  {
    theme: "Ch.4 Disks & Filesystems",
    linux: "Partitions, mounting, fstab, inodes. Lab: loop device → mkfs → fill → fsck",
    weekday: ["Valid Palindrome", "Two Sum II", "Container With Most Water", "Best Time to Buy and Sell Stock", "Longest Substring Without Repeating"],
    sat: "Longest Repeating Char Replacement + re-solve Top K Frequent",
    milestone: "Upskill Challenge — days 3–7",
  },
  {
    theme: "Ch.5–6 Boot & systemd",
    linux: "Kernel boot → user space. journalctl -b, write a unit file, dmesg",
    weekday: ["Valid Parentheses", "Min Stack", "Daily Temperatures", "Binary Search", "Search a 2D Matrix"],
    sat: "Koko Eating Bananas + re-solve Longest Substring",
    milestone: "Upskill Challenge — days 8–12",
  },
  {
    theme: "Ch.7–8 Processes & Resources ★",
    linux: "strace, lsof, load average, OOM killer, cron. Write your slow-server runbook",
    weekday: ["Reverse Linked List", "Merge Two Sorted Lists", "Linked List Cycle", "Reorder Log Files", "String to Integer (atoi)"],
    sat: "Build a log-line parser from scratch + re-solve Daily Temperatures",
    milestone: "Upskill Challenge — days 13–17",
  },
  {
    theme: "Ch.9–10 Networking · Go Tour · 🚨 app watch",
    linux: "IP, routing, DNS (dig logirate.org), ss, tcpdump, curl -v. Write out URL→page",
    weekday: ["Invert Binary Tree", "Go Tour (30 min)", "Maximum Depth of Binary Tree", "Go Tour (30 min)", "Binary Tree Level Order Traversal"],
    sat: "Validate BST + re-solve atoi",
    milestone: "Start A Tour of Go · check Meta Careers Mondays",
  },
  {
    theme: "Ch.11–12 Shell · Go project · PE CV",
    linux: "Do EVERY Ch.11 script example. Skim Ch.12 ssh/rsync. Real bash: disk+log+summary",
    weekday: ["Insert Interval", "Go project", "Non-overlapping Intervals", "Go project", "Meeting Rooms"],
    sat: "Sort Colors + SadServers 'Saint John'",
    milestone: "Go project starts · PE-tailored CV",
  },
  {
    theme: "Ship Go project · APPLY 🚀",
    linux: "Skim Ch.15 + Ch.17 (skip 13/14/16). Finish + push Go project",
    weekday: ["Kth Largest in a Stream", "Go project — ship it", "Last Stone Weight", "K Closest Points to Origin", "APPLY if posting is live"],
    sat: "Task Scheduler + re-solve Insert Interval",
    milestone: "README + pin repo · 2 SadServers (easy)",
  },
  {
    theme: "Interview recon + timed practice",
    linux: "Systems drills OUT LOUD: boot, URL→page, slow server, disk-vs-df, zombies, strace",
    weekday: ["Timed: 2 problems / 45 min", "Glassdoor + Blind recon", "Timed: 2 problems / 45 min", "Glassdoor + Blind recon", "Timed: 2 problems / 45 min"],
    sat: "2 SadServers (try a medium)",
    milestone: "Question bank built from real interview reports",
  },
  {
    theme: "Mocks + taper 🏁",
    linux: "2 mocks (coding + systems). Thu–Sun: TAPER. Sleep beats cramming",
    weekday: ["Re-solve weakest #1", "Mock interview", "Re-solve weakest #2", "Light review only", "Rest"],
    sat: "1 final SadServers, then close the laptop",
    milestone: "Trust the work. You did it.",
  },
];

const dayMs = 86400000;
export const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dayIndex = (d) => Math.round((atMidnight(d) - START) / dayMs);
export const dateAt = (idx) => new Date(START.getTime() + idx * dayMs);
export const weekIndex = (d) => Math.min(8, Math.max(0, Math.floor(dayIndex(d) / 7)));
export const fmt = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function tasksFor(d) {
  const wk = WEEKS[weekIndex(d)];
  const dow = d.getDay(); // 0 Sun … 6 Sat
  if (dow === 0) {
    return { kind: "rest", week: wk, tasks: [{ id: "rest", label: "I actually rested — saw people, touched grass 😌" }] };
  }
  if (dow === 6) {
    return {
      kind: "deep",
      week: wk,
      tasks: [
        { id: "lab", label: "Lab from memory — this week's hands-on, book closed" },
        { id: "lc", label: `LeetCode ×2 — ${wk.sat}` },
        { id: "milestone", label: `Milestone — ${wk.milestone}` },
      ],
    };
  }
  const wkStart = dateAt(weekIndex(d) * 7);
  let pos = 0;
  for (let i = 0; i < 7; i++) {
    const dd = new Date(wkStart.getTime() + i * dayMs);
    if (dd > d) break;
    const g = dd.getDay();
    if (g !== 0 && g !== 6 && keyOf(dd) !== keyOf(d)) pos++;
  }
  const problem = wk.weekday[Math.min(pos, wk.weekday.length - 1)];
  return {
    kind: "weekday",
    week: wk,
    tasks: [
      { id: "linux", label: `Linux — ${wk.linux}`, star: true },
      { id: "lc", label: `LeetCode — ${problem}` },
    ],
  };
}
