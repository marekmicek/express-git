/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
  httpify,
  assign
} = require("../helpers");
const mime = require("mime-types");
const _path = require("path");
module.exports = function(app, options) {
  const {
    BadRequestError,
    NotModified,
    NotFoundError
  } = app.errors;
  app.get("/:git_repo(.*).git/:refname(.*)?/commit",
    app.authorize("browse"),
    function(req, res, next) {
      const {
        git_repo,
        refname
      } = req.params;
      const {
        repositories,
        disposable
      } = req.git;
      const etag = req.headers["if-none-match"];
      return repositories.ref(git_repo, refname)
        .then(function(...args) {
          const [ref, repo] = Array.from(args[0]);
          if ((repo == null) || (ref == null)) {
            throw new NotFoundError;
          }
          if (`${ref.target()}` === etag) {
            throw new NotModified;
          }
          return repo.getCommit(ref.target());
        }).then(disposable)
        .then(function(commit) {
          res.set(app.cacheHeaders(commit));
          return res.json(assign({
            type: "commit"
          }, commit.toJSON()));
        }).then(() => next())
        .catch(next);
    });

  app.get("/:git_repo(.*).git/:refname(.*)?/blob/:path(.*)",
    app.authorize("browse"),
    function(req, res, next) {
      const {
        git_repo,
        path,
        refname
      } = req.params;
      if (!path) {
        return next(new BadRequestError);
      }
      const {
        repositories,
        disposable
      } = req.git;
      const etag = req.headers["if-none-match"];
      return repositories.entry(git_repo, refname, path)
        .then(function(...args) {
          const [entry] = Array.from(args[0]);
          if (entry == null) {
            throw new NotFoundError("Entry not found");
          }
          if (entry.isTree()) {
            throw new BadRequestError;
          }
          if (entry.sha() === etag) {
            throw new NotModified;
          }
          return entry.getBlob();
        }).then(disposable)
        .then(function(blob) {
          const binary = blob.isBinary() ? true : false;
          const size = blob.rawsize();
          let content = blob.content();
          const truncate = size > options.max_size;
          if (truncate) {
            content = content.slice(0, options.max_size);
          }
          const encoding = binary ? "base64" : "utf8";
          res.set(app.cacheHeaders(blob));
          return res.json({
            type: "blob",
            id: `${blob.id()}`,
            binary,
            mime: mime.lookup(path),
            path,
            filename: _path.basename(path),
            contents: blob.toString(encoding),
            truncated: truncate,
            encoding,
            size
          });
        }).then(() => next())
        .catch(httpify(404))
        .catch(next);
    });

  return app.get("/:git_repo(.*).git/:refname(.*)?/tree/:path(.*)?",
    app.authorize("browse"),
    function(req, res, next) {
      const {
        git_repo,
        path,
        refname
      } = req.params;
      const {
        repositories,
        disposable
      } = req.git;

      const etag = req.headers["if-none-match"];
      return repositories.commit(git_repo, refname)
        .then(function(...args) {
          const [commit] = Array.from(args[0]);
          if (path) {
            return commit.getEntry(path)
              .then(disposable)
              .then(function(entry) {
                if (!entry.isTree()) {
                  throw new BadRequestError;
                }
                if (entry.sha() === etag) {
                  throw new NotModified;
                }
                return entry.getTree();
              });
          } else {
            return commit.getTree();
          }
        }).then(disposable)
        .then(function(tree) {
          res.set(app.cacheHeaders(tree));
          return res.json({
            type: "tree",
            id: `${tree.id()}`,
            name: _path.basename(path),
            path,
            entries: ((Array.from(tree.entries()).map((entry) => entry.toJSON())))
          });
        }).then(() => next())
        .catch(next);
    });
};