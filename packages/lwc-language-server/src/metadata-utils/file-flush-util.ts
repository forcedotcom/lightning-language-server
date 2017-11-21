import { writeFile } from "fs";

// Maps is used to track if an async operation to flush a file using provided
// output generater is already queued up. This is an optimation to reduce file writes.
const isFlushEnqueued: Map<string, () => void> = new Map();

export function enqueueFlush(outFile: string, getOut: () => void) {
    if (isFlushEnqueued.get(outFile) !== getOut) {
        console.log(`Enqueue flush of ${outFile}`);
        isFlushEnqueued.set(outFile, getOut);
        Promise.resolve().then( () => {
            isFlushEnqueued.delete(outFile);
            console.log(`Flushing ${outFile}`);
            writeFile(outFile, getOut(), err => {
                if (err) {
                    console.log(`Error Encountered while flushing ${outFile}: ${err.message}`);
                }
            });
        });
    }
}
