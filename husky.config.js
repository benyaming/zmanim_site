const tasks = (arr) => arr.join(' && ');

module.exports = {
  hooks: {
    'pre-commit': tasks(['lint-staged', 'yarn run type-check']),
    'pre-push': 'yarn run type-check',
    'commit-msg': 'commitlint -e $HUSKY_GIT_PARAMS',
  },
};
