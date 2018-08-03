/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS203: Remove `|| {}` from converted for-own loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const os = require("os");
const _path = require("path");
const {
  spawn,
  exec
} = require("child_process");
const Promise = require("bluebird");
const assign = function(base, ...others) {
  if (typeof base !== "object") {
    return base;
  }
  for (let obj of Array.from(others)) {
    if (typeof obj === "object") {
      for (let key of Object.keys(obj || {})) {
        const value = obj[key];
        base[key] = value;
      }
    }
  }
  return base;
};

const zlib = require("zlib");

const {
  UnsupportedMediaTypeError
} = require("./errors");
module.exports = {
  requestStream(req) {
    const encoding = (req.headers["content-encoding"] != null ? req.headers["content-encoding"].toLowerCase() : undefined) || "identity";
    const length = req.headers["content-length"];
    switch (encoding) {
      case "deflate":
        return req.pipe(zlib.createInflate());
      case "gzip":
        return req.pipe(zlib.createGunzip());
      case "identity":
        req.length = length;
        return req;
      default:
        throw new UnsupportedMediaTypeError(`Unsuported encoding ${encoding}`);
    }
  },

  assign,

  a2o(arr) {
    return (function() {
      return arguments;
    })(...Array.from(arr || []));
  },
  freeze(...args) {
    args.unshift({});
    return Object.freeze(assign.apply(null, args));
  },
  exec: Promise.promisify(exec),
  isMiddleware(m) {
    return (typeof m === "function") ||
      m instanceof express.Router ||
      m instanceof express.Application;
  },
  spawn(...args) {
    let stdio;
    if (args[2] != null) {
      stdio = (args[2] != null ? args[2].stdio : undefined) || null;
      delete args[2].stdio;
    } else {
      stdio = null;
    }

    const cp = spawn(...Array.from(args || []));
    // Node"s child_process handling of stdio cannot handle req, res params in stdio
    if (stdio != null) {
      const iterable = ["stdin", "stdout", "stderr"];
      for (let i = 0; i < iterable.length; i++) {
        var str;
        const s = iterable[i];
        switch (stdio[i]) {
          case "pipe":
            str = process[s];
            break;
          case "ignore":
          case null:
          case false:
          case undefined:
            continue;
            break;
          default:
            str = stdio[i];
        }
        if (i > 0) {
          cp[s].pipe(str);
        } else {
          str.pipe(cp[s]);
        }
      }
    }

    const exit = new Promise(function(resolve, reject) {
      return cp.on("exit", function(code) {
        if (code === 0) {
          return resolve();
        } else {
          return reject(new Error(`Child process exited with code ${code}`));
        }
      });
    });
    exit.process = cp;
    return exit;
  },
  pktline(line) {
    const size = line.length + 4;
    const head = `0000${size.toString(16)}`.substr(-4, 4);
    return new Buffer(`${head}${line}`);
  },
  httpify(status) {
    if (status == null) {
      status = 500;
    }
    return function(err) {
      if (err.status == null) {
        err.status = status;
      }
      throw err;
    };
  },
  workdir() {
    return _path.join(os.tmpdir(), `express-git-${new Date().getTime()}`);
  }
};