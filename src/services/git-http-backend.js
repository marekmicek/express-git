/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
  requestStream,
  assign,
  spawn,
  pktline
} = require("../helpers");
const {
  which
} = require("shelljs");
const _path = require("path");
const Promise = require("bluebird");

const {
  PassThrough
} = require("stream");
const {
  GitUpdateRequest,
  ZERO_PKT_LINE
} = require("../stream");

module.exports = function(app, options) {
  if (options == null) {
    options = {};
  }
  const GIT_EXEC = (options != null ? options.git_executable : undefined) || which("git");
  const headers = function(service, type) {
    if (type == null) {
      type = "result";
    }
    return {
      "Pragma": "no-cache",
      "Expires": (new Date("1900")).toISOString(),
      "Cache-Control": "no-cache, max-age=0, must-revalidate",
      "Content-Type": `application/x-git-${service.replace('git-', '')}-${type}`
    };
  };

  app.post(":git_repo(.*).git/git-upload-pack", app.authorize("upload-pack"), function(req, res, next) {
    res.set(headers("upload-pack"));
    const {
      repositories
    } = req.git;
    const {
      git_repo
    } = req.params;
    return repositories.openOrInit(git_repo)
      .then(function(...args1) {
        const [repo] = Array.from(args1[0]);
        const args = ["upload-pack", "--stateless-rpc", repo.path()];
        return spawn(GIT_EXEC, args, {
          stdio: [req, res, res]
        });
      })
      .then(() => next())
      .catch(next);
  });

  app.post(":git_repo(.*).git/git-receive-pack", app.authorize("receive-pack"), function(req, res, next) {
    res.set(headers("receive-pack"));
    const {
      repositories
    } = req.git;
    const {
      git_repo
    } = req.params;
    const repo = repositories.openOrInit(git_repo).then(function(...args) {
      let repo;
      [repo] = Array.from(args[0]);
      return repo;
    });
    const pack = new Promise(function(resolve, reject) {
      const git = new GitUpdateRequest();
      git.on("error", reject);
      git.on("changes", function() {
        git.removeListener("error", reject);
        return resolve(git);
      });
      return requestStream(req).pipe(git);
    });
    return Promise.join(repo, pack, function(repo, pack) {
        let {
          capabilities,
          changes
        } = pack;
        const changeline = function({
          before,
          after,
          ref
        }) {
          let line = [before, after, ref].join(" ");
          if (capabilities) {
            line = `${line}\0${capabilities}`;
            capabilities = null;
          }
          return pktline(`${line}\n`);
        };

        return app.emit("pre-receive", repo, changes)
          .then(() => Promise.map(changes, (change, i) =>
            app.emit("update", repo, change)
            .then(() => change)
            .catch(() => null)
          )).then(function(changes) {
            changes = ((() => {
              const result = [];
              for (let c of Array.from(changes)) {
                if (c != null) {
                  result.push(c);
                }
              }
              return result;
            })());
            if (!(changes.length > 0)) {
              return;
            }
            const git = spawn(GIT_EXEC, ["receive-pack", "--stateless-rpc", repo.path()]);

            const {
              stdin,
              stdout,
              stderr
            } = git.process;
            stdout.pipe(res, {
              end: false
            });
            stderr.pipe(res, {
              end: false
            });
            for (let change of Array.from(changes)) {
              stdin.write(changeline(change));
            }
            stdin.write(ZERO_PKT_LINE);

            pack.pipe(stdin);
            return git;
          }).then(() => app.emit("post-receive", repo, changes));
      }).finally(() => res.end())
      .then(() => next())
      .catch(next);
  });

  // Ref advertisement for push/pull operations
  // via git receive-pack/upload-pack commands
  return app.get("/:git_repo(.*).git/info/refs", app.authorize("advertise-refs"), function(req, res, next) {
    let {
      service
    } = req.query;
    if (!["git-receive-pack", "git-upload-pack"].includes(service)) {
      return next(new BadRequestError);
    }

    service = service.replace("git-", "");
    const {
      repositories
    } = req.git;
    const {
      git_repo
    } = req.params;
    return repositories.openOrInit(git_repo)
      .then(function(...args1) {
        const [repo] = Array.from(args1[0]);
        res.set(headers(service, "advertisement"));
        res.write(pktline(`# service=git-${service}\n`));
        res.write(ZERO_PKT_LINE);
        const args = [service, "--stateless-rpc", "--advertise-refs", repo.path()];
        return spawn(GIT_EXEC, args, {
          stdio: ["ignore", res, "pipe"]
        });
      })
      .then(() => next())
      .catch(next);
  });
};