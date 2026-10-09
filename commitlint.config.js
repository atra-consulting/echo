module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Dependabot-Commits haben Bodies mit Changelog-Links über 100 Zeichen
  // (body-max-line-length). Der Header folgt über das Präfix in
  // .github/dependabot.yml trotzdem Conventional Commits.
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)]
};
