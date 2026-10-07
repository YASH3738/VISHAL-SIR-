const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function loadFirebaseTools() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const globalModulesPath = execFileSync(npm, ["root", "--global"], {
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32",
  }).trim();
  const firebaseToolsPath = path.join(
    globalModulesPath,
    "firebase-tools",
    "lib"
  );

  return {
    auth: require(path.join(firebaseToolsPath, "auth.js")),
    apiAuth: require(path.join(firebaseToolsPath, "gcp", "auth.js")),
  };
}

async function main() {
  const email = process.argv[2]?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Usage: node functions/set-admin-claim.js <admin-email>");
  }

  const projectConfigPath = path.join(__dirname, "..", ".firebaserc");
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    projectConfig.projects?.default;
  if (!projectId) {
    throw new Error("No Firebase project is configured in .firebaserc.");
  }

  let firebaseTools;
  try {
    firebaseTools = loadFirebaseTools();
  } catch (error) {
    throw new Error(
      `Could not load the globally installed Firebase CLI. Install it with "npm install --global firebase-tools" and run "firebase login". ${error.message}`
    );
  }

  const account = firebaseTools.auth.getProjectDefaultAccount(process.cwd());
  if (!account?.tokens?.refresh_token) {
    throw new Error(
      'No Firebase CLI login was found. Run "firebase login" and try again.'
    );
  }

  firebaseTools.auth.setActiveAccount({}, account);
  await firebaseTools.auth.getAccessToken(account.tokens.refresh_token, []);

  const user = await firebaseTools.apiAuth.findUser(projectId, email);
  const updatedUser = await firebaseTools.apiAuth.setCustomClaim(
    projectId,
    user.uid,
    { admin: true },
    { merge: true }
  );
  const claims = JSON.parse(updatedUser.customAttributes || "{}");
  if (claims.admin !== true) {
    throw new Error("Firebase did not confirm the admin claim update.");
  }

  console.log(
    `Verified: admin: true is set for ${email}. They must sign out and sign in again.`
  );
}

main().catch((error) => {
  console.error(`Unable to grant admin access: ${error.message}`);
  process.exitCode = 1;
});
