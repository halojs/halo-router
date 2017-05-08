import { statSync } from 'fs'
import pathToRegexp from 'path-to-regexp'
import { parse, join, isAbsolute, resolve, sep } from 'path'

export default class {
    constructor(options = {}) {
        this.router = {}
        this.specialRouter = {}
        this.opts = Object.assign({}, { dir: '' }, options)
        this.methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']

        this.registerHttpMethod()
    }
    registerHttpMethod() {
        this.methods.map((method) => {
            this[method.toLowerCase()] = (path, middleware) => this.register(adjustPath(path), method, middleware)
        })
    }
    routes() {
        let ctx = this
        
        return function* _router(next) {
            let path, method, router, instance

            path = this.path
            method = this.method.toUpperCase()
            router = ctx.router[path] && ctx.router[path][method]

            if (router) {
                if (isClassFunction(router)) {
                    instance = new router()
                    return yield* instance[router.action].call(this, next, instance)
                }
                
                return yield* router.call(this, next)
            }
            
            router = getSpecialRouter(ctx.specialRouter, method, path)
            
            if (router) {
                this.params = converter(router.route.path.keys.reduce((total, item, index) => {
                    return total[item.name] = router.matched[index + 1], total
                }, {}))
                
                if (isClassFunction(router.route.middleware)) {
                    instance = new router.route.middleware()
                    return yield* instance[router.route.middleware.action].call(this, next, instance)
                }

                return yield* router.route.middleware.call(this, next)
            }
            
            yield* next
        }
    }
    register(path, method, middleware) {
        if (typeof middleware === 'string') {
            try {
                middleware = getGeneratorMiddleware.call(this, middleware)
            } catch(e) {
                return
            }
        }
        
        if (~path.indexOf(':')) {
            if (!this.specialRouter[method]) {
                this.specialRouter[method] = []
            }

            this.specialRouter[method].push({
                middleware,
                path: pathToRegexp(path)
            })
        } else {
            if (!this.router[path]) {
                this.router[path] = {}
            }

            this.router[path][method] = middleware
        }
    }
}

function getGeneratorMiddleware(middleware) {
    let path, result, modules

    if (isFilePath(middleware)) {
        path = toAbsolutePath(middleware)
    } else if (isControllerPath(middleware)) {
        result = parseControllerPath(this.opts.dir, middleware)
        path = result.path
    }
    
    if (statSync(path).isFile()) {
        modules = required(path)
    }
    
    if (isFunction(modules)) {
        middleware = modules()
    }

    if (isGeneratorFunction(modules)) {
        middleware = modules
    }
    
    if (isClassFunction(modules) && modules.prototype[result.action]) {
        middleware = modules
        middleware.action = result.action
    }
    
    if (typeof middleware === 'string') {
        middleware = function* (next) {
            this.body = modules
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

function isControllerPath(str) {
    return typeof str === 'string' && str.split('.')[0] !== str
}

function isGeneratorFunction(obj) {
    return obj.constructor.name === 'GeneratorFunction'
}

function isFunction(obj) {
    return obj.constructor.name === 'Function' && !isClassFunction(obj)
}

function isObject(val) {
    return typeof val === 'object' && !Array.isArray(val)
}

function isClassFunction(obj) {
    return typeof obj === 'function' && /^\s*class\s+/.test(obj.toString())
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

function parseControllerPath(dir, path) {
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