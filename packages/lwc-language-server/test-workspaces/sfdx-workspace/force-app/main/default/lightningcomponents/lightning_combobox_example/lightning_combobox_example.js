import { Element } from "engine";

export default class LightningComoboxExample extends Element{
    @track
    selected;
    @track
    msg;

    options = [
        { value: "new", label: "New" },
        { value: "in-progress", label: "In Progress" },
        { value: "finished", label: "Finished" }
    ];

    get message(){
        if(this.msg){
            return "LightningComoboxExample: "+this.msg;
        }
        else{
            return "";
        }
    }
    handleOptionSelected(e){
        this.selected = e.detail.value;
        this.msg = "Selected Option: "+this.selected ;
    }
}
