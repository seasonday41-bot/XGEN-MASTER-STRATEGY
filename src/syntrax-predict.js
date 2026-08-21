import { analyzeSyntraXPattern } from "./syntrax-pattern.js";


export function predictNextPattern(history = []) {

    if(history.length < 3){
        return {
            pattern:"ข้อมูลไม่พอ"
        };
    }


    const result =
        history
        .slice(0,10)
        .map(row =>
            analyzeSyntraXPattern(
                row,
                history
            )
        );


    let doubleScore = 0;
    let siblingScore = 0;


    result.forEach(item=>{

        if(item.current.hasDouble){
            doubleScore++;
        }

        if(item.current.hasSibling){
            siblingScore++;
        }

    });


    const total =
        doubleScore +
        siblingScore +
        1;


    const doublePercent =
        Math.round(
            doubleScore / total * 100
        );


    const siblingPercent =
        Math.round(
            siblingScore / total * 100
        );



    let prediction="NORMAL";


    if(doublePercent > siblingPercent
       && doublePercent >= 40){

        prediction="DOUBLE";

    }


    if(siblingPercent > doublePercent
       && siblingPercent >= 40){

        prediction="SIBLING";

    }



    return {

        prediction,

        double:
            doublePercent+"%",

        sibling:
            siblingPercent+"%"

    };

}
