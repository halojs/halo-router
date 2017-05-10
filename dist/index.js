'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _fs = require('fs');

var _pathToRegexp = require('path-to-regexp');

var _pathToRegexp2 = _interopRequireDefault(_pathToRegexp);

var _path = require('path');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = class {
    constructor(options) {
        this.router = {};
        this.specialRouter = {};
        this.opts = Object.assign({}, { dir: './controllers' }, options);
        this.methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'];

        this.registerHttpMethod();
    }
    registerHttpMethod() {
        this.methods.map(method => {
            this[method.toLowerCase()] = (path, middleware) => this.register(adjustPath(path), method, middleware);
        });
    }
    routes() {
        let context = this;

        return async function _router(ctx, next) {
            let path, method, routerObj, instance;

            path = ctx.path;
            method = ctx.method.toUpperCase();
            routerObj = context.router[path] && context.router[path][method];

            if (routerObj) {
                if (isClassFunction(routerObj)) {
                    instance = new routerObj();
                    return await instance[routerObj.action].call(instance, ctx, next);
                }

                return await routerObj(ctx, next);
            }

            routerObj = getSpecialRouter(context.specialRouter, method, path);

            if (routerObj) {
                ctx.params = converter(routerObj.route.path.keys.reduce((total, item, index) => {
                    return total[item.name] = routerObj.matched[index + 1], total;
                }, {}));

                if (isClassFunction(routerObj.route.middleware)) {
                    instance = new routerObj.route.middleware();
                    return await instance[routerObj.route.middleware.action].call(instance, ctx, next);
                }

                return await routerObj.route.middleware(ctx, next);
            }

            await next();
        };
    }
    register(path, method, middleware) {
        if (typeof middleware === 'string') {
            try {
                middleware = getAsyncMiddleware(this.opts.dir, middleware);
            } catch (e) {
                return;
            }
        }

        if (~path.indexOf(':')) {
            if (!this.specialRouter[method]) {
                this.specialRouter[method] = [];
            }

            this.specialRouter[method].push({
                middleware,
                path: (0, _pathToRegexp2.default)(path)
            });
        } else {
            if (!this.router[path]) {
                this.router[path] = {};
            }

            this.router[path][method] = middleware;
        }
    }
};


function getAsyncMiddleware(dir, middleware) {
    let path, result, modules;

    if (isFilePath(middleware)) {
        path = toAbsolutePath(middleware);
    } else if (isControllerPath(middleware)) {
        result = parseControllerPath(dir, middleware);
        path = result.path;
    }

    if ((0, _fs.statSync)(path).isFile()) {
        modules = required(path);
    }

    if (isAsyncFunction(modules)) {
        middleware = modules;
    }

    if (isClassFunction(modules) && modules.prototype[result.action]) {
        if (!isAsyncFunction(modules.prototype[result.action])) {
            console.error(`${result.action} must be async function`);
            throw new Error();
        }

        middleware = modules;
        middleware.action = result.action;
    }

    if (isFunction(modules)) {
        middleware = modules();
    }

    if (typeof middleware === 'string') {
        middleware = async function (ctx, next) {
            ctx.body = modules;
        };
    }

    return middleware;
}

function isNumeric(val) {
    return !isNaN(val);
}

function isFilePath(str) {
    return typeof str === 'string' && (0, _path.parse)(str).ext === '.js';
}

function isControllerPath(str) {
    return typeof str === 'string' && str.split('.')[0] !== str;
}

function isFunction(obj) {
    return obj.constructor.name === 'Function' && !isClassFunction(obj);
}

function isClassFunction(obj) {
    return typeof obj === 'function' && /^\s*class\s+/.test(obj.toString());
}

function isAsyncFunction(func) {
    return func.constructor.name === 'AsyncFunction';
}

function isObject(val) {
    return typeof val === 'object' && !Array.isArray(val);
}

function required(path) {
    let obj = require(path);

    return obj && obj.__esModule ? obj.default : obj;
}

function getSpecialRouter(router, method, path) {
    let matched, route;

    if (!router[method]) {
        return;
    }

    for (let item of router[method]) {
        if (matched = item.path.exec(path)) {
            route = item;
            break;
        }
    }

    return route ? { route, matched } : null;
}

function parseControllerPath(dir, path) {
    let result = path.split('.');

    return {
        action: result.pop(),
        path: toAbsolutePath((0, _path.join)(dir, result.join(_path.sep) + '.js'))
    };
}

function adjustPath(path) {
    return path.charAt(0) === '/' ? path : `/${path}`;
}

function toAbsolutePath(path) {
    return (0, _path.isAbsolute)(path) ? path : (0, _path.resolve)((0, _path.join)(process.cwd(), path));
}

function converter(val) {
    if (isNumeric(val)) {
        return +val;
    }

    if (isObject(val)) {
        return Object.keys(val).reduce((total, value) => {
            return total[value] = converter(val[value]), total;
        }, {});
    }

    return val;
}