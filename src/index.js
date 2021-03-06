import { statSync } from 'fs'
import pathToRegexp from 'path-to-regexp'
import { parse, join, isAbsolute, resolve, sep } from 'path'

export default class {
    constructor(options) {
        this.router = {}
        this.specialRouter = {}
        this.opts = Object.assign({}, { dir: './controllers' }, options)
        this.methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']

        this.registerHttpMethod()
    }
    registerHttpMethod() {
        this.methods.map((method) => {
            this[method.toLowerCase()] = (path, middleware) => this.register(adjustPath(path), method, middleware)
        })
    }
    maps(maps) {
        maps.map((item) => {
            this[item.method](item.url, item.middleware)
        })
    }
    routes() {
        let context = this

        return async function _router(ctx, next) {
            let path, method, routerObj, instance

            path = ctx.path
            method = ctx.method.toUpperCase()
            routerObj = context.router[path] && context.router[path][method]

            if (routerObj) {
                if (isClassFunction(routerObj.middleware)) {
                    instance = new routerObj.middleware()
                    return await instance[routerObj.action].call(instance, ctx, next)
                }

                return await routerObj.middleware(ctx, next)
            }
            
            routerObj = getSpecialRouter(context.specialRouter, method, path)
            
            if (routerObj) {
                ctx.params = converter(routerObj.route.path.keys.reduce((total, item, index) => {
                    return total[item.name] = routerObj.matched[index + 1], total
                }, {}))
                
                if (isClassFunction(routerObj.route.middleware)) {
                    instance = new routerObj.route.middleware()
                    return await instance[routerObj.route.action].call(instance, ctx, next)
                }

                return await routerObj.route.middleware(ctx, next)
            }

            await next()
        }
    }
    register(path, method, middleware) {
        if (typeof middleware === 'string') {
            try {
                middleware = getAsyncMiddleware(this.opts.dir, middleware)
            } catch(e) {
                console.log('\x1b[31m', e.message)
                return
            }
        }
        
        if (~path.indexOf(':')) {
            if (!this.specialRouter[method]) {
                this.specialRouter[method] = []
            }

            for (let item of this.specialRouter[method]) {
                if (item.origin === path) {
                    console.error('\x1b[31m', `${method} ${path} url is exist`)
                    return
                }
            }

            this.specialRouter[method].push({
                middleware,
                origin: path,
                path: pathToRegexp(path),
                action: middleware.action
            })
        } else {
            if (!this.router[path]) {
                this.router[path] = {}
            }

            if (this.router[path][method]) {
                console.error('\x1b[31m', `${method} ${path} url is exist`)
                return
            }

            this.router[path][method] = {
                middleware,
                action: middleware.action
            }
        }
    }
}

function getAsyncMiddleware(dir, middleware) {
    let path, result, modules

    if (isFilePath(middleware)) {
        path = toAbsolutePath(middleware)
    } else if (isClassPath(middleware)) {
        result = parseClassPath(dir, middleware)
        path = result.path
    }
    
    if (statSync(path).isFile()) {
        modules = required(path)
    }

    if (isAsyncFunction(modules)) {
        middleware = modules
    }
    
    if (isClassFunction(modules) && modules.prototype[result.action]) {
        if (!isAsyncFunction(modules.prototype[result.action])) {
            throw new Error(`${result.action} must be async function`)
        }
        
        middleware = modules
        middleware.action = result.action
    }

    if (isFunction(modules)) {
        middleware = modules()
    }
    
    if (typeof middleware === 'string') {
        middleware = async function(ctx, next) {
            ctx.body = modules
        }
    }
    
    return middleware
}

function isNumeric(val) {
    return !isNaN(val)
}

function isFilePath(str) {
    return typeof str === 'string' && parse(str).ext === '.js'
}

function isClassPath(str) {
    return typeof str === 'string' && str.split('.')[0] !== str
}

function isFunction(obj) {
    return obj.constructor.name === 'Function' && !isClassFunction(obj)
}

function isClassFunction(obj) {
    return typeof obj === 'function' && /^\s*class\s+/.test(obj.toString())
}

function isAsyncFunction(func) {
    return func.constructor.name === 'AsyncFunction'
}

function isObject(val) {
    return typeof val === 'object' && !Array.isArray(val)
}

function required(path) {
    let obj = require(path)

    return obj && obj.__esModule ? obj.default : obj
}

function getSpecialRouter(router, method, path) {
    let matched, route

    if (!router[method]) {
        return
    }

    for (let item of router[method]) {
        if (matched = item.path.exec(path)) {
            route = item
            break
        }
    }

    return route ? { route, matched } : null
}

function parseClassPath(dir, path) {
    let result = path.split('.')
    
    return {
        action: result.pop(),
        path: toAbsolutePath(join(dir, result.join(sep) + '.js'))
    }
}

function adjustPath(path) {
    return path.charAt(0) === '/' ? path : `/${path}`
}

function toAbsolutePath(path) {
    return isAbsolute(path) ? path : resolve(join(process.cwd(), path))
}

function converter(val) {
    if (isNumeric(val)) {
        return +val
    }

    if (isObject(val)) {
        return Object.keys(val).reduce((total, value) => {
            return total[value] = converter(val[value]), total
        }, {})
    }

    return val
}