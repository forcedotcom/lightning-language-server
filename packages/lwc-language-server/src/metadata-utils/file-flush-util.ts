import { writeFile } from "fs";

export function write(outFile: string, getOut: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
        writeFile(outFile, getOut(), err => {
            if (err) {
                console.log(`Error Encountered while flushing ${outFile}: ${err.message}`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
