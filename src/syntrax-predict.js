import { analyzeSyntraXPattern } from "./syntrax-pattern.js";

console.log("SyntraX Predict Loaded");


export function predictNextPattern(history = []) {

    if (history.length < 3) {
        return {
            prediction: "NORMAL",
            double: "0%",
            sibling: "0%"
        };
    }


    const result = history
        .slice(0, 10)
        .map((row) =>
            analyzeSyntraXPattern(
                row,
                history
            )
        );


    let doubleScore = 0;
    let siblingScore = 0;


    result.forEach((item) => {

        if (item.current?.hasDouble) {
            doubleScore++;
        }

        if (item.current?.hasSibling) {
            siblingScore++;
        }

    });


    const total =
        doubleScore +
        siblingScore +
        1;


    const doublePercent = Math.round(
        (doubleScore / total) * 100
    );


    const siblingPercent = Math.round(
        (siblingScore / total) * 100
    );


    let prediction = "NORMAL";


    if (
        doublePercent > siblingPercent &&
        doublePercent >= 40
    ) {
        prediction = "DOUBLE";
    }


    if (
        siblingPercent > doublePercent &&
        siblingPercent >= 40
    ) {
        prediction = "SIBLING";
    }


    return {
        prediction,

        double:
            doublePercent + "%",

        sibling:
            siblingPercent + "%"
    };

}
