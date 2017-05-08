export default class {
    test() {
        return 'test'
    }
    * action(next, ctx) {
        if (this.params) {            
            this.body = ctx.test() + this.params.id
        } else {
            this.body = ctx.test()
        }
    }
}