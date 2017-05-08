export default function () {
    return function* (next) {
        this.body = 'controller'
    }
}