import { Element } from "engine";

export default class LightningButtoIconStatefulExample extends Element{
    @track
    selected = true;;
    msg;
    get message(){
        if(this.msg){
            return "LightningButtoIconStatefulExample: "+this.msg;
        }
        else{
            return "";
        }
    }
    handleClick(e){
        this.selected = !this.selected;
        this.msg = "Toggling selected to "+this.selected;
    }
}
