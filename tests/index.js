import koa from 'koa'
import test from 'ava'
import Router from '../src'
import request from 'request'

const req = request.defaults({
    json: true,
    baseUrl: 'http://localhost:3000'
})

test.before.cb((t) => {
    let app = new koa()
    let router = new Router({ dir: './tests' })

    router.get('/test', async function(ctx, next) { ctx.body = 'get test' })
    router.post('/test', async function(ctx, next) { ctx.body = 'post test' })
    router.put('/test', async function(ctx, next) { ctx.body = 'put test' })
    router.delete('/test', async function(ctx, next) { ctx.body = 'delete test' })
    router.get('/test/:id/:name', async function(ctx, next) { ctx.body = ctx.params })
    router.get('/file_function', './tests/controller1.js')
    router.get('/file_async', './tests/controller2.js')
    router.get('/file_pureobject', './tests/controller3.js')
    router.get('/file_class', 'controller4.action')
    router.get('/file_class/:id', 'controller4.action')
    router.get('/file_notfound', './tests/controller5.js')
    router.get('/file_class_method_no_async_function', 'controller4.test')
    router.get('/test', async function(ctx, next) { ctx.body = 'get test' })
    router.get('/test/:id/:name', async function(ctx, next) { ctx.body = ctx.params })
    router.maps([{
        url: '/maps',
        method: 'get',
        async middleware(ctx, next) {
            ctx.body = 'maps test'
        }
    }])

    app.use(router.routes())
    app.listen(3000, t.end)
})

test.cb('normal url', (t) => {
    req.get('/test', (err, res, body) => {
        t.is(body, 'get test')
        t.end()
    })
})

test.cb('post method url', (t) => {
    req.post('/test', (err, res, body) => {
        t.is(body, 'post test')
        t.end()
    })
})

test.cb('put method url', (t) => {
    req.put('/test', (err, res, body) => {
        t.is(body, 'put test')
        t.end()
    })
})

test.cb('delete method url', (t) => {
    req.delete('/test', (err, res, body) => {
        t.is(body, 'delete test')
        t.end()
    })
})

test.cb('404 url', (t) => {
    req.get('/', (err, res, body) => {
        t.is(res.statusCode, 404)
        t.end()
    })
})

test.cb('restful url', (t) => {
    req.get('/test/1/han', (err, res, body) => {
        t.is(body.id, 1)
        t.is(body.name, 'han')
        t.end()
    })
})

test.cb('404 restful url', (t) => {
    req.post('/test/1/han', (err, res, body) => {
        t.is(res.statusCode, 404)
        t.end()
    })
})

test.cb('file handler, export pure function', (t) => {
    req.get('/file_function', (err, res, body) => {
        t.is(body, 'controller')
        t.end()
    })
})

test.cb('file handler, export generator function', (t) => {
    req.get('/file_async', (err, res, body) => {
        t.is(body, 'controller2')
        t.end()
    })
})

test.cb('file handler, export pure object', (t) => {
    req.get('/file_pureobject', (err, res, body) => {
        t.is(body.a, 1)
        t.end()
    })
})

test.cb('class handler, export class function', (t) => {
    req.get('/file_class', (err, res, body) => {
        t.is(body, 'test')
        t.end()
    })
})

test.cb('restful url, class handler, export class function', (t) => {
    req.get('/file_class/1', (err, res, body) => {
        t.is(body, 'test1')
        t.end()
    })
})

test.cb('file not found, handler register fail', (t) => {
    req.get('/file_notfound', (err, res, body) => {
        t.is(res.statusCode, 404)
        t.end()
    })
})

test.cb('class handler, but method no async function ', (t) => {
    req.get('/file_class_method_no_async_function', (err, res, body) => {
        t.is(res.statusCode, 404)
        t.end()
    })
})

test.cb('router instance maps method test', (t) => {
    req.get('/maps', (err, res, body) => {
        t.is(body, 'maps test')
        t.end()
    })
})