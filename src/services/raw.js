/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const mime = require("mime-types");
const {
  httpify,
  assign
} = require("../helpers");

module.exports = function(app, options) {
  const {
    NotModified,
    NotFoundError,
    BadRequestError
  } = app.errors;

  app.get("/:git_repo(.*).git/raw/:oid([a-zA-Z0-9]{40})", app.authorize("raw"), function(req, res, next) {
    const {
      git_repo,
      oid
    } = req.params;
    if (oid === req.headers['if-none-match']) {
      return next(new NotModified);
    }
    const {
      repositories
    } = req.git;

    return repositories.blob(git_repo, oid)
      .then(function(...args) {
        const [blob] = Array.from(args[0]);
        if (blob == null) {
          throw new NotFoundError("Blob not found");
        }
        res.set(assign(app.cacheHeaders(blob, {
          "Content-Type": "application/octet-stream",
          "Content-Length": blob.rawsize()
        })));
        res.end(blob.content());
        return next();
      }).catch(next);
  });

  return app.get("/:git_repo(.*).git/:refname(.*)?/raw/:path(.*)", app.authorize("raw"), function(req, res, next) {
    const {
      git_repo,
      refname,
      path
    } = req.params;
    if (!path) {
      return next(new BadRequestError("Invalid path"));
    }
    const etag = req.headers['if-none-match'];
    const {
      repositories,
      disposable
    } = req.git;
    return repositories.entry(git_repo, refname, path)
      .then(function(...args) {
        const [entry] = Array.from(args[0]);
        if (entry == null) {
          throw new NotFoundError("Entry not found");
        }
        if (!entry.isBlob()) {
          throw new BadRequestError("Entry is not a blob");
        }
        if (etag === `${entry.sha()}`) {
          throw new NotModified;
        }
        return entry.getBlob();
      }).then(disposable)
      .catch(httpify(404))
      .then(function(blob) {
        res.set(assign(app.cacheHeaders(blob), {
          "Content-Type": mime.lookup(path) || "application/octet-stream",
          "Content-Length": blob.rawsize()
        }));
        res.end(blob.content());
        return next();
      }).catch(next);
  });
};