/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
  httpify
} = require("../helpers");
module.exports = function(app, options) {
  const {
    git
  } = app;
  const {
    BLOB,
    TREE,
    COMMIT,
    TAG
  } = git.Object.TYPE;
  const {
    BadRequestError,
    NotModified
  } = app.errors;
  return app.get("/:git_repo(.*).git/object/:oid([a-zA-Z0-9]{40})", app.authorize("browse"), function(req, res, next) {
    const {
      git_repo,
      oid
    } = req.params;
    const {
      repositories,
      disposable
    } = req.git;
    if (oid === req.headers["if-none-match"]) {
      return next(new NotModified);
    }

    return repositories.open(git_repo)
      .then(repo => git.Object.lookup(repo, oid))
      .then(disposable)
      .then(function(object) {
        switch (object.type()) {
          case BLOB:
            return git.Blob.lookup(repo, oid);
          case TREE:
            return git.Tree.lookup(repo, oid);
          case COMMIT:
            return git.Commit.lookup(repo, oid);
          case TAG:
            return git.Tag.lookup(repo, oid);
          default:
            throw new BadRequestError("Invalid object type");
        }
      }).then(disposable)
      .catch(httpify(404))
      .then(function(object) {
        res.set(app.cacheHeaders(object));
        res.json(object);
        return next();
      }).catch(next);
  });
};