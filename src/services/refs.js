/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const git = require("../ezgit");

module.exports = function(app, options) {
  const {
    MethodNotAllowedError,
    ConflictError,
    BadRequestError
  } = app.errors;

  app.delete("/:git_repo(.*).git/:refname(refs/.*)", app.authorize("refs"), function(req, res, next) {
    const {
      git_repo,
      refname
    } = req.params;
    if (!current || !message) {
      return next(new BadRequestError);
    }
    const {
      repositories,
      disposable
    } = req.git;
    return repositories.ref(git_repo, refname)
      .then([ref, repo])(function() {
        if (typeof ref === 'undefined' || ref === null) {
          res.set("Allow", "PUT");
          throw new MethodNotAllowedError;
        }
        return git.Reference.remove(repo, refname);
      }).then(function(code) {
        if (code !== 0) {
          throw new Error(`Error code ${code}`);
        }
        res.json({
          message: "OK"
        });
        return next();
      }).catch(next);
  });

  return app.put("/:git_repo(.*).git/:refname(refs/.*)", app.authorize("refs"), require("body-parser").json(), function(req, res, next) {
    for (let key of ["target", "message", "current"]) {
      if (!(key in req.body)) {
        return next(new BadRequestError(`Missing parameter ${key}`));
      }
    }

    let {
      target,
      current,
      message,
      signature,
      symbolic
    } = req.body;

    const {
      git_repo,
      refname
    } = req.params;
    const {
      repositories,
      disposable
    } = req.git;
    return repositories.openOrInit(git_repo)
      .then(() => repositories.ref(git_repo, refname))
      .then(function(...args) {
        const [ref, repo] = Array.from(args[0]);
        if (signature != null) {
          try {
            signature = git.Signature.create(Signature);
          } catch (err) {
            signature = null;
          }
        }
        if (signature == null) {
          signature = git.Signature.default(repo);
        }
        disposable(signature);
        if (ref != null) {
          if (symbolic) {
            if (!ref.isSymbolic()) {
              throw new BadRequestError("Not a symbolic reference");
            }
            if (`${ref.symbolicTarget()}` !== target) {
              throw new BadRequestError("Wrong reference target");
            }
            return ref.symbolicSetTarget(target, signature, message);
          } else {
            if (`${ref.target()}` !== current) {
              throw new ConflictError("Non fast-forward change");
            }
            target = git.Oid.fromString(target);
            return ref.setTarget(target, signature, message);
          }
        } else {
          if (symbolic) {
            return git.Reference.symbolicCreate(repo, refname, target, 0, signature, message);
          } else {
            target = git.Oid.fromString(target);
            return git.Reference.create(repo, refname, target, 0, signature, message);
          }
        }
      }).then(function(ref) {
        disposable(ref);
        res.json(ref);
        return next();
      }).catch(next);
  });
};