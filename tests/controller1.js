export default function () {
    return async function(ctx, next) {
        ctx.body = 'controller'
    }
}