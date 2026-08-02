const emit = defineEmits(["close", "ok"]);
function close(){
    emit("close")
}
function ok(){
    emit("ok")
}
