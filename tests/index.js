import koa from 'koa'
import test from 'ava'
import Router from '../src'
import request from 'request'

const req = request.defaults({
    json: true,
    baseUrl: 'http://localhost:3000'
})

test.before.cb((t) => {
    let app = koa()
    let router = new Router({ dir: './tests' })

    router.get('/test', function* (next) { this.body = 'get test' })
    router.post('/test', function* (next) { this.body = 'post test' })
    router.put('/test', function* (next) { this.body = 'put test' })
    router.delete('/test', function* (next) { this.body = 'delete test' })
    router.get('/test/:id/:name', function* (next) { this.body = this.params })
    router.get('/file_function', './tests/controller1.js')
    router.get('/file_generator', './tests/controller2.js')
    router.get('/file_pureobject', './tests/controller3.js')
    router.get('/file_class', 'controller4.action')
    router.get('/file_class/:id', 'controller4.action')
    router.get('/file_notfound', './tests/controller5.js')

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
    req.get('/file_generator', (err, res, body) => {
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