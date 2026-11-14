import type {Deck} from './engine';
export const sampleDeck:Deck={title:'Eesha Lore Night',categories:[
 {name:'Screen Time',clues:[{prompt:'Who played Barbie in the 2023 Greta Gerwig movie?',answer:'Margot Robbie',choices:['Margot Robbie','Emma Stone','Zendaya','Florence Pugh']},{prompt:'What is the name of the paper company in The Office (US)?',answer:'Dunder Mifflin'}]},
 {name:'Snack Break',clues:[{prompt:'What is the main ingredient in guacamole?',answer:'Avocado',choices:['Avocado','Cucumber','Green pepper','Zucchini']},{prompt:'Pitch a name for a fictional cabin’s signature snack.',manual:true}]}
],final:{category:'The Finale',prompt:'Which U.S. state contains both Mount Rainier and the Space Needle?',answer:'Washington',aliases:['Washington State']}};
