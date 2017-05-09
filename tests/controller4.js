export default class {
    test() {
        return 'test'
    }
    async action(ctx, next) {
        if (ctx.params) {            
            ctx.body = this.test() + ctx.params.id
        } else {
            ctx.body = this.test()
        }
    }
}