'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = router;

var _fs = require('fs');

var _pathToRegexp = require('path-to-regexp');

var _pathToRegexp2 = _interopRequireDefault(_pathToRegexp);

var _path = require('path');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let normalRouter, specialRouter, opts;

normalRouter = {};
specialRouter = {};
opts = { dir: './controllers' };

function router(options) {
    opts = Object.assign({}, opts, options);
    router.PATH = toAbsolutePath(opts.dir);

    return router;
}

router.PATH = toAbsolutePath(opts.dir);['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'].map(method => {
    router[method.toLowerCase()] = (path, middleware) => register(adjustPath(path), method, middleware);
});

router.routes = function () {
    return async function _router(ctx, next) {
        let path, method, routerObj, instance;

        path = ctx.path;
        method = ctx.method.toUpperCase();
        routerObj = normalRouter[path] && normalRouter[path][method];

        if (routerObj) {
            if (isClassFunction(routerObj)) {
                instance = new routerObj();
                return await instance[routerObj.action].call(instance, ctx, next);
            }

            return await routerObj(ctx, next);
        }

        routerObj = getSpecialRouter(specialRouter, method, path);

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
};

function register(path, method, middleware) {
    if (typeof middleware === 'string') {
        try {
            middleware = getAsyncMiddleware(router.PATH, middleware);
        } catch (e) {
            return;
        }
    }

    if (~path.indexOf(':')) {
        if (!specialRouter[method]) {
            specialRouter[method] = [];
        }

        specialRouter[method].push({
            middleware,
            path: (0, _pathToRegexp2.default)(path)
        });
    } else {
        if (!normalRouter[path]) {
            normalRouter[path] = {};
        }

        normalRouter[path][method] = middleware;
    }
}

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
        path: (0, _path.join)(dir, result.join(_path.sep) + '.js')
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