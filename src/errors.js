/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class HttpError extends Error {
  static initClass() {
    this.prototype.name = "HttpError";
  }
  constructor(message) {
    super();
    this.message = message;
    if (this.status >= 500) {
      Error.captureStackTrace(this);
    }
  }
  toJSON() {
    return {
      message: this.message,
      statusCode: this.status,
      error: this.name
    };
  }
}
HttpError.initClass();

class ServerError extends HttpError {
  static initClass() {
    this.prototype.status = 500;
    this.prototype.name = "ServerError";
    this.prototype.message = "Internal Server Error";
  }
}
ServerError.initClass();

class NotFoundError extends HttpError {
  static initClass() {
    this.prototype.status = 404;
    this.prototype.name = "NotFoundError";
    this.prototype.message = "Not Found";
  }
}
NotFoundError.initClass();

class BadRequestError extends HttpError {
  static initClass() {
    this.prototype.status = 400;
    this.prototype.name = "BadRequestError";
    this.prototype.message = "Bad Request Error";
  }
}
BadRequestError.initClass();

class UnauthorizedError extends HttpError {
  static initClass() {
    this.prototype.status = 401;
    this.prototype.name = "UnauthorizedError";
    this.prototype.message = "Not Authorized";
  }
}
UnauthorizedError.initClass();

class UnsupportedMediaTypeError extends HttpError {
  static initClass() {
    this.prototype.status = 415;
    this.prototype.name = "UnsupportedMediaTypeError";
    this.prototype.message = "Unsupported Media Type";
  }
}
UnsupportedMediaTypeError.initClass();

class NotModified extends HttpError {
  static initClass() {
    this.prototype.status = 304;
    this.prototype.name = "NotModified";
    this.prototype.message = null;
  }
}
NotModified.initClass();

class ConflictError extends HttpError {
  static initClass() {
    this.prototype.status = 409;
    this.prototype.name = "Conflict";
    this.prototype.message = "Conflict";
  }
}
ConflictError.initClass();

const httpErrorHandler = function(err, req, res, next) {
  const status = parseInt(err.status || err.statusCode);
  if (status && !res.headersSent) {
    res.status(status);
    if (status < 400) {
      res.end();
    } else if (req.accepts("json")) {
      res.json(err);
    } else if (res.message) {
      res.send(res.message);
      res.end();
    } else {
      res.end();
    }
    return next();
  } else {
    return next(err);
  }
};

const NonHttpError = err => !err.status;

module.exports = {
  HttpError,
  NotModified,
  ServerError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  NonHttpError,
  httpErrorHandler,
  UnsupportedMediaTypeError,
  ConflictError
};