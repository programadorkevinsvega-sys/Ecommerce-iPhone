import { execFileSync } from "node:child_process";

function currentBranch() {
  const githubRef = process.env.GITHUB_REF?.trim();
  if (githubRef) {
    const match = githubRef.match(/^refs\/heads\/(.+)$/);
    return match?.[1] ?? "";
  }

  try {
    return execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const branch = currentBranch();

if (branch !== "main") {
  console.error(
    `Production deployment blocked: expected branch "main", received "${branch || "detached HEAD"}".`,
  );
  process.exit(1);
}

console.log("Production branch guard passed.");
