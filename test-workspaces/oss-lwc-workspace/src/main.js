import {createElement} from "lwc";
import App from "my-app";

const container = document.getElementById("main");
const element = createElement("my-app", {is: App});
container.appendChild(element);
