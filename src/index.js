/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let expressGit, git;
const {
  httpify,
  a2o,
  spawn,
  assign,
  freeze
} = require("./helpers");
const Promise = require("bluebird");

const {
  mkdir,
  test
} = require("shelljs");
// Use a modified express that uses latest path-to-regexp and events-as-promised
const express = require("./express");
const _path = require("path");

module.exports = (expressGit = {});
expressGit.git = (git = require("./ezgit"));
expressGit.services = require("./services");
const RepoManager = require("./repo-manager");

const EXPRESS_GIT_DEFAULTS = {
  git_http_backend: true,
  serve_static: true,
  accept_commits: true,
  refs: true,
  auto_init: true,
  browse: true,
  init_options: {},
  max_size: 2 * 1024,
  max_age: 365 * 24 * 60 * 60,
  pattern: /.*/,
  authorize: null
};

expressGit.serve = function(root, options) {
  options = assign({}, EXPRESS_GIT_DEFAULTS, options);
  if (!(options.pattern instanceof RegExp)) {
    options.pattern = new Regexp(`${options.pattern || '.*'}`);
  }

  const GIT_AUTH =
    typeof options.authorize === "function" ?
    options.authorize :
    (name, req, next) => next();

  const GIT_PROJECT_ROOT = _path.resolve(`${root}`);
  const GIT_INIT_OPTIONS = freeze(options.init_options);

  const app = express();
  app.project_root = GIT_PROJECT_ROOT;
  app.git = git;

  const {
    NonHttpError,
    NotFoundError,
    BadRequestError,
    UnauthorizedError
  } = (app.errors = require("./errors"));

  app.disable("etag");

  app.authorize = name =>
    (req, res, next) =>
    GIT_AUTH(name, req, function(err) {
      if (err != null) {
        err.status != null ? err.status : (err.status = 401);
      }
      return next(err);
    })

  ;

  app.cacheHeaders = object =>
    ({
      "Etag": `${object.id()}`,
      "Cache-Control": `private, max-age=${options.max_age}, no-transform, must-revalidate`
    });

  const REPO_MANAGER_OPTIONS = {
    pattern: options.pattern,
    auto_init: options.auto_init,
    init_options: GIT_INIT_OPTIONS
  };
  app.use(function(req, res, next) {
    // Initialization middleware
    const NODEGIT_OBJECTS = [];
    const disposable = function(value) {
      NODEGIT_OBJECTS.push(Promise.resolve(value));
      return value;
    };

    const repositories = new RepoManager(GIT_PROJECT_ROOT, NODEGIT_OBJECTS, REPO_MANAGER_OPTIONS);

    // Hack to emit repositories events from app
    repositories.emit = app.emit.bind(app);

    req.git = freeze(req.git, {
      repositories,
      disposable,
      NODEGIT_OBJECTS
    });
    return next();
  });

  app.param("git_repo", function(req, res, next, path) {
    let git_dir, name, params;
    try {
      [name, params, git_dir] = Array.from(req.git.repositories.parse(path));
    } catch (err) {
      if (err.status == null) {
        err.status = 400;
      }
      return next(err);
    }
    req.git_repo = {
      name,
      params,
      git_dir
    };
    return next();
  });

  if (options.browse) {
    expressGit.services.browse(app, options);
    expressGit.services.object(app, options);
  }
  if (options.accept_commits) {
    expressGit.services.commit(app, options);
  }
  if (options.serve_static) {
    expressGit.services.raw(app, options);
  }
  if (options.git_http_backend) {
    expressGit.services.git_http_backend(app, options);
  }
  if (options.refs) {
    expressGit.services.refs(app, options);
  }

  app.use((req, res, next) =>
    Promise.settle(req.git.NODEGIT_OBJECTS)
    .map(function(inspection) {
      if (inspection.isFulfilled()) {
        try {
          return __guard__(inspection.value(), x => x.free());
        } catch (error) {}
      }
    })
  );
  return app;
};

if (require.main === module) {
  const os = require("os");
  let {
    PORT
  } = process.env;
  let ROOT = process.argv[2] || process.env.GIT_PROJECT_ROOT;
  if (ROOT == null) {
    ROOT = _path.join(os.tmpdir(), "express-git-repos");
  }
  mkdir(ROOT);
  if (PORT == null) {
    PORT = (20000 + (new Date().getTime() % 10000)) | 0;
  }
  const app = expressGit.serve(ROOT, {});
  app.listen(PORT, function() {
    console.log(`Listening on ${PORT}`);
    return console.log(`Serving repos from ${_path.resolve(ROOT)}`);
  });
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}