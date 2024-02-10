import { LightningElement, api } from "lwc";
import { contextLibraryLWC } from "clients-context-library-lwc";
import AppNavBar from "one/app-nav-bar";

export default class InputPhone extends LightningElement {
  @api value;
}
